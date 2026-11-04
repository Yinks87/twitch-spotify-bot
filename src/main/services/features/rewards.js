import { getSettings, getStore } from '../../store';
import { broadcast } from '../events';
import { createReward, deleteReward, getManageableRewards, updateReward } from '../twitch/api';
import { logger } from '../logger';
import { errorMessage } from '../template';

const KEYS = ['songRequest', 'skip'];
const LABELS = { songRequest: 'Song-Request', skip: 'Skip' };

let queue = Promise.resolve();

function toBody(reward, { prompt, userInput }) {
  return {
    title: reward.title,
    cost: reward.cost,
    prompt,
    is_user_input_required: userInput,
    is_enabled: true,
    background_color: reward.color,
    is_max_per_stream_enabled: reward.maxPerStreamEnabled,
    ...(reward.maxPerStreamEnabled ? { max_per_stream: reward.maxPerStream } : {}),
    is_max_per_user_per_stream_enabled: reward.maxPerUserEnabled,
    ...(reward.maxPerUserEnabled ? { max_per_user_per_stream: reward.maxPerUser } : {})
  };
}

function desiredRewards() {
  const songRequest = getSettings('songRequest');
  const skip = getSettings('skip');
  const wanted = {};

  if (songRequest.mode === 'channelpoints') {
    wanted.songRequest = toBody(songRequest.reward, {
      prompt: songRequest.reward.prompt,
      userInput: true
    });
  }
  if (skip.enabled && skip.mode === 'channelpoints') {
    wanted.skip = toBody(skip.reward, { prompt: '', userInput: false });
  }
  return wanted;
}

const isSuspended = (key) => Boolean(getStore('rewards').get(`suspended.${key}`));
const setSuspended = (key, value) => {
  const store = getStore('rewards');
  if (value) store.set(`suspended.${key}`, true);
  else store.delete(`suspended.${key}`);
};

async function removeFromTwitch(key) {
  const store = getStore('rewards');
  const id = store.get(key);
  if (!id) return false;
  try {
    await deleteReward(id);
  } catch (error) {
    if (error.status !== 404) throw error;
  }
  store.delete(key);
  logger.info('twitch', `Channelpoint-Reward (${LABELS[key]}) gelöscht`);
  return true;
}

async function toggleReward(key) {
  const store = getStore('rewards');
  const id = store.get(key);
  if (!id) return false;
  try {
    const existing = (await getManageableRewards()).find((r) => r.id === id);
    if (!existing) throw new Error('Reward nicht gefunden');
    await updateReward(id, { id, is_paused: !existing.is_paused });
  } catch (error) {
    if (error.status !== 404) throw error;
    store.delete(key);
  }
  return true;
}

const isDuplicateError = (error) =>
  error.status === 400 && /duplicate/i.test(`${error.code} ${error.message}`);

// Übernimmt einen vorhandenen Reward mit gleichem Titel (von dieser App angelegt).
async function adoptByTitle(key, wanted, originalError) {
  const match = (await getManageableRewards()).find((r) => r.title === wanted.title);
  if (!match) throw originalError;
  await updateReward(match.id, wanted);
  getStore('rewards').set(key, match.id);
  logger.success('twitch', `Vorhandenen Channelpoint-Reward "${wanted.title}" übernommen`);
  return match.id;
}

async function syncOne(key, wanted, recreate) {
  const store = getStore('rewards');

  if (!wanted) {
    await removeFromTwitch(key);
    setSuspended(key, false);
    return;
  }
  if (recreate) setSuspended(key, false);
  else if (isSuspended(key)) return;

  const existingId = store.get(key);
  if (existingId) {
    try {
      await updateReward(existingId, wanted);
      logger.info('twitch', `Channelpoint-Reward "${wanted.title}" aktualisiert`);
      return;
    } catch (error) {
      if (isDuplicateError(error)) {
        const rewards = await getManageableRewards();
        const match = rewards.find((r) => r.title === wanted.title && r.id !== existingId);
        if (match) {
          // Der Titel gehört bereits einem anderen Reward der App: diesen übernehmen und den
          // veralteten Reward entfernen.
          await updateReward(match.id, wanted);
          store.set(key, match.id);
          await deleteReward(existingId).catch((e) => {
            if (e.status !== 404) throw e;
          });
          logger.success('twitch', `Vorhandenen Channelpoint-Reward "${wanted.title}" übernommen`);
          return;
        }
        // Der Titel ist bei Twitch bereits vergeben (z. B. von einem nicht von der App
        // verwalteten Reward): alle übrigen Einstellungen trotzdem aktualisieren.
        const withoutTitle = { ...wanted };
        delete withoutTitle.title;
        await updateReward(existingId, withoutTitle);
        logger.warn(
          'twitch',
          `Channelpoint-Reward (${LABELS[key]}): Titel "${wanted.title}" ist bei Twitch bereits vergeben, Titel nicht geändert`
        );
        return;
      }
      if (error.status !== 404) throw error;
      store.delete(key);
    }
  }

  try {
    const created = await createReward(wanted);
    store.set(key, created.id);
    logger.success('twitch', `Channelpoint-Reward "${wanted.title}" angelegt`);
  } catch (error) {
    if (!isDuplicateError(error)) throw error;
    await adoptByTitle(key, wanted, error);
  }
}

async function runSync(recreate) {
  const wanted = desiredRewards();
  for (const key of KEYS) {
    try {
      await syncOne(key, wanted[key], recreate);
    } catch (error) {
      logger.error(
        'twitch',
        `Channelpoint-Reward (${LABELS[key]}) konnte nicht synchronisiert werden: ${errorMessage(error)}`
      );
    }
  }
  broadcast('rewards:update');
}

// Serialisiert, damit schnelle Einstellungsänderungen keine doppelten Rewards erzeugen.
// recreate: ein zuvor manuell gelöschter Reward wird wieder angelegt.
export function syncRewards({ recreate = false } = {}) {
  queue = queue.then(
    () => runSync(recreate),
    () => runSync(recreate)
  );
  return queue;
}

export function deleteRewardByKey(key) {
  if (!KEYS.includes(key)) throw new Error(`Unbekannter Reward: ${key}`);
  const run = async () => {
    await removeFromTwitch(key);
    setSuspended(key, true);
    broadcast('rewards:update');
  };
  queue = queue.then(run, run);
  return queue;
}

export async function toggleRewardByKey(key) {
  if (!KEYS.includes(key)) throw new Error(`Unbekannter Reward: ${key}`);
  const run = async () => {
    await toggleReward(key);
    broadcast('rewards:update');
  };
  queue = queue.then(run, run);
  return queue;
}

async function fetchPausedStates() {
  try {
    const rewards = await getManageableRewards();
    return new Map(rewards.map((r) => [r.id, Boolean(r.is_paused)]));
  } catch {
    return new Map();
  }
}

export async function listRewards() {
  const wanted = desiredRewards();
  const store = getStore('rewards');
  const paused = await fetchPausedStates();
  return KEYS.map((key) => ({
    key,
    label: LABELS[key],
    wanted: Boolean(wanted[key]),
    title: wanted[key]?.title ?? null,
    cost: wanted[key]?.cost ?? null,
    exists: Boolean(store.get(key)),
    suspended: isSuspended(key),
    isPaused: paused.get(store.get(key)) ?? false
  })).filter((reward) => reward.wanted || reward.exists);
}

export function getRewardId(key) {
  return getStore('rewards').get(key, null);
}
