import { app } from 'electron';
import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'fs';
import { join } from 'path';

export const STORE_DIR = join(app.getPath('userData'), 'store');

const legacyPath = (name) => join(app.getPath('userData'), `${name}.json`);
const storePath = (name) => join(STORE_DIR, `${name}.json`);

// Liest eine Legacy-Datei: null = nicht vorhanden, undefined = nicht lesbar (bleibt unangetastet).
function readLegacy(name) {
  const file = legacyPath(name);
  if (!existsSync(file)) return null;
  try {
    const data = JSON.parse(readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
    return data !== null && typeof data === 'object' && !Array.isArray(data) ? data : undefined;
  } catch {
    return undefined;
  }
}

function writeStore(name, data) {
  mkdirSync(STORE_DIR, { recursive: true });
  const target = storePath(name);
  const temp = `${target}.tmp`;
  writeFileSync(temp, JSON.stringify(data, undefined, '\t'));
  renameSync(temp, target);
}

function removeLegacy(name) {
  try {
    unlinkSync(legacyPath(name));
  } catch {
    // Datei ist bereits entfernt oder gesperrt - die Migration wird beim nächsten Start wiederholt.
  }
}

const pickWindow = ({ width, height, x, y, maximized } = {}) => ({
  width,
  height,
  x,
  y,
  maximized
});

// Ein neues Zielfile gilt als abgeschlossene Migration: dann wird nur noch aufgeräumt.
function migrate(target, legacyNames, build) {
  const sources = legacyNames.map((name) => [name, readLegacy(name)]);
  if (!existsSync(storePath(target))) {
    if (sources.every(([, data]) => data === null)) return;
    if (sources.some(([, data]) => data === undefined)) return;
    writeStore(target, build(Object.fromEntries(sources)));
  }
  for (const [name, data] of sources) {
    if (data !== undefined) removeLegacy(name);
  }
}

// Verschiebt die bisherigen Stores aus dem AppData-Ordner in den Unterordner "store":
// twitch-auth + spotify-auth -> auth, window -> app.window. Danach werden die alten Dateien gelöscht.
export function migrateLegacyStores() {
  mkdirSync(STORE_DIR, { recursive: true });

  for (const name of ['song-request', 'skip', 'chat', 'rewards', 'action-log']) {
    migrate(name, [name], (sources) => sources[name]);
  }

  migrate('auth', ['twitch-auth', 'spotify-auth'], (sources) => ({
    twitch: sources['twitch-auth'] ?? {},
    spotify: sources['spotify-auth'] ?? {}
  }));

  migrate('app', ['app', 'window'], (sources) => ({
    ...(sources.app ?? {}),
    ...(sources.window ? { window: pickWindow(sources.window) } : {})
  }));
}
