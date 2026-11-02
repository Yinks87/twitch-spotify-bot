import { contextBridge } from 'electron';
import { electronAPI } from '@electron-toolkit/preload';

import { storeApi } from './api/store-api';
import { oauthApi } from './api/oauth-api';
import { logApi } from './api/log-api';
import { rewardApi } from './api/reward-api';

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI);
    contextBridge.exposeInMainWorld('storeApi', storeApi);
    contextBridge.exposeInMainWorld('oauthApi', oauthApi);
    contextBridge.exposeInMainWorld('logApi', logApi);
    contextBridge.exposeInMainWorld('rewardApi', rewardApi);
  } catch (error) {
    console.error(error);
  }
} else {
  window.electron = electronAPI;
  window.storeApi = storeApi;
  window.oauthApi = oauthApi;
  window.logApi = logApi;
  window.rewardApi = rewardApi;
}
