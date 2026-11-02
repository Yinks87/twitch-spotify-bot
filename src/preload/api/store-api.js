import { call } from './ipc';

export const storeApi = {
  getSettings: (section) => call('settings:get', section),
  setSettings: (section, value) => call('settings:set', section, value),
  getCredentials: (provider) => call('credentials:get', provider),
  setCredentials: (provider, values) => call('credentials:set', provider, values)
};
