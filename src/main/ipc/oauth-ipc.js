import { clipboard } from 'electron';
import { completeSetup, disconnect, getAppState, startAuth } from '../services/bot';
import { handle } from './handle';

const PROVIDERS = ['twitch', 'spotify'];

function assertProvider(provider) {
  if (!PROVIDERS.includes(provider)) throw new Error(`Unbekannte Plattform: ${provider}`);
}

export function initializeOAuthIpc() {
  handle('oauth:connect', async (provider) => {
    assertProvider(provider);
    await startAuth(provider);
  });
  handle('oauth:disconnect', (provider) => {
    assertProvider(provider);
    return disconnect(provider);
  });
  handle('app:state', () => getAppState());
  handle('app:complete-setup', () => completeSetup());
  handle('app:copy', (text) => clipboard.writeText(String(text)));
}
