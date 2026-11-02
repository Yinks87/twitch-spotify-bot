import { createHash, randomBytes } from 'node:crypto';
import { getStore } from '../store';
import { logger } from './logger';
import { errorMessage } from './template';
import { emitStatus, patchRuntime } from './status';

export const SPOTIFY_REDIRECT_URI = 'http://127.0.0.1:3131/auth/spotify/callback';
export const SPOTIFY_SCOPES = [
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-currently-playing',
  'playlist-modify-public',
  'playlist-modify-private'
];

const API_URL = 'https://api.spotify.com/v1';
const TOKEN_URL = 'https://accounts.spotify.com/api/token';
const REFRESH_TOKEN_LIFETIME_MONTHS = 6;

export class SpotifyError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

const auth = () => getStore('spotifyAuth');
let pending = null;
let inflightRefresh = null;

export function isConfigured() {
  return Boolean(auth().get('clientId'));
}

export function isConnected() {
  return Boolean(auth().get('refreshToken'));
}

const base64Url = (buffer) => buffer.toString('base64url');

export function createAuthUrl() {
  if (!isConfigured()) throw new Error('Spotify Client-ID fehlt');
  const verifier = base64Url(randomBytes(64));
  const state = randomBytes(16).toString('hex');
  pending = { state, verifier };
  const params = new URLSearchParams({
    client_id: auth().get('clientId'),
    response_type: 'code',
    redirect_uri: SPOTIFY_REDIRECT_URI,
    scope: SPOTIFY_SCOPES.join(' '),
    state,
    code_challenge_method: 'S256',
    code_challenge: base64Url(createHash('sha256').update(verifier).digest()),
    show_dialog: 'true'
  });
  return `https://accounts.spotify.com/authorize?${params}`;
}

async function tokenRequest(params) {
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: auth().get('clientId'), ...params })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new SpotifyError(
      data.error_description || data.error || 'Token-Anfrage fehlgeschlagen',
      response.status
    );
  }
  return data;
}

function saveTokens(tokens) {
  auth().set({
    accessToken: tokens.access_token,
    expiresAt: Date.now() + tokens.expires_in * 1000,
    ...(tokens.refresh_token ? { refreshToken: tokens.refresh_token } : {}),
    ...(tokens.scope ? { scopes: tokens.scope.split(' ') } : {})
  });
}

export async function completeAuth(code, state) {
  if (!pending || state !== pending.state) {
    throw new SpotifyError('Ungültiger State – bitte den Vorgang erneut starten');
  }
  const { verifier } = pending;
  pending = null;
  const tokens = await tokenRequest({
    grant_type: 'authorization_code',
    code,
    redirect_uri: SPOTIFY_REDIRECT_URI,
    code_verifier: verifier
  });
  saveTokens(tokens);

  const now = new Date();
  const expires = new Date(now);
  expires.setMonth(expires.getMonth() + REFRESH_TOKEN_LIFETIME_MONTHS);
  auth().set({ authorizedAt: now.getTime(), refreshTokenExpiresAt: expires.getTime() });

  const profile = await request('GET', '/me');
  auth().set('user', { id: profile.id, displayName: profile.display_name || profile.id });
  patchRuntime('spotify', { error: null });
  emitStatus();
  return auth().get('user');
}

async function refreshAccessToken() {
  try {
    const tokens = await tokenRequest({
      grant_type: 'refresh_token',
      refresh_token: auth().get('refreshToken')
    });
    saveTokens(tokens);
    logger.info('spotify', 'Access-Token wurde erneuert');
    patchRuntime('spotify', { error: null });
    return tokens.access_token;
  } catch (error) {
    if (error.status === 400 || error.status === 401) {
      logger.error(
        'spotify',
        `Refresh-Token ungültig, neue Autorisierung nötig: ${errorMessage(error)}`
      );
      auth().set({ accessToken: '', refreshToken: '', expiresAt: 0 });
      patchRuntime('spotify', { error: 'Neue Autorisierung erforderlich' });
      throw new SpotifyError('Spotify-Sitzung abgelaufen – bitte neu verbinden', 401);
    }
    throw error;
  }
}

export async function getAccessToken(forceRefresh = false) {
  if (!isConnected()) throw new SpotifyError('Spotify ist nicht verbunden', 401);
  const token = auth().get('accessToken');
  if (!forceRefresh && token && auth().get('expiresAt', 0) - 60000 > Date.now()) return token;
  if (!inflightRefresh) {
    inflightRefresh = refreshAccessToken().finally(() => {
      inflightRefresh = null;
    });
  }
  return inflightRefresh;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function request(method, path, { query, body } = {}, attempt = 0) {
  const url = new URL(`${API_URL}${path}`);
  for (const [key, value] of Object.entries(query ?? {})) url.searchParams.set(key, value);

  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${await getAccessToken()}`,
      ...(body ? { 'Content-Type': 'application/json' } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });

  if (response.status === 401 && attempt === 0) {
    await getAccessToken(true);
    return request(method, path, { query, body }, attempt + 1);
  }
  if (response.status === 429 && attempt < 2) {
    await sleep(Math.min(Number(response.headers.get('retry-after')) || 1, 10) * 1000);
    return request(method, path, { query, body }, attempt + 1);
  }
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new SpotifyError(describeError(response.status, data.error), response.status);
  }
  if (response.status === 204) return null;
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    // Schreibende Aufrufe liefern teils keinen JSON-Body; der erfolgreiche HTTP-Status genügt dann.
    if (method !== 'GET') return null;
    logger.error(
      'spotify',
      `Unerwartete Antwort auf ${method} ${path} (HTTP ${response.status}, ${response.headers.get('content-type')}): ${text.slice(0, 60)}`
    );
    throw new SpotifyError(`Unerwartete Antwort von Spotify (${path})`, response.status);
  }
}

function describeError(status, error) {
  const reason = error?.reason;
  if (status === 404 && reason === 'NO_ACTIVE_DEVICE') return 'Kein aktives Spotify-Gerät';
  if (status === 403 && reason === 'PREMIUM_REQUIRED') return 'Spotify Premium erforderlich';
  if (status === 429) return 'Spotify-Ratenlimit erreicht';
  return error?.message || `Spotify-Fehler (HTTP ${status})`;
}

export async function disconnect() {
  auth().set({
    accessToken: '',
    refreshToken: '',
    expiresAt: 0,
    scopes: [],
    user: null,
    authorizedAt: null,
    refreshTokenExpiresAt: null
  });
  patchRuntime('spotify', { error: null });
}

// --- Track-/Playlist-Auflösung -------------------------------------------------

const PLAYLIST_ID = /^[A-Za-z0-9]{22}$/;

function toTrack(item) {
  const artist = (item.artists ?? []).map((a) => a.name).join(', ');
  return {
    id: item.id,
    uri: item.uri,
    title: item.name,
    artist,
    song: artist ? `${item.name} - ${artist}` : item.name,
    url: item.external_urls?.spotify ?? `https://open.spotify.com/track/${item.id}`
  };
}

export async function searchTrack(query) {
  const result = await request('GET', '/search', {
    query: { q: query, type: 'track', limit: '1' }
  });
  const item = result?.tracks?.items?.[0];
  return item ? toTrack(item) : null;
}

export async function getTrack(id) {
  try {
    return toTrack(await request('GET', `/tracks/${id}`));
  } catch (error) {
    if (error.status === 404) return null;
    if (error.status === 401 || error.status === 403) throw error;
    // Metadaten sind nur für die Chatnachricht nötig – der Song kann trotzdem eingereiht werden.
    logger.warn('spotify', `Track-Details nicht abrufbar, verwende Link: ${errorMessage(error)}`);
    const url = `https://open.spotify.com/track/${id}`;
    return { id, uri: `spotify:track:${id}`, title: url, artist: '', song: url, url };
  }
}

export async function getCurrentlyPlaying() {
  const data = await request('GET', '/me/player/currently-playing', {
    query: { additional_types: 'episode' }
  });
  if (!data?.item || !data.is_playing) return null;
  const item = data.item;
  if (item.type === 'episode') {
    const title = item.name ?? '';
    const artist = item.show?.name ?? '';
    return {
      title,
      artist,
      song: artist ? `${title} - ${artist}` : title,
      url: item.external_urls?.spotify ?? ''
    };
  }
  return toTrack(item);
}
export async function addToQueue(track) {
  await request('POST', '/me/player/queue', { query: { uri: track.uri } });
}

export async function resolvePlaylistId(setting) {
  const value = setting.trim();
  if (value) {
    const id =
      value.match(/spotify:playlist:([A-Za-z0-9]{22})/i)?.[1] ??
      value.match(/open\.spotify\.com\/(?:intl-[a-z-]+\/)?playlist\/([A-Za-z0-9]{22})/i)?.[1] ??
      (PLAYLIST_ID.test(value) ? value : null);
    if (!id) throw new SpotifyError('Ungültige Playlist-Angabe', 400);
    return id;
  }
  const playback = await request('GET', '/me/player');
  if (playback?.context?.type !== 'playlist') {
    throw new SpotifyError('Es läuft aktuell keine Playlist', 400);
  }
  return playback.context.uri.split(':').pop();
}
export async function addToPlaylist(playlistId, track) {
  await request('POST', `/playlists/${playlistId}/items`, { body: { uris: [track.uri] } });
}

export async function skipToNext() {
  await request('POST', '/me/player/next');
}
