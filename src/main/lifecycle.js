import { app, Menu, nativeImage, Tray } from 'electron';
import icon from '../../resources/icon.png?asset';
import { getSettings } from './store';

const HIDDEN_ARG = '--hidden';

let mainWindow = null;
let tray = null;
let windowHidden = false;
let quitting = false;

// Wird beim Autostart mit --hidden gestartet, bleibt das Fenster zunächst im Tray.
export const startedHidden = () => process.argv.includes(HIDDEN_ARG);

function syncTray() {
  const needed = getSettings('app').closeAction === 'tray' || windowHidden;
  if (needed && !tray) {
    tray = new Tray(nativeImage.createFromPath(icon).resize({ width: 16, height: 16 }));
    tray.setToolTip('Twitch Spotify Bot');
    tray.setContextMenu(
      Menu.buildFromTemplate([
        { label: 'Öffnen', click: showWindow },
        { type: 'separator' },
        { label: 'Beenden', click: () => app.quit() }
      ])
    );
    tray.on('click', showWindow);
  } else if (!needed && tray) {
    tray.destroy();
    tray = null;
  }
}

export function showWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return false;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
  windowHidden = false;
  syncTray();
  return true;
}

export function hideWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.hide();
  windowHidden = true;
  syncTray();
}

// Schließen-Verhalten: je nach Einstellung beenden oder in den Tray minimieren.
export function attachWindow(window) {
  mainWindow = window;
  window.on('close', (event) => {
    if (quitting || getSettings('app').closeAction !== 'tray') return;
    event.preventDefault();
    hideWindow();
  });
  window.on('closed', () => {
    if (mainWindow === window) mainWindow = null;
  });
}

// Autostart ist nur in der installierten App sinnvoll (im Entwicklungsmodus würde electron.exe registriert).
export function applyAppSettings() {
  const { autoStart } = getSettings('app');
  if (app.isPackaged) {
    app.setLoginItemSettings({ openAtLogin: autoStart, args: [HIDDEN_ARG] });
  }
  syncTray();
}

export function initLifecycle() {
  app.on('before-quit', () => {
    quitting = true;
    tray?.destroy();
    tray = null;
  });
  applyAppSettings();
}
