import { call, subscribe } from './ipc';

export const oauthApi = {
  connect: (provider) => call('oauth:connect', provider),
  disconnect: (provider) => call('oauth:disconnect', provider),
  getState: () => call('app:state'),
  completeSetup: () => call('app:complete-setup'),
  copy: (text) => call('app:copy', text),
  onStatus: (callback) => subscribe('status:update', callback),
  onSkipState: (callback) => subscribe('skip:state', callback),
  onResult: (callback) => subscribe('oauth:result', callback)
};
