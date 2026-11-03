import { logger } from '../logger';
import { errorMessage } from '../template';
import { patchRuntime } from '../status';
import { createSubscription } from './api';
import { ensureValidToken, getIdentity } from './auth';
import { EVENT_CHAT, EVENT_POWERUP, EVENT_REDEMPTION } from './events';

const WS_URL = 'wss://eventsub.wss.twitch.tv/ws';
const MAX_SEEN = 200;

let handlers = {};
let current = null;
let stopped = true;
let retries = 0;
let retryTimer = null;
const seen = new Set();

function buildSubscriptions() {
  const { id } = getIdentity();
  return [
    [EVENT_CHAT, '1', { broadcaster_user_id: id, user_id: id }],
    [EVENT_REDEMPTION, '1', { broadcaster_user_id: id }],
    [EVENT_POWERUP, '1', { broadcaster_user_id: id }]
  ];
}

function setState(state) {
  patchRuntime('twitch', { eventsub: state });
}

function closeConnection(conn) {
  if (!conn) return;
  conn.dead = true;
  clearTimeout(conn.watchdog);
  try {
    conn.ws.close();
  } catch {
    // bereits geschlossen
  }
}

function armWatchdog(conn) {
  clearTimeout(conn.watchdog);
  // Twitch erwartet, dass innerhalb von keepalive_timeout_seconds irgendeine Nachricht eintrifft.
  conn.watchdog = setTimeout(
    () => {
      logger.warn('twitch', 'EventSub: Keepalive-Timeout, Verbindung wird neu aufgebaut');
      dropConnection(conn);
    },
    (conn.keepaliveSeconds + 5) * 1000
  );
}

function dropConnection(conn) {
  const wasCurrent = conn === current;
  closeConnection(conn);
  if (wasCurrent) {
    current = null;
    if (!stopped) scheduleReconnect();
  }
}

function scheduleReconnect() {
  clearTimeout(retryTimer);
  setState('connecting');
  const delay = Math.min(60000, 2000 * 2 ** retries);
  retries += 1;
  retryTimer = setTimeout(async () => {
    if (stopped) return;
    try {
      await ensureValidToken();
      open(WS_URL, false);
    } catch (error) {
      logger.error('twitch', `EventSub-Wiederverbindung fehlgeschlagen: ${errorMessage(error)}`);
      if (!stopped) scheduleReconnect();
    }
  }, delay);
}

async function subscribeAll(conn) {
  let failed = 0;
  for (const [type, version, condition] of buildSubscriptions()) {
    try {
      await createSubscription(type, version, condition, conn.sessionId);
      logger.info('twitch', `EventSub-Abo erstellt: ${type}`);
    } catch (error) {
      failed += 1;
      logger.error('twitch', `EventSub-Abo ${type} fehlgeschlagen: ${errorMessage(error)}`);
    }
  }
  return failed;
}

async function onWelcome(conn, message, isReconnect) {
  conn.sessionId = message.payload.session.id;
  conn.keepaliveSeconds = message.payload.session.keepalive_timeout_seconds ?? 10;
  armWatchdog(conn);

  if (isReconnect) {
    const old = current;
    current = conn;
    closeConnection(old);
    logger.info('twitch', 'EventSub: Verbindung zu neuem Server gewechselt');
    setState('connected');
    return;
  }

  current = conn;
  retries = 0;
  const failed = await subscribeAll(conn);
  if (conn.dead) return;
  setState(failed ? 'error' : 'connected');
  if (!failed) logger.success('twitch', 'EventSub verbunden');
}

function onMessage(conn, message, isReconnect) {
  const type = message.metadata?.message_type;
  if (conn.dead) return;
  if (type !== 'session_welcome') armWatchdog(conn);

  switch (type) {
    case 'session_welcome':
      onWelcome(conn, message, isReconnect).catch((error) =>
        logger.error('twitch', `EventSub-Initialisierung fehlgeschlagen: ${errorMessage(error)}`)
      );
      break;
    case 'session_reconnect':
      logger.info('twitch', 'EventSub: Server verlangt Reconnect');
      open(message.payload.session.reconnect_url, true);
      break;
    case 'notification': {
      const id = message.metadata.message_id;
      if (seen.has(id)) return;
      seen.add(id);
      if (seen.size > MAX_SEEN) seen.delete(seen.values().next().value);
      Promise.resolve(
        handlers.onNotification?.(message.metadata.subscription_type, message.payload.event)
      ).catch((error) =>
        logger.error('twitch', `Fehler bei Event-Verarbeitung: ${errorMessage(error)}`)
      );
      break;
    }
    case 'revocation': {
      const { type: subType, status } = message.payload.subscription;
      logger.error('twitch', `EventSub: ${subType} widerrufen (${status})`);
      setState('error');
      break;
    }
    default:
      break;
  }
}

function open(url, isReconnect) {
  if (!isReconnect) setState('connecting');
  const conn = { ws: new WebSocket(url), dead: false, sessionId: null, keepaliveSeconds: 10 };
  if (!isReconnect) current = conn;

  conn.ws.addEventListener('message', (event) => {
    try {
      onMessage(conn, JSON.parse(event.data), isReconnect);
    } catch (error) {
      logger.error('twitch', `Ungültige EventSub-Nachricht: ${errorMessage(error)}`);
    }
  });
  conn.ws.addEventListener('close', () => {
    if (!conn.dead) dropConnection(conn);
  });
  conn.ws.addEventListener('error', () => {
    logger.warn('twitch', 'EventSub: WebSocket-Fehler');
  });
}

export function startEventSub(newHandlers) {
  handlers = newHandlers;
  if (!stopped) return;
  stopped = false;
  retries = 0;
  open(WS_URL, false);
}

export function stopEventSub() {
  stopped = true;
  clearTimeout(retryTimer);
  closeConnection(current);
  current = null;
  setState('disconnected');
}

export function isEventSubRunning() {
  return !stopped;
}
