import { screen } from 'electron';
import { getStore } from './store';

const DEFAULT_SIZE = { width: 1100, height: 760 };
const MIN_SIZE = { width: 860, height: 600 };
const MIN_VISIBLE = 100;
const SAVE_DELAY_MS = 500;

function overlapsDisplay(bounds) {
  return screen.getAllDisplays().some(({ workArea }) => {
    const width =
      Math.min(bounds.x + bounds.width, workArea.x + workArea.width) -
      Math.max(bounds.x, workArea.x);
    const height =
      Math.min(bounds.y + bounds.height, workArea.y + workArea.height) -
      Math.max(bounds.y, workArea.y);
    return width >= MIN_VISIBLE && height >= MIN_VISIBLE;
  });
}

// Liefert die zuletzt gespeicherte Größe/Position. Ist die Position nicht mehr verfügbar
// (z. B. Monitor getrennt), wird nur die Größe übernommen und das Fenster zentriert.
export function loadWindowState() {
  const saved = getStore('window').store;
  const width = Number.isFinite(saved.width)
    ? Math.max(saved.width, MIN_SIZE.width)
    : DEFAULT_SIZE.width;
  const height = Number.isFinite(saved.height)
    ? Math.max(saved.height, MIN_SIZE.height)
    : DEFAULT_SIZE.height;
  const { workArea } = screen.getPrimaryDisplay();
  const size = {
    width: Math.min(width, workArea.width),
    height: Math.min(height, workArea.height)
  };

  const hasPosition = Number.isFinite(saved.x) && Number.isFinite(saved.y);
  const position =
    hasPosition && overlapsDisplay({ x: saved.x, y: saved.y, ...size })
      ? { x: saved.x, y: saved.y }
      : {};

  return { ...size, ...position, maximized: Boolean(saved.maximized) };
}

export function trackWindowState(window) {
  const store = getStore('window');
  let timer = null;

  const save = () => {
    clearTimeout(timer);
    if (window.isDestroyed() || window.isMinimized() || window.isFullScreen()) return;
    store.set({ ...window.getNormalBounds(), maximized: window.isMaximized() });
  };
  const scheduleSave = () => {
    clearTimeout(timer);
    timer = setTimeout(save, SAVE_DELAY_MS);
  };

  window.on('resize', scheduleSave);
  window.on('move', scheduleSave);
  window.on('maximize', scheduleSave);
  window.on('unmaximize', scheduleSave);
  window.on('close', save);
}
