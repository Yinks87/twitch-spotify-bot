import { app } from 'electron';
import { autoUpdater } from 'electron-updater';
import { flushLogs, logger } from './logger';
import { errorMessage } from './template';

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

  autoUpdater.on('checking-for-update', () => logger.info('update', 'Suche nach Updates'));
  autoUpdater.on('update-not-available', () =>
    logger.info('update', `Kein Update verfügbar (Version ${app.getVersion()})`)
  );
  autoUpdater.on('update-available', (info) =>
    logger.info('update', `Update ${info.version} gefunden, Download läuft`)
  );
  autoUpdater.on('update-downloaded', (info) => {
    logger.success('update', `Update ${info.version} geladen, Installation und Neustart`);
    flushLogs();
    autoUpdater.quitAndInstall(true, true);
  });
  autoUpdater.on('error', (error) =>
    logger.error('update', `Update fehlgeschlagen: ${errorMessage(error)}`)
  );

  autoUpdater.checkForUpdates().catch((error) => {
    logger.error('update', `Update-Prüfung fehlgeschlagen: ${errorMessage(error)}`);
  });
}
