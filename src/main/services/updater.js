import { app } from 'electron';
import { autoUpdater } from 'electron-updater';
import { broadcast } from './events';
import { flushLogs, logger } from './logger';
import { errorMessage } from './template';

// status: idle | checking | available | downloading | downloaded | error
let state = { status: 'idle', version: null, percent: 0, error: null };

export const getUpdateState = () => state;

function setState(patch) {
  state = { ...state, ...patch };
  broadcast('update:state', state);
}

// Prüft beim Start auf Updates (GitHub-Releases, siehe electron-builder.yml), lädt sie
// automatisch herunter und installiert sie sofort. Im Entwicklungsmodus ist das deaktiviert.
export function initAutoUpdater() {
  if (!app.isPackaged) {
    logger.info('update', 'Update-Prüfung übersprungen (Entwicklungsmodus)');
    return;
  }

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.logger = null;

  autoUpdater.on('checking-for-update', () => {
    setState({ status: 'checking', error: null });
    logger.info('update', 'Suche nach Updates');
  });
  autoUpdater.on('update-not-available', () => {
    setState({ status: 'idle', version: null });
    logger.info('update', `Kein Update verfügbar (Version ${app.getVersion()})`);
  });
  autoUpdater.on('update-available', (info) => {
    setState({ status: 'available', version: info.version, percent: 0 });
    logger.info('update', `Update ${info.version} gefunden, Download läuft`);
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
