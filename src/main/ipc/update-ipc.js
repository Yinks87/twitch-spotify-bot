import { confirmUpdate, getUpdateState } from '../services/updater';
import { handle } from './handle';

export function initializeUpdateIpc() {
  handle('update:get', () => getUpdateState());
  handle('update:confirm', () => confirmUpdate());
}
