const TRACK_URL = /open\.spotify\.com\/(?:intl-[a-z-]+\/)?track\/([A-Za-z0-9]{22})/i;
const TRACK_URI = /spotify:track:([A-Za-z0-9]{22})/i;
const OTHER_SPOTIFY_URL =
  /open\.spotify\.com\/(?:intl-[a-z-]+\/)?(?:album|playlist|artist|show|episode)\//i;
const SHORT_LINK = /https?:\/\/(?:spotify\.link|spotify\.app\.link)\/\S+/i;
const ANY_URL = /https?:\/\/\S+/i;
const COMMAND_PREFIX = /^!(?:sr|song|songrequest)\s+/i;

// Teilen-Links der Spotify-App (spotify.link) führen per Redirect zum eigentlichen Track-Link.
async function resolveShortLink(url) {
  try {
    const response = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(5000) });
    return response.url;
  } catch {
    return null;
  }
}

// Ergebnis: { type: 'track', id } | { type: 'search', query } | { type: 'unsupported', reason } | { type: 'empty' }
export async function parseSongInput(raw) {
  const text = (raw ?? '').trim().replace(COMMAND_PREFIX, '');
  if (!text) return { type: 'empty' };

  const direct = text.match(TRACK_URL) ?? text.match(TRACK_URI);
  if (direct) return { type: 'track', id: direct[1] };

  const short = text.match(SHORT_LINK);
  if (short) {
    const resolved = (await resolveShortLink(short[0]))?.match(TRACK_URL);
    if (resolved) return { type: 'track', id: resolved[1] };
    return {
      type: 'unsupported',
      reason:
        'Der Spotify-Kurzlink konnte nicht aufgelöst werden. Bitte den normalen Song-Link senden.'
    };
  }

  if (OTHER_SPOTIFY_URL.test(text)) {
    return {
      type: 'unsupported',
      reason: 'Bitte den Link zu einem einzelnen Song senden (kein Album, keine Playlist).'
    };
  }
  if (ANY_URL.test(text)) {
    return {
      type: 'unsupported',
      reason: 'Es werden nur Spotify-Links unterstützt. Alternativ "Titel Interpret" eingeben.'
    };
  }

  const query = text
    .replace(/\s+[-–—]\s+/g, ' ')
    .replace(/["„“”]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 150);
  return query ? { type: 'search', query } : { type: 'empty' };
}
