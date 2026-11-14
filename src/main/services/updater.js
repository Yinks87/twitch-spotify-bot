import { app } from 'electron';
import { autoUpdater } from 'electron-updater';
import { broadcast } from './events';
import { flushLogs, logger } from './logger';
import { errorMessage } from './template';
import { showWindow } from '../lifecycle';

const RELEASES_API = 'https://api.github.com/repos/yinks87/twitch-spotify-bot/releases/tags';

// status: idle | checking | available (wartet auf Bestätigung) | downloading | downloaded | error
let state = { status: 'idle', version: null, notes: '', percent: 0, error: null };

export const getUpdateState = () => state;

function setState(patch) {
  state = { ...state, ...patch };
  broadcast('update:state', state);
}

// Fallback, falls die GitHub-API nicht erreichbar ist: der Feed liefert die Notizen als HTML.
function notesFromInfo(info) {
  const raw = Array.isArray(info.releaseNotes)
    ? info.releaseNotes.map((entry) => entry.note).join('\n\n')
    : (info.releaseNotes ?? '');
  return String(raw)
    .replace(/<\s*(br|\/p|\/li|\/h\d)\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

// Die Patchnotes (Markdown) stammen aus dem GitHub-Release des Updates.
async function loadReleaseNotes(info) {
  try {
    const response = await fetch(`${RELEASES_API}/v${info.version}`, {
      headers: { Accept: 'application/vnd.github+json' },
      signal: AbortSignal.timeout(8000)
    });
    if (response.ok) {
      const body = (await response.json()).body;
      if (typeof body === 'string' && body.trim()) return body;
    }
  } catch (error) {
    logger.warn('update', `Patchnotes nicht abrufbar: ${errorMessage(error)}`);
  }
  return notesFromInfo(info);
}

// Lädt das Update erst nach Bestätigung der Patchnotes herunter.
export function confirmUpdate() {
  if (state.status !== 'available') return;
  setState({ status: 'downloading', percent: 0 });
  logger.info('update', `Patchnotes von ${state.version} bestätigt, Download läuft`);
  autoUpdater.downloadUpdate().catch((error) => {
    setState({ status: 'error', error: errorMessage(error) });
    logger.error('update', `Update-Download fehlgeschlagen: ${errorMessage(error)}`);
  });
}

// Prüft beim Start auf Updates (GitHub-Releases, siehe electron-builder.yml). Nach der
// Bestätigung der Patchnotes wird das Update geladen und sofort installiert.
// Im Entwicklungsmodus ist das deaktiviert.
export function initAutoUpdater() {
  if (!app.isPackaged) {
    logger.info('update', 'Update-Prüfung übersprungen (Entwicklungsmodus)');
    return;
  }

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.logger = null;

  autoUpdater.on('checking-for-update', () => {
    setState({ status: 'checking', error: null });
    logger.info('update', 'Suche nach Updates');
  });
  autoUpdater.on('update-not-available', () => {
    setState({ status: 'idle', version: null, notes: '' });
    logger.info('update', `Kein Update verfügbar (Version ${app.getVersion()})`);
  });
  autoUpdater.on('update-available', async (info) => {
    const notes = await loadReleaseNotes(info);
    setState({ status: 'available', version: info.version, notes, percent: 0 });
    logger.info('update', `Update ${info.version} gefunden, warte auf Bestätigung`);
    showWindow();
  });
  autoUpdater.on('download-progress', (progress) =>
    setState({ status: 'downloading', percent: Math.round(progress.percent) })
  );
  autoUpdater.on('update-downloaded', (info) => {
    setState({ status: 'downloaded', version: info.version, percent: 100 });
    logger.success('update', `Update ${info.version} geladen, Installation und Neustart`);
    flushLogs();
    autoUpdater.quitAndInstall(false, true);
  });
  autoUpdater.on('error', (error) => {
    setState({ status: 'error', error: errorMessage(error) });
    logger.error('update', `Update fehlgeschlagen: ${errorMessage(error)}`);
  });

  autoUpdater.checkForUpdates().catch((error) => {
    logger.error('update', `Update-Prüfung fehlgeschlagen: ${errorMessage(error)}`);
  });
}
