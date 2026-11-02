import { ipcMain } from 'electron';
import { logger } from '../services/logger';
import { errorMessage } from '../services/template';

// Antworten haben immer die Form { ok, data } bzw. { ok: false, error }.
export function handle(channel, fn) {
  ipcMain.handle(channel, async (_event, ...args) => {
    try {
      return { ok: true, data: await fn(...args) };
    } catch (error) {
      logger.error('app', `${channel} fehlgeschlagen: ${errorMessage(error)}`);
      return { ok: false, error: errorMessage(error) };
    }
  });
}
