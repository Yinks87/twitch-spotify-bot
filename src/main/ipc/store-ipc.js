import { SECTIONS, getSettings } from '../store';
import { getCredentials, setCredentials, updateSettings } from '../services/bot';
import { getPlaylistName } from '../services/spotify';
import { applyAppSettings } from '../lifecycle';
import { handle } from './handle';

const PROVIDERS = ['twitch', 'spotify'];

function assertSection(section) {
  if (!SECTIONS.includes(section)) throw new Error(`Unbekannter Bereich: ${section}`);
}

function assertProvider(provider) {
  if (!PROVIDERS.includes(provider)) throw new Error(`Unbekannte Plattform: ${provider}`);
}

// Tokens verlassen den Main-Prozess nie; nur Einstellungen und Client-Zugangsdaten sind abrufbar.
export function initializeStoreIpc() {
  handle('settings:get', (section) => {
    assertSection(section);
    return getSettings(section);
  });
  handle('settings:set', async (section, value) => {
    assertSection(section);
    if (section === 'songRequest' && typeof value.playlist === 'string') {
      const current = getSettings(section);
      if (value.playlist !== current.playlist || !current.playlistName) {
        value = { ...value, playlistName: await getPlaylistName(value.playlist) };
      }
    }
    const saved = updateSettings(section, value);
    if (section === 'app') applyAppSettings();
    return saved;
  });
  handle('credentials:get', (provider) => {
    assertProvider(provider);
    return getCredentials(provider);
  });
  handle('credentials:set', async (provider, values) => {
    assertProvider(provider);
    await setCredentials(provider, values);
  });
}
