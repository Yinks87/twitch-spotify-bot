import { call, subscribe } from './ipc';

export const logApi = {
  get: () => call('log:get'),
  clear: () => call('log:clear'),
  onEntry: (callback) => subscribe('log:entry', callback)
};
