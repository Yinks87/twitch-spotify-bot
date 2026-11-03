import { useEffect, useState } from 'react';
import { formatDate, useLogEntries, useSettings } from '../hooks';
import { LogEntry } from './ActionLog';
import RewardsCard from './RewardsCard';
import { Badge, Button, Card, Notice } from './ui';

const EVENTSUB_LABELS = {
  connected: ['ok', 'EventSub verbunden'],
  connecting: ['warn', 'EventSub verbindet…'],
  disconnected: ['idle', 'EventSub getrennt'],
  error: ['error', 'EventSub-Fehler']
};

const MODE_LABELS = {
  channelpoints: 'Channelpoints',
  powerup: 'Power-Up',
  command: 'Chat-Command'
};

function SkipProgress({ skip, settings }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!skip.expiresAt) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [skip.expiresAt]);

  if (!skip.expiresAt) return <span>Keine laufende Abstimmung</span>;
  const remaining = Math.max(0, Math.ceil((skip.expiresAt - now) / 1000));
  return (
    <span>
      {skip.votes}/{settings.votesRequired} Stimmen · noch {remaining}s
    </span>
  );
}

function PlatformActions({ provider, status, onNotify }) {
  const run = async (action) => {
    try {
      await action();
    } catch (e) {
      onNotify({ ok: false, message: e.message });
    }
  };
  return (
    <div className="row">
      <Button
        variant={status.connected ? '' : provider === 'twitch' ? 'primary' : 'spotify'}
        disabled={!status.configured}
        onClick={() =>
          run(async () => {
            await window.oauthApi.connect(provider);
            onNotify({ ok: true, message: 'Bitte die Autorisierung im Browser abschließen.' });
          })
        }
      >
        {status.connected ? 'Neu verbinden' : 'Verbinden'}
      </Button>
      {status.connected && (
        <Button variant="danger" onClick={() => run(() => window.oauthApi.disconnect(provider))}>
          Trennen
        </Button>
      )}
    </div>
  );
}

export default function Dashboard({ status, skip, showLog, onNavigate, onNotify }) {
  const { twitch, spotify } = status;
  const songRequest = useSettings('songRequest').draft;
  const skipSettings = useSettings('skip').draft;
  const [entries] = useLogEntries();

  const [eventSubTone, eventSubLabel] =
    EVENTSUB_LABELS[twitch.eventsub] ?? EVENTSUB_LABELS.disconnected;
  return (
    <>
      <div className="page-header">
        <h1>Dashboard</h1>
      </div>

      <div className="grid">
        <Card
          title="Twitch"
          className="twitch"
          actions={
            <Badge tone={twitch.connected ? 'ok' : 'error'}>
              {twitch.connected ? 'Verbunden' : 'Getrennt'}
            </Badge>
          }
        >
          <dl className="kv">
            <dt>Konto</dt>
            <dd>{twitch.user?.displayName ?? '-'}</dd>
            <dt>Events</dt>
            <dd>
              <Badge tone={eventSubTone}>{eventSubLabel}</Badge>
            </dd>
            <dt>Token zuletzt geprüft</dt>
            <dd>{formatDate(twitch.lastValidatedAt)}</dd>
            <dt>Autorisiert am</dt>
            <dd>{formatDate(twitch.authorizedAt)}</dd>
          </dl>
          {twitch.error && <Notice tone="error">{twitch.error}</Notice>}
          {twitch.missingScopes.length > 0 && (
            <Notice tone="warn">
              Es fehlen Berechtigungen: {twitch.missingScopes.join(', ')}. Bitte neu verbinden.
            </Notice>
          )}
          <div style={{ marginTop: 12 }}>
            <PlatformActions provider="twitch" status={twitch} onNotify={onNotify} />
          </div>
        </Card>

        <Card
          title="Spotify"
          className="spotify"
          actions={
            <Badge tone={spotify.connected ? 'ok' : 'error'}>
              {spotify.connected ? 'Verbunden' : 'Getrennt'}
            </Badge>
          }
        >
          <dl className="kv">
            <dt>Konto</dt>
            <dd>{spotify.user?.displayName ?? '-'}</dd>
            <dt>Autorisiert am</dt>
            <dd>{formatDate(spotify.authorizedAt)}</dd>
            <dt>Nächste Autorisierung</dt>
            <dd>
              {spotify.reauthAt ? (
                <>
                  {formatDate(spotify.reauthAt)}{' '}
                  <Badge tone={spotify.reauthInDays <= 14 ? 'warn' : 'idle'}>
                    {spotify.reauthInDays > 0 ? `in ${spotify.reauthInDays} Tagen` : 'fällig'}
                  </Badge>
                </>
              ) : (
                '-'
              )}
            </dd>
          </dl>
          {spotify.error && <Notice tone="error">{spotify.error}</Notice>}
          {spotify.connected && spotify.reauthInDays !== null && spotify.reauthInDays <= 14 && (
            <Notice tone="warn">
              Die Spotify-Autorisierung läuft bald ab. Bitte rechtzeitig neu verbinden.
            </Notice>
          )}
          <div style={{ marginTop: 12 }}>
            <PlatformActions provider="spotify" status={spotify} onNotify={onNotify} />
          </div>
        </Card>

        <Card title="Song-Request">
          {songRequest && (
            <dl className="kv">
              <dt>Auslöser</dt>
              <dd>
                {MODE_LABELS[songRequest.mode]}
                {songRequest.mode === 'powerup' && `: ${songRequest.powerUpName}`}
              </dd>
              <dt>Ziel</dt>
              <dd>
                {songRequest.target === 'queue'
                  ? 'Warteschlange'
                  : `Playlist (${songRequest.playlistName || songRequest.playlist || 'aktuell laufende'})`}
              </dd>
            </dl>
          )}
        </Card>

        <Card title="Song-Skip">
          {skipSettings &&
            (skipSettings.enabled ? (
              <dl className="kv">
                <dt>Auslöser</dt>
                <dd>
                  {MODE_LABELS[skipSettings.mode]}
                  {skipSettings.mode === 'command' && `: ${skipSettings.command}`}
                  {skipSettings.mode === 'powerup' && `: ${skipSettings.powerUpName}`}
                </dd>
                <dt>Regel</dt>
                <dd>
                  {skipSettings.votesRequired} Stimmen in {skipSettings.windowSeconds}s
                </dd>
                <dt>Aktuell</dt>
                <dd>
                  <SkipProgress skip={skip} settings={skipSettings} />
                </dd>
              </dl>
            ) : (
              <span className="hint">Deaktiviert</span>
            ))}
        </Card>
      </div>

      <RewardsCard connected={twitch.connected} onNotify={onNotify} />

      {showLog && (
        <Card
          title="Letzte Aktionen"
          actions={<Button onClick={() => onNavigate('log')}>Alle anzeigen</Button>}
        >
          <div className="log-list">
            {entries.length === 0 && <div className="empty">Noch keine Aktionen</div>}
            {entries
              .slice(-8)
              .reverse()
              .map((entry) => (
                <LogEntry key={entry.id} entry={entry} />
              ))}
          </div>
        </Card>
      )}
    </>
  );
}
