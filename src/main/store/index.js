import Store from 'electron-store';

const FILE_NAMES = {
  app: 'app',
  twitchAuth: 'twitch-auth',
  spotifyAuth: 'spotify-auth',
  songRequest: 'song-request',
  skip: 'skip',
  chat: 'chat',
  rewards: 'rewards',
  actionLog: 'action-log',
  window: 'window'
};

const cache = new Map();

export function getStore(key) {
  if (!cache.has(key)) {
    cache.set(key, new Store({ name: FILE_NAMES[key] }));
  }
  return cache.get(key);
}

const REWARD_OPTIONS = {
  color: '#9147FF',
  maxPerStreamEnabled: false,
  maxPerStream: 10,
  maxPerUserEnabled: false,
  maxPerUser: 1
};

export const DEFAULTS = {
  app: {
    setupCompleted: false,
    showActionLog: true,
    autoStart: true,
    closeAction: 'tray' // quit | tray
  },
  songRequest: {
    mode: 'channelpoints', // channelpoints | powerup
    powerUpName: '',
    reward: {
      title: 'Song Request',
      cost: 500,
      prompt: 'Songtitel, Interpret oder Spotify-Link eingeben',
      ...REWARD_OPTIONS
    },
    target: 'queue', // queue | playlist
    playlist: '' // leer = aktuell laufende Playlist
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
    command: '!skip',
    votesRequired: 3,
    windowSeconds: 120
  },
  chat: {
    messagesEnabled: true,
    nowPlaying: {
      enabled: true,
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
  maxPerUser: int(reward.maxPerUser, REWARD_OPTIONS.maxPerUser, 1, 1000000)
});

const NORMALIZERS = {
  app: (v) => ({
    setupCompleted: bool(v.setupCompleted, false),
    showActionLog: bool(v.showActionLog, true),
    autoStart: bool(v.autoStart, false),
    closeAction: oneOf(v.closeAction, ['quit', 'tray'], DEFAULTS.app.closeAction)
  }),
  songRequest: (v) => ({
    mode: oneOf(v.mode, ['channelpoints', 'powerup'], DEFAULTS.songRequest.mode),
    powerUpName: str(v.powerUpName, '', 100),
    reward: {
      title: str(v.reward.title, DEFAULTS.songRequest.reward.title, 45) || 'Song Request',
      cost: int(v.reward.cost, DEFAULTS.songRequest.reward.cost, 1, 1000000000),
      prompt: str(v.reward.prompt, '', 200),
      ...rewardOptions(v.reward)
    },
    target: oneOf(v.target, ['queue', 'playlist'], 'queue'),
    playlist: str(v.playlist, '', 200)
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
