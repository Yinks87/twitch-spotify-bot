import { call, subscribe } from './ipc';

export const updateApi = {
  get: () => call('update:get'),
  confirm: () => call('update:confirm'),
  onState: (callback) => subscribe('update:state', callback)
};
