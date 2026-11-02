import { app, shell, BrowserWindow } from 'electron';
import { join } from 'path';
import { electronApp, optimizer, is } from '@electron-toolkit/utils';
import icon from '../../resources/icon.png?asset';
import { initializeStoreIpc } from './ipc/store-ipc';
import { initializeOAuthIpc } from './ipc/oauth-ipc';
import { initializeLogIpc } from './ipc/log-ipc';
import { initializeRewardIpc } from './ipc/reward-ipc';
import { initBot } from './services/bot';
import { initAutoUpdater } from './services/updater';
import { loadWindowState, trackWindowState } from './window-state';
import { flushLogs, logger } from './services/logger';
import { errorMessage } from './services/template';

function createWindow() {
  const { maximized, ...bounds } = loadWindowState();
  const mainWindow = new BrowserWindow({
    ...bounds,
    minWidth: 860,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    title: 'Twitch Spotify Bot',
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  });

  trackWindowState(mainWindow);
  if (maximized) mainWindow.maximize();

  mainWindow.on('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    if (/^https:\/\//i.test(details.url)) shell.openExternal(details.url);
    return { action: 'deny' };
  });

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

// Der OAuth-Callback-Server belegt Port 3131 – nur eine Instanz erlaubt.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const [window] = BrowserWindow.getAllWindows();
    if (window) {
      if (window.isMinimized()) window.restore();
      window.focus();
    }
  });

  app.whenReady().then(() => {
    electronApp.setAppUserModelId('com.yinks87.twitch-spotify-bot');

    app.on('browser-window-created', (_, window) => {
      optimizer.watchWindowShortcuts(window);
    });

    initializeStoreIpc();
    initializeOAuthIpc();
    initializeLogIpc();
    initializeRewardIpc();

    createWindow();
    initAutoUpdater();
    initBot().catch((error) => logger.error('app', `Start fehlgeschlagen: ${errorMessage(error)}`));

    app.on('activate', function () {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('before-quit', flushLogs);

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
}
