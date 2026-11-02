import { shell } from 'electron';
import { getSettings, getStore, saveSettings } from '../store';
import { broadcast } from './events';
import { logger } from './logger';
import { emitStatus, getStatus, patchRuntime } from './status';
import { errorMessage } from './template';
import { registerAuthHandler, startAuthServer } from './auth-server';
import * as spotify from './spotify';
import * as twitchAuth from './twitch/auth';
import { setRedemptionStatus } from './twitch/api';
import { EVENT_CHAT, EVENT_POWERUP, EVENT_REDEMPTION } from './twitch/events';
import { isEventSubRunning, startEventSub, stopEventSub } from './twitch/eventsub';
import { handleChatMessage } from './features/chat-commands';
import { deleteRewardByKey, getRewardId, listRewards, syncRewards } from './features/rewards';
import { handleSongRequest } from './features/song-request';
import { getSkipState, registerSkipVote, resetVotes } from './features/skip-vote';

const HOUR = 60 * 60 * 1000;
const REAUTH_WARNING_DAYS = 14;

const matchesPowerUp = (event, configuredName) => {
  const name = configuredName.trim().toLowerCase();
  return Boolean(name) && event.custom_power_up?.title?.trim().toLowerCase() === name;
};

async function settleRedemption(event, ok) {
  const status = ok ? 'FULFILLED' : 'CANCELED';
  try {
    await setRedemptionStatus(event.id, event.reward.id, status);
    logger.info(
      'twitch',
      `Einlösung von ${event.user_login} ${ok ? 'abgeschlossen' : 'abgebrochen (Punkte erstattet)'}`
    );
  } catch (error) {
    logger.error(
      'twitch',
      `Einlösung konnte nicht auf ${status} gesetzt werden: ${errorMessage(error)}`
    );
  }
}

async function onRedemption(event) {
  if (event.status !== 'unfulfilled') return;
  const songRequest = getSettings('songRequest');
  const skip = getSettings('skip');

  if (songRequest.mode === 'channelpoints' && event.reward.id === getRewardId('songRequest')) {
    logger.info('twitch', `Channelpoint-Einlösung "${event.reward.title}" von ${event.user_login}`);
    const ok = await handleSongRequest({
      userLogin: event.user_login,
      input: event.user_input,
      source: 'Channelpoints'
    });
    await settleRedemption(event, ok);
  } else if (
    skip.enabled &&
    skip.mode === 'channelpoints' &&
    event.reward.id === getRewardId('skip')
  ) {
    logger.info('twitch', `Channelpoint-Einlösung "${event.reward.title}" von ${event.user_login}`);
    const result = await registerSkipVote({
      userId: event.user_id,
      userLogin: event.user_login,
      source: 'Channelpoints'
    });
    await settleRedemption(event, result === 'counted' || result === 'skipped');
  }
}

async function onPowerUp(event) {
  if (event.status !== 'fulfilled' || event.status === 'canceled') return;
  console.log(event);
  const songRequest = getSettings('songRequest');
  const skip = getSettings('skip');
  const title = event.custom_power_up?.title;

  console.log(`Power-Up title: ${title}`);
  console.log(`Power-Up bits: ${event.custom_power_up.bits}`);

  if (songRequest.mode === 'powerup' && matchesPowerUp(event, songRequest.powerUpName)) {
    logger.info(
      'twitch',
      `Power-Up "${title}" von ${event.user_login} (${event.custom_power_up.bits} Bits)`
    );
    await handleSongRequest({
      userLogin: event.user_login,
      input: event.user_input,
      source: 'Power-Up'
    });
  } else if (skip.enabled && skip.mode === 'powerup' && matchesPowerUp(event, skip.powerUpName)) {
    logger.info(
      'twitch',
      `Power-Up "${title}" von ${event.user_login} (${event.custom_power_up.bits} Bits)`
    );
    await registerSkipVote({
      userId: event.user_id,
      userLogin: event.user_login,
      source: 'Power-Up'
    });
  }
}

async function onNotification(type, event) {
  if (type === EVENT_CHAT) await handleChatMessage(event);
  else if (type === EVENT_REDEMPTION) await onRedemption(event);
  else if (type === EVENT_POWERUP) await onPowerUp(event);
}

function startTwitchServices({ restart = false } = {}) {
  if (restart) stopEventSub();
  if (!isEventSubRunning()) startEventSub({ onNotification });
  if (getSettings('app').setupCompleted) syncRewards();
}

async function validateTwitch(reason) {
  if (!twitchAuth.hasSession()) return;
  try {
    await twitchAuth.ensureValidToken();
    logger.info('twitch', `Token-Validierung erfolgreich (${reason})`);
    if (!isEventSubRunning()) startTwitchServices();
  } catch (error) {
    patchRuntime('twitch', { error: errorMessage(error) });
    logger.error('twitch', `Token-Validierung fehlgeschlagen (${reason}): ${errorMessage(error)}`);
  }
}

async function startupSpotify() {
  if (!spotify.isConnected()) return;
  const { reauthInDays } = getStatus().spotify;
  if (reauthInDays !== null && reauthInDays <= REAUTH_WARNING_DAYS) {
    logger.warn(
      'spotify',
      reauthInDays > 0
        ? `Spotify-Autorisierung läuft in ${reauthInDays} Tag(en) ab – bitte neu verbinden`
        : 'Spotify-Autorisierung ist abgelaufen – bitte neu verbinden'
    );
  }
  try {
    await spotify.getAccessToken();
    logger.info('spotify', 'Spotify-Verbindung geprüft');
  } catch (error) {
    logger.error('spotify', `Spotify-Verbindung fehlgeschlagen: ${errorMessage(error)}`);
  }
}

function reportAuthResult(provider, ok, message) {
  broadcast('oauth:result', { provider, ok, message });
  emitStatus();
}

export async function initBot() {
  registerAuthHandler('twitch', async ({ code, state, error }) => {
    if (error) {
      reportAuthResult('twitch', false, error);
      return undefined;
    }
    try {
      const user = await twitchAuth.completeAuth(code, state);
      logger.success('auth', `Twitch verbunden als ${user.login}`);
      startTwitchServices({ restart: true });
      reportAuthResult('twitch', true, `Verbunden als ${user.displayName}`);
      return {
        message: `Twitch verbunden als ${user.displayName}. Du kannst dieses Fenster schließen.`
      };
    } catch (err) {
      reportAuthResult('twitch', false, errorMessage(err));
      throw err;
    }
  });

  registerAuthHandler('spotify', async ({ code, state, error }) => {
    if (error) {
      reportAuthResult('spotify', false, error);
      return undefined;
    }
    try {
      const user = await spotify.completeAuth(code, state);
      logger.success('auth', `Spotify verbunden als ${user.displayName}`);
      reportAuthResult('spotify', true, `Verbunden als ${user.displayName}`);
      return {
        message: `Spotify verbunden als ${user.displayName}. Du kannst dieses Fenster schließen.`
      };
    } catch (err) {
      reportAuthResult('spotify', false, errorMessage(err));
      throw err;
    }
  });

  twitchAuth.twitchAuthEvents.on('lost', () => {
    stopEventSub();
    resetVotes();
    emitStatus();
  });

  startAuthServer();
  logger.info('app', 'Anwendung gestartet');

  await validateTwitch('App-Start');
  setInterval(() => validateTwitch('stündlich'), HOUR);
  await startupSpotify();
  emitStatus();
}

export function startAuth(provider) {
  const url = provider === 'twitch' ? twitchAuth.createAuthUrl() : spotify.createAuthUrl();
  logger.info('auth', `${provider}: Autorisierung im Browser gestartet`);
  return shell.openExternal(url);
}

export async function disconnect(provider) {
  if (provider === 'twitch') await twitchAuth.disconnect();
  else await spotify.disconnect();
  logger.info('auth', `${provider}: Verbindung getrennt`);
  emitStatus();
}

export async function setCredentials(provider, values) {
  const store = getStore(provider === 'twitch' ? 'twitchAuth' : 'spotifyAuth');
  const clientId = String(values.clientId ?? '').trim();
  const clientSecret = String(values.clientSecret ?? '').trim();

  const changed =
    clientId !== store.get('clientId', '') ||
    (provider === 'twitch' && clientSecret !== store.get('clientSecret', ''));
  if (changed && store.get('refreshToken')) await disconnect(provider);

  store.set('clientId', clientId);
  if (provider === 'twitch') store.set('clientSecret', clientSecret);
  logger.info('app', `${provider}: Zugangsdaten gespeichert`);
  emitStatus();
}

export function getCredentials(provider) {
  const store = getStore(provider === 'twitch' ? 'twitchAuth' : 'spotifyAuth');
  return {
    clientId: store.get('clientId', ''),
    ...(provider === 'twitch' ? { clientSecret: store.get('clientSecret', '') } : {})
  };
}

export function updateSettings(section, value) {
  const saved = saveSettings(section, value);
  logger.info('app', `Einstellungen gespeichert: ${section}`);
  if (section === 'skip') resetVotes();
  if (
    (section === 'songRequest' || section === 'skip') &&
    twitchAuth.hasSession() &&
    getSettings('app').setupCompleted
  ) {
    syncRewards({ recreate: true });
  }
  return saved;
}

export function completeSetup() {
  saveSettings('app', { setupCompleted: true });
  logger.success('app', 'Einrichtung abgeschlossen');
  if (twitchAuth.hasSession()) startTwitchServices();
}

export async function resyncRewards() {
  if (!twitchAuth.hasSession()) throw new Error('Twitch ist nicht verbunden');
  await twitchAuth.ensureValidToken();
  await syncRewards({ recreate: true });
}

export async function removeReward(key) {
  if (!twitchAuth.hasSession()) throw new Error('Twitch ist nicht verbunden');
  await twitchAuth.ensureValidToken();
  await deleteRewardByKey(key);
}

export const getRewards = listRewards;

export function getAppState() {
  return { status: getStatus(), skip: getSkipState() };
}
