import { getStore } from '../store';
import { broadcast } from './events';

const runtime = {
  twitch: { eventsub: 'disconnected', lastValidatedAt: null, error: null, missingScopes: [] },
  spotify: { error: null }
};

export function patchRuntime(platform, patch) {
  Object.assign(runtime[platform], patch);
  emitStatus();
}

export function getStatus() {
  const twitch = getStore('twitchAuth');
  const spotify = getStore('spotifyAuth');
  const reauthAt = spotify.get('refreshTokenExpiresAt', null);
  const day = 24 * 60 * 60 * 1000;

  return {
    twitch: {
      configured: Boolean(twitch.get('clientId') && twitch.get('clientSecret')),
      connected: Boolean(twitch.get('refreshToken')),
      user: twitch.get('user', null),
      authorizedAt: twitch.get('authorizedAt', null),
      ...runtime.twitch
    },
    spotify: {
      configured: Boolean(spotify.get('clientId')),
      connected: Boolean(spotify.get('refreshToken')),
      user: spotify.get('user', null),
      authorizedAt: spotify.get('authorizedAt', null),
      reauthAt,
      reauthInDays: reauthAt ? Math.ceil((reauthAt - Date.now()) / day) : null,
      ...runtime.spotify
    }
  };
}

export function emitStatus() {
  broadcast('status:update', getStatus());
}
