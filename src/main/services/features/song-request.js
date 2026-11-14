import { getSettings } from '../../store';
import * as spotify from '../spotify';
import { logger } from '../logger';
import { parseSongInput } from '../song-parser';
import { errorMessage } from '../template';
import { say } from './chat-output';

function formatDuration(ms) {
  const totalSeconds = Math.round(ms / 1000);
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${Math.floor(totalSeconds / 60)}:${seconds} min`;
}

// Rückgabe: true, wenn der Song hinzugefügt wurde (Basis für Fulfill/Refund einer Einlösung).
export async function handleSongRequest({ userLogin, input, source }) {
  const settings = getSettings('songRequest');
  const text = (input ?? '').trim();
  logger.info('songrequest', `Song-Request von ${userLogin} (${source}): "${text}"`);

  const parsed = await parseSongInput(text);
  if (parsed.type === 'empty') {
    logger.warn('songrequest', `Request von ${userLogin} ohne Eingabe abgelehnt`);
    await say('noInput', { user: userLogin });
    return false;
  }
  if (parsed.type === 'unsupported') {
    logger.warn('songrequest', `Eingabe von ${userLogin} abgelehnt: ${parsed.reason}`);
    await say('songInvalid', { user: userLogin, reason: parsed.reason });
    return false;
  }

  try {
    const track =
      parsed.type === 'track'
        ? await spotify.getTrack(parsed.id)
        : await spotify.searchTrack(parsed.query);
    if (!track) {
      logger.warn('songrequest', `Kein Treffer für "${text}"`);
      await say('songNotFound', { user: userLogin });
      return false;
    }
    const vars = {
      user: userLogin,
      song: track.song,
      title: track.title,
      artist: track.artist,
      url: track.url
    };
    const maxMs = settings.maxDurationEnabled ? settings.maxDurationMinutes * 60000 : null;
    if (maxMs && track.durationMs > maxMs) {
      logger.warn(
        'songrequest',
        `${track.song} von ${userLogin} abgelehnt: ${formatDuration(track.durationMs)} überschreitet das Limit von ${formatDuration(maxMs)}`
      );
      await say('songTooLong', {
        ...vars,
        duration: formatDuration(track.durationMs),
        max: formatDuration(maxMs)
      });
      return false;
    }
    if (settings.target === 'playlist') {
      const playlistId = await spotify.resolvePlaylistId(settings.playlist);
      await spotify.addToPlaylist(playlistId, track);
      logger.success('songrequest', `${track.song} zur Playlist hinzugefügt (von ${userLogin})`, {
        playlistId
      });
      await say('songAddedPlaylist', vars);
    } else {
      await spotify.addToQueue(track);
      logger.success(
        'songrequest',
        `${track.song} zur Warteschlange hinzugefügt (von ${userLogin})`
      );
      await say('songAdded', vars);
    }
    return true;
  } catch (error) {
    logger.error(
      'songrequest',
      `Song-Request von ${userLogin} fehlgeschlagen: ${errorMessage(error)}`
    );
    await say('spotifyError', { user: userLogin, error: errorMessage(error) });
    return false;
  }
}
