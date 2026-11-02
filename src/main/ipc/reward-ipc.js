import { getRewards, removeReward, resyncRewards } from '../services/bot';
import { handle } from './handle';

export function initializeRewardIpc() {
  handle('rewards:list', () => getRewards());
  handle('rewards:sync', () => resyncRewards());
  handle('rewards:delete', (key) => removeReward(key));
}
