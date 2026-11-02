import { getSettings } from '../../store';
import * as spotify from '../spotify';
import { logger } from '../logger';
import { errorMessage } from '../template';
import { isOwnMessage, say } from './chat-output';
import { registerSkipVote } from './skip-vote';

let lastNowPlayingAt = 0;

async function handleNowPlaying(event, nowPlaying) {
  const remaining = nowPlaying.cooldownSeconds * 1000 - (Date.now() - lastNowPlayingAt);
  if (remaining > 0) {
    logger.info(
      'chat',
      `Command ${nowPlaying.command} von ${event.chatter_user_login} im Cooldown (${Math.ceil(remaining / 1000)}s)`
    );
    return;
  }
  lastNowPlayingAt = Date.now();
  logger.info('chat', `Command ${nowPlaying.command} von ${event.chatter_user_login}`);

  try {
    const track = await spotify.getCurrentlyPlaying();
    if (!track) {
      await say('noSong', { user: event.chatter_user_login });
      return;
    }
    await say('nowPlaying', {
      user: event.chatter_user_login,
      song: track.song,
      title: track.title,
      artist: track.artist,
      url: track.url
    });
  } catch (error) {
    logger.error('spotify', `Aktuellen Song abrufen fehlgeschlagen: ${errorMessage(error)}`);
  }
}

export async function handleChatMessage(event) {
  const text = event.message?.text?.trim();
  if (!text || isOwnMessage(event.message_id)) return;

  const command = text.split(/\s+/)[0].toLowerCase();
  const { nowPlaying } = getSettings('chat');
  const skip = getSettings('skip');

  if (nowPlaying.enabled && command === nowPlaying.command.toLowerCase()) {
    await handleNowPlaying(event, nowPlaying);
  } else if (skip.enabled && skip.mode === 'command' && command === skip.command.toLowerCase()) {
    await registerSkipVote({
      userId: event.chatter_user_id,
      userLogin: event.chatter_user_login,
      source: 'Chat-Command'
    });
  }
}
