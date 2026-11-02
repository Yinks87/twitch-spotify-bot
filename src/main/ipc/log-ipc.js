import { clearLogs, getLogs } from '../services/logger';
import { handle } from './handle';

export function initializeLogIpc() {
  handle('log:get', () => getLogs());
  handle('log:clear', () => clearLogs());
}
