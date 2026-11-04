import { call, subscribe } from './ipc';

export const updateApi = {
  get: () => call('update:get'),
  onState: (callback) => subscribe('update:state', callback)
};
