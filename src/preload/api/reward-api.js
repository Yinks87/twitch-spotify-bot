import { call, subscribe } from './ipc';

export const rewardApi = {
  list: () => call('rewards:list'),
  sync: () => call('rewards:sync'),
  remove: (key) => call('rewards:delete', key),
  onUpdate: (callback) => subscribe('rewards:update', callback)
};
