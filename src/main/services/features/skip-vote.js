import { getSettings } from '../../store';
import { broadcast } from '../events';
import * as spotify from '../spotify';
import { logger } from '../logger';
import { errorMessage } from '../template';
import { say } from './chat-output';

let votes = new Set();
let timer = null;
let expiresAt = null;

export function getSkipState() {
  return { votes: votes.size, expiresAt };
}

function publish() {
  broadcast('skip:state', getSkipState());
}

export function resetVotes() {
  clearTimeout(timer);
  timer = null;
  votes = new Set();
  expiresAt = null;
  publish();
}

function startWindow(seconds) {
  expiresAt = Date.now() + seconds * 1000;
  timer = setTimeout(async () => {
    const { votesRequired } = getSettings('skip');
    const count = votes.size;
    logger.info(
      'skip',
      `Skip-Zeitfenster abgelaufen (${count}/${votesRequired}), Stimmen verworfen`
    );
    resetVotes();
    await say('skipExpired', { votes: count, required: votesRequired });
  }, seconds * 1000);
}

// Rückgabe: 'counted' | 'skipped' | 'duplicate' | 'nosong' | 'error'
export async function registerSkipVote({ userId, userLogin, source }) {
  const settings = getSettings('skip');
  const vars = { user: userLogin, required: settings.votesRequired };

  if (votes.has(userId)) {
    logger.info('skip', `${userLogin} hat bereits abgestimmt (${source})`);
    await say('skipAlreadyVoted', { ...vars, votes: votes.size });
    return 'duplicate';
  }

  try {
    if (!(await spotify.getCurrentlyPlaying())) {
      logger.warn('skip', `Skip-Stimme von ${userLogin} ignoriert: kein Song aktiv`);
      await say('skipNoSong', { ...vars, votes: votes.size });
      return 'nosong';
    }

    if (votes.size === 0) startWindow(settings.windowSeconds);
    votes.add(userId);
    logger.info(
      'skip',
      `Skip-Stimme von ${userLogin} (${votes.size}/${settings.votesRequired}, ${source})`
    );

    if (votes.size >= settings.votesRequired) {
      const count = votes.size;
      await spotify.skipToNext();
      resetVotes();
      logger.success('skip', `Song übersprungen (${count}/${settings.votesRequired} Stimmen)`);
      await say('skipSuccess', { ...vars, votes: count });
      return 'skipped';
    }

    publish();
    await say('skipVote', { ...vars, votes: votes.size });
    return 'counted';
  } catch (error) {
    logger.error('skip', `Skip fehlgeschlagen: ${errorMessage(error)}`);
    votes.delete(userId);
    if (votes.size === 0) resetVotes();
    await say('skipError', { ...vars, votes: votes.size, error: errorMessage(error) });
    return 'error';
  }
}
