import { useEffect, useState } from 'react';
import { formatDate } from '../hooks';
import { Badge, Button, CopyField, Field, Notice, SecretInput, TextInput } from './ui';

const PROVIDERS = {
  twitch: {
    label: 'Twitch',
    cardClass: 'twitch',
    buttonClass: 'primary',
    consoleUrl: 'https://dev.twitch.tv/console/apps',
    redirectUri: 'http://localhost:3131/auth/twitch/callback',
    needsSecret: true,
    scopes: 'channel:manage:redemptions, bits:read, user:write:chat, user:read:chat',
    steps: [
      <>
        Öffne die Twitch Developer Console, melde dich an und klicke auf{' '}
        <strong>„Anwendung registrieren“</strong>.
      </>,
      <>
        <strong>Name:</strong> frei wählbar. <strong>OAuth Redirect URL:</strong> die Adresse unten.{' '}
        <strong>Kategorie: „Other“</strong>. <strong>Client-Typ: „Vertraulich“</strong>.
      </>,
      <>
        Nach „Erstellen“ bei der Anwendung auf <strong>„Verwalten“</strong> klicken: Die{' '}
        <strong>Client-ID</strong> kopieren und über <strong>„Neues Secret“</strong> ein{' '}
        <strong>Client-Secret</strong> erzeugen. Beides unten eintragen.
      </>
    ]
  },
  spotify: {
    label: 'Spotify',
    cardClass: 'spotify',
    buttonClass: 'spotify',
    consoleUrl: 'https://developer.spotify.com/dashboard',
    redirectUri: 'http://127.0.0.1:3131/auth/spotify/callback',
    needsSecret: false,
    scopes:
      'user-read-playback-state, user-modify-playback-state, user-read-currently-playing, playlist-modify-public, playlist-modify-private',
    steps: [
      <>
        Öffne das Spotify Developer Dashboard, melde dich an und klicke auf{' '}
        <strong>„Create app“</strong>.
      </>,
      <>
        <strong>App name / App description:</strong> frei wählbar. <strong>Redirect URI:</strong>{' '}
        die Adresse unten (mit „Add“ bestätigen). Bei{' '}
        <strong>„Which API/SDKs are you planning to use?“</strong> wählst du{' '}
        <strong>„Web API“</strong>. Danach die Nutzungsbedingungen akzeptieren und speichern.
      </>,
      <>
        Unter <strong>„Settings“</strong> der App die <strong>Client ID</strong> kopieren und unten
        eintragen. Ein Client-Secret wird nicht benötigt.
      </>
    ]
  }
};

export default function ConnectionSetup({ provider, status }) {
  const config = PROVIDERS[provider];
  const [saved, setSaved] = useState(null);
  const [draft, setDraft] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [waiting, setWaiting] = useState(false);

  useEffect(() => {
    window.storeApi.getCredentials(provider).then((creds) => {
      setSaved(creds);
      setDraft(creds);
    });
  }, [provider]);

  useEffect(
    () =>
      window.oauthApi.onResult((result) => {
        if (result.provider === provider) setWaiting(false);
      }),
    [provider]
  );

  if (!draft) return null;

  const dirty = JSON.stringify(saved) !== JSON.stringify(draft);
  const complete = draft.clientId.trim() && (!config.needsSecret || draft.clientSecret.trim());

  const run = async (action) => {
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  // Die Zugangsdaten werden beim Verbinden automatisch gespeichert.
  const connect = () =>
    run(async () => {
      if (dirty) {
        await window.storeApi.setCredentials(provider, draft);
        setSaved(draft);
      }
      await window.oauthApi.connect(provider);
      setWaiting(true);
    });

  const disconnect = () =>
    run(async () => {
      await window.oauthApi.disconnect(provider);
    });

  return (
    <div className="stack">
      <Notice>
        <p style={{ marginBottom: 8 }}>
          <strong>
            {config.label}-Entwicklerseite:{' '}
            <a href={config.consoleUrl} target="_blank" rel="noreferrer">
              {config.consoleUrl}
            </a>
          </strong>
        </p>
        <ol style={{ margin: 0, paddingLeft: 18 }}>
          {config.steps.map((step, index) => (
            <li key={index} style={{ marginBottom: 4 }}>
              {step}
            </li>
          ))}
        </ol>
      </Notice>

      <Field label="Redirect-URI (in der Entwickler-Anwendung eintragen)">
        <CopyField value={config.redirectUri} />
      </Field>

      <Field label="Client-ID">
        <SecretInput
          value={draft.clientId}
          onChange={(clientId) => setDraft({ ...draft, clientId })}
        />
      </Field>

      {config.needsSecret && (
        <Field label="Client-Secret">
          <SecretInput
            value={draft.clientSecret}
            onChange={(clientSecret) => setDraft({ ...draft, clientSecret })}
          />
        </Field>
      )}

      {error && <Notice tone="error">{error}</Notice>}
      {dirty && status.connected && (
        <Notice tone="warn">
          Mit geänderten Zugangsdaten wird die bestehende Verbindung getrennt und neu aufgebaut.
        </Notice>
      )}

      <div className="row">
        <Button variant={config.buttonClass} onClick={connect} disabled={busy || !complete}>
          {status.connected ? `Neu mit ${config.label} verbinden` : `Mit ${config.label} verbinden`}
        </Button>
        {status.connected && (
          <Button variant="danger" onClick={disconnect} disabled={busy}>
            Verbindung trennen
          </Button>
        )}
      </div>

      {waiting && (
        <Notice>
          Die Autorisierung wurde in deinem Standard-Browser geöffnet. Schließe sie dort ab - diese
          Ansicht aktualisiert sich automatisch.
        </Notice>
      )}

      <div className="row">
        <Badge tone={status.connected ? 'ok' : 'idle'}>
          {status.connected ? 'Verbunden' : 'Nicht verbunden'}
        </Badge>
        {status.connected && (
          <span className="hint">
            {status.user?.displayName} · autorisiert am {formatDate(status.authorizedAt)}
          </span>
        )}
      </div>
    </div>
  );
}
