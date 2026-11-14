import Store from 'electron-store';
import { STORE_DIR, migrateLegacyStores } from './migrate';

const FILE_NAMES = {
  app: 'app',
  auth: 'auth',
  songRequest: 'song-request',
  skip: 'skip',
  chat: 'chat',
  rewards: 'rewards',
  actionLog: 'action-log'
};

const cache = new Map();
let migrated = false;

export function getStore(key) {
  if (!migrated) {
    migrated = true;
    try {
      migrateLegacyStores();
    } catch (error) {
      console.error('[store] Migration der alten Stores fehlgeschlagen:', error);
    }
  }
  if (!cache.has(key)) {
    cache.set(key, new Store({ name: FILE_NAMES[key], cwd: STORE_DIR }));
  }
  return cache.get(key);
}

// Zugriff auf die Zugangsdaten/Tokens einer Plattform innerhalb des gemeinsamen auth-Stores.
export function getAuthStore(provider) {
  if (provider !== 'twitch' && provider !== 'spotify') {
    throw new Error(`Unbekannte Plattform: ${provider}`);
  }
  const scoped = (key) => `${provider}.${key}`;
  return {
    get: (key, fallback) => getStore('auth').get(scoped(key), fallback),
    set: (key, value) => {
      const store = getStore('auth');
      if (typeof key === 'object') {
        store.set(Object.fromEntries(Object.entries(key).map(([k, v]) => [scoped(k), v])));
      } else {
        store.set(scoped(key), value);
      }
    }
  };
}

const REWARD_OPTIONS = {
  color: '#9147FF',
  maxPerStreamEnabled: false,
  maxPerStream: 10,
  maxPerUserEnabled: false,
  maxPerUser: 1,
  isPaused: true
};

export const DEFAULTS = {
  app: {
    setupCompleted: false,
    showActionLog: true,
    autoStart: true,
    closeAction: 'tray', // quit | tray
    window: { width: 1100, height: 760, x: null, y: null, maximized: false }
  },
  songRequest: {
    mode: 'channelpoints', // channelpoints | powerup
    powerUpName: '',
    maxDurationEnabled: true,
    maxDurationMinutes: 5,
    reward: {
      title: 'Song Request',
      cost: 500,
      prompt: 'Songtitel, Interpret oder Spotify-Link eingeben',
      isGlobalCooldownEnabled: true,
      globalcooldownSeconds: 60,
      ...REWARD_OPTIONS
    },
    target: 'queue', // queue | playlist
    playlist: '', // leer = aktuell laufende Playlist
    playlistName: '' // beim Speichern von Spotify ermittelt, nur zur Anzeige
  },
  skip: {
    enabled: true,
    mode: 'command', // channelpoints | powerup | command
    powerUpName: '',
    reward: {
      title: 'Song überspringen',
      cost: 300,
      ...REWARD_OPTIONS
    },
    //TODO: Add array of commands
    command: '!skip',
    votesRequired: 3,
    windowSeconds: 120
  },
  chat: {
    messagesEnabled: true,
    nowPlaying: {
      enabled: true,
      //TODO: Add array of commands
      command: '!song',
      cooldownSeconds: 30
    },
    messages: {
      nowPlaying: 'Aktuell läuft: ${song} - ${url}',
      noSong: 'Aktuell läuft kein Song.',
      songAdded: '@${user}: ${song} wurde zur Warteschlange hinzugefügt.',
      songAddedPlaylist: '@${user}: ${song} wurde zur Playlist hinzugefügt.',
      noInput: '@${user}: Bitte gib einen Songtitel oder Spotify-Link an.',
      songInvalid: '@${user}: ${reason}',
      songNotFound: '@${user}: Es wurde kein passender Song gefunden.',
      songTooLong:
        '@${user}: Die maximale Song-Länge beträgt ${max}. Song nicht hinzugefügt.',
      spotifyError: '@${user}: Der Song konnte nicht hinzugefügt werden (${error}).',
      skipVote: '@${user} hat für einen Skip gestimmt (${votes}/${required}).',
      skipAlreadyVoted: '@${user}: Du hast bereits für einen Skip gestimmt.',
      skipSuccess: 'Song wird übersprungen (${votes}/${required} Stimmen).',
      skipExpired:
        'Skip-Abstimmung abgelaufen (${votes}/${required}). Die Stimmen wurden zurückgesetzt.',
      skipNoSong: '@${user}: Es läuft aktuell kein Song, der übersprungen werden kann.',
      skipError: '@${user}: Der Song konnte nicht übersprungen werden (${error}).'
    }
  }
};

DEFAULTS.chat.messageEnabled = Object.fromEntries(
  Object.keys(DEFAULTS.chat.messages).map((key) => [key, true])
);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function deepMerge(base, override) {
  const result = clone(base);
  if (!isPlainObject(override)) return result;
  for (const [key, value] of Object.entries(override)) {
    if (isPlainObject(value) && isPlainObject(result[key])) {
      result[key] = deepMerge(result[key], value);
    } else if (value !== undefined) {
      result[key] = value;
    }
  }
  return result;
}

const int = (value, fallback, min, max) => {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
};
const str = (value, fallback = '', maxLength = 500) =>
  typeof value === 'string' ? value.trim().slice(0, maxLength) : fallback;
const bool = (value, fallback) => (typeof value === 'boolean' ? value : fallback);
const oneOf = (value, allowed, fallback) => (allowed.includes(value) ? value : fallback);
const command = (value, fallback) => str(value, fallback, 50).split(/\s+/)[0] || fallback;

const rewardOptions = (reward) => ({
  color: /^#[0-9a-f]{6}$/i.test(reward.color) ? reward.color.toUpperCase() : REWARD_OPTIONS.color,
  maxPerStreamEnabled: bool(reward.maxPerStreamEnabled, false),
  maxPerStream: int(reward.maxPerStream, REWARD_OPTIONS.maxPerStream, 1, 1000000),
  maxPerUserEnabled: bool(reward.maxPerUserEnabled, false),
  maxPerUser: int(reward.maxPerUser, REWARD_OPTIONS.maxPerUser, 1, 1000000),
  isPaused: bool(reward.isPaused, true),

});

const NORMALIZERS = {
  app: (v) => ({
    setupCompleted: bool(v.setupCompleted, false),
    showActionLog: bool(v.showActionLog, true),
    autoStart: bool(v.autoStart, false),
    closeAction: oneOf(v.closeAction, ['quit', 'tray'], DEFAULTS.app.closeAction),
    window: {
      width: int(v.window.width, DEFAULTS.app.window.width, 1, 100000),
      height: int(v.window.height, DEFAULTS.app.window.height, 1, 100000),
      x: Number.isFinite(v.window.x) ? Math.round(v.window.x) : null,
      y: Number.isFinite(v.window.y) ? Math.round(v.window.y) : null,
      maximized: bool(v.window.maximized, false)
    }
  }),
  songRequest: (v) => ({
    mode: oneOf(v.mode, ['channelpoints', 'powerup'], DEFAULTS.songRequest.mode),
    powerUpName: str(v.powerUpName, '', 100),
    maxDurationEnabled: bool(v.maxDurationEnabled, false),
    maxDurationMinutes: int(v.maxDurationMinutes, DEFAULTS.songRequest.maxDurationMinutes, 1, 600),
    reward: {
      title: str(v.reward.title, DEFAULTS.songRequest.reward.title, 45) || 'Song Request',
      cost: int(v.reward.cost, DEFAULTS.songRequest.reward.cost, 1, 1000000000),
      prompt: str(v.reward.prompt, '', 200),
      isGlobalCooldownEnabled: bool(v.reward.isGlobalCooldownEnabled, true),
      globalcooldownSeconds: int(v.reward.globalcooldownSeconds, 60, 0, 86400),
      ...rewardOptions(v.reward)
    },
    target: oneOf(v.target, ['queue', 'playlist'], 'queue'),
    playlist: str(v.playlist, '', 200),
    playlistName: str(v.playlistName, '', 200)
  }),
  skip: (v) => ({
    enabled: bool(v.enabled, true),
    mode: oneOf(v.mode, ['channelpoints', 'powerup', 'command'], DEFAULTS.skip.mode),
    powerUpName: str(v.powerUpName, '', 100),
    reward: {
      title: str(v.reward.title, DEFAULTS.skip.reward.title, 45) || 'Song überspringen',
      cost: int(v.reward.cost, DEFAULTS.skip.reward.cost, 1, 1000000000),
      ...rewardOptions(v.reward)
    },
    command: command(v.command, DEFAULTS.skip.command),
    votesRequired: int(v.votesRequired, DEFAULTS.skip.votesRequired, 1, 1000),
    windowSeconds: int(v.windowSeconds, DEFAULTS.skip.windowSeconds, 10, 3600)
  }),
  chat: (v) => ({
    messagesEnabled: bool(v.messagesEnabled, true),
    nowPlaying: {
      enabled: bool(v.nowPlaying.enabled, true),
      command: command(v.nowPlaying.command, DEFAULTS.chat.nowPlaying.command),
      cooldownSeconds: int(v.nowPlaying.cooldownSeconds, 30, 0, 86400)
    },
    messages: Object.fromEntries(
      Object.keys(DEFAULTS.chat.messages).map((key) => [
        key,
        typeof v.messages[key] === 'string'
          ? v.messages[key].slice(0, 500)
          : DEFAULTS.chat.messages[key]
      ])
    ),
    messageEnabled: Object.fromEntries(
      Object.keys(DEFAULTS.chat.messages).map((key) => [key, bool(v.messageEnabled[key], true)])
    )
  })
};

export const SECTIONS = Object.keys(NORMALIZERS);

export function getSettings(section) {
  return deepMerge(DEFAULTS[section], getStore(section).store);
}

export function saveSettings(section, value) {
  const normalized = NORMALIZERS[section](deepMerge(getSettings(section), value));
  getStore(section).store = normalized;
  return normalized;
}
