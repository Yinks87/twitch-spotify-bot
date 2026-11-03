import { randomBytes } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { getStore } from '../../store';
import { logger } from '../logger';
import { errorMessage } from '../template';
import { emitStatus, patchRuntime } from '../status';

export const TWITCH_REDIRECT_URI = 'http://localhost:3131/auth/twitch/callback';
export const TWITCH_SCOPES = [
  'channel:manage:redemptions',
  'bits:read',
  'user:write:chat',
  'user:read:chat'
];

// Wird mit 'lost' ausgelöst, sobald keine gültige Twitch-Sitzung mehr existiert.
export const twitchAuthEvents = new EventEmitter();

export class TwitchAuthError extends Error {}

const auth = () => getStore('twitchAuth');
let pendingState = null;
let inflight = null;

export function isConfigured() {
  return Boolean(auth().get('clientId') && auth().get('clientSecret'));
}

export function hasSession() {
  return Boolean(auth().get('refreshToken'));
}

export function getAccessToken() {
  return auth().get('accessToken', '');
}

export function getIdentity() {
  const user = auth().get('user', null);
  if (!user) throw new TwitchAuthError('Twitch-Benutzer unbekannt');
  return user;
}

export function createAuthUrl() {
  if (!isConfigured()) throw new Error('Twitch Client-ID und Client-Secret fehlen');
  pendingState = randomBytes(16).toString('hex');
  const params = new URLSearchParams({
    client_id: auth().get('clientId'),
    redirect_uri: TWITCH_REDIRECT_URI,
    response_type: 'code',
    scope: TWITCH_SCOPES.join(' '),
    state: pendingState,
    force_verify: 'true'
  });
  return `https://id.twitch.tv/oauth2/authorize?${params}`;
}

async function tokenRequest(params) {
  const response = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: auth().get('clientId'),
      client_secret: auth().get('clientSecret'),
      ...params
    })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new TwitchAuthError(
      data.message || `Token-Anfrage fehlgeschlagen (${response.status})`
    );
    error.status = response.status;
    throw error;
  }
  return data;
}

function saveTokens(tokens) {
  auth().set({
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: Date.now() + (tokens.expires_in ?? 0) * 1000
  });
}

async function validateRemote(token) {
  const response = await fetch('https://id.twitch.tv/oauth2/validate', {
    headers: { Authorization: `OAuth ${token}` }
  });
  const data = response.ok ? await response.json() : null;
  return { ok: response.ok, status: response.status, data };
}

function applyValidation(data) {
  const missingScopes = TWITCH_SCOPES.filter((scope) => !data.scopes?.includes(scope));
  auth().set({
    user: { id: data.user_id, login: data.login, displayName: data.login },
    scopes: data.scopes ?? [],
    expiresAt: Date.now() + (data.expires_in ?? 0) * 1000
  });
  if (missingScopes.length) {
    logger.warn('twitch', `Fehlende Scopes: ${missingScopes.join(', ')}. Bitte neu verbinden.`);
  }
  patchRuntime('twitch', { lastValidatedAt: Date.now(), error: null, missingScopes });
}

export async function completeAuth(code, state) {
  if (!pendingState || state !== pendingState) {
    throw new TwitchAuthError('Ungültiger State - bitte den Vorgang erneut starten');
  }
  pendingState = null;
  const tokens = await tokenRequest({
    grant_type: 'authorization_code',
    code,
    redirect_uri: TWITCH_REDIRECT_URI
  });
  saveTokens(tokens);
  const validation = await validateRemote(tokens.access_token);
  if (!validation.ok) throw new TwitchAuthError('Neues Token konnte nicht validiert werden');
  auth().set({ authorizedAt: Date.now() });
  applyValidation(validation.data);

  // Anzeigenamen nachladen (validate liefert nur den Login).
  try {
    const response = await fetch(
      `https://api.twitch.tv/helix/users?id=${validation.data.user_id}`,
      {
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
          'Client-Id': auth().get('clientId')
        }
      }
    );
    const displayName = (await response.json()).data?.[0]?.display_name;
    if (displayName) auth().set('user.displayName', displayName);
  } catch {
    // Anzeigename ist optional
  }
  emitStatus();
  return auth().get('user');
}

export function invalidateSession(reason) {
  auth().set({ accessToken: '', refreshToken: '', expiresAt: 0 });
  patchRuntime('twitch', { error: reason, eventsub: 'disconnected' });
  twitchAuthEvents.emit('lost', reason);
}

async function refresh() {
  try {
    const tokens = await tokenRequest({
      grant_type: 'refresh_token',
      refresh_token: auth().get('refreshToken')
    });
    saveTokens(tokens);
    logger.info('twitch', 'Access-Token wurde erneuert');
    return tokens.access_token;
  } catch (error) {
    if (error.status === 400 || error.status === 401) {
      logger.error(
        'twitch',
        `Token-Refresh abgelehnt, neue Autorisierung nötig: ${errorMessage(error)}`
      );
      invalidateSession('Neue Autorisierung erforderlich');
      throw new TwitchAuthError('Twitch-Sitzung abgelaufen - bitte neu verbinden');
    }
    throw error;
  }
}

async function ensure() {
  const token = getAccessToken();
  if (!token && !hasSession()) throw new TwitchAuthError('Twitch ist nicht verbunden');
  if (token) {
    const result = await validateRemote(token);
    if (result.ok) {
      if (result.data.client_id !== auth().get('clientId')) {
        invalidateSession('Token gehört zu einer anderen Client-ID');
        throw new TwitchAuthError('Token gehört zu einer anderen Client-ID');
      }
      applyValidation(result.data);
      return token;
    }
    if (result.status !== 401) {
      throw new Error(`Token-Validierung fehlgeschlagen (HTTP ${result.status})`);
    }
    logger.warn('twitch', 'Access-Token ist ungültig, versuche Refresh');
  }
  const refreshed = await refresh();
  const result = await validateRemote(refreshed);
  if (result.ok) applyValidation(result.data);
  return refreshed;
}

// Validiert das Token bei Twitch und erneuert es bei Bedarf. Parallele Aufrufe teilen sich eine Anfrage.
export function ensureValidToken() {
  if (!inflight) {
    inflight = ensure().finally(() => {
      inflight = null;
    });
  }
  return inflight;
}

export function disconnect() {
  const token = getAccessToken();
  const clientId = auth().get('clientId');
  auth().set({
    accessToken: '',
    refreshToken: '',
    expiresAt: 0,
    scopes: [],
    user: null,
    authorizedAt: null
  });
  patchRuntime('twitch', {
    error: null,
    eventsub: 'disconnected',
    missingScopes: [],
    lastValidatedAt: null
  });
  twitchAuthEvents.emit('lost', 'disconnected');

  // Das Widerrufen ist Best-Effort und blockiert die Oberfläche nicht.
  if (token) {
    fetch('https://id.twitch.tv/oauth2/revoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: clientId, token }),
      signal: AbortSignal.timeout(5000)
    }).catch(() => {});
  }
}
