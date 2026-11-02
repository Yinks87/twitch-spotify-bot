import { randomUUID } from 'node:crypto';
import { getStore } from '../store';
import { broadcast } from './events';

const MAX_ENTRIES = 1000;
let entries = null;
let flushTimer = null;

function load() {
  if (!entries) entries = getStore('actionLog').get('entries', []);
  return entries;
}

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(flushLogs, 1000);
}

export function flushLogs() {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = null;
  if (entries) getStore('actionLog').set('entries', entries);
}

// Niemals Tokens/Secrets in message oder details übergeben.
export function log(level, source, message, details) {
  const entry = {
    id: randomUUID(),
    ts: Date.now(),
    level,
    source,
    message,
    ...(details !== undefined ? { details } : {})
  };
  const list = load();
  list.push(entry);
  if (list.length > MAX_ENTRIES) list.splice(0, list.length - MAX_ENTRIES);
  scheduleFlush();
  broadcast('log:entry', entry);
  console.log(`[${level}] [${source}] ${message}`);
}

export const logger = {
  info: (source, message, details) => log('info', source, message, details),
  success: (source, message, details) => log('success', source, message, details),
  warn: (source, message, details) => log('warn', source, message, details),
  error: (source, message, details) => log('error', source, message, details)
};

export function getLogs() {
  return [...load()];
}

export function clearLogs() {
  entries = [];
  flushLogs();
  logger.info('app', 'Action-Log geleert');
}
