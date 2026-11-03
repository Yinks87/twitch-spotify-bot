import { useSettings } from '../hooks';
import { Card, Field, NumberInput, Notice, SaveBar, TextInput, Toggle } from './ui';

const MESSAGE_LABELS = {
  nowPlaying: 'Aktueller Song (Command-Antwort)',
  noSong: 'Kein Song aktiv',
  songAdded: 'Song zur Warteschlange hinzugefügt',
  songAddedPlaylist: 'Song zur Playlist hinzugefügt',
  noInput: 'Song-Request ohne Eingabe',
  songInvalid: 'Ungültige Song-Eingabe',
  songNotFound: 'Song nicht gefunden',
  spotifyError: 'Fehler beim Hinzufügen',
  skipVote: 'Skip-Stimme gezählt',
  skipAlreadyVoted: 'Bereits für Skip abgestimmt',
  skipSuccess: 'Song übersprungen',
  skipExpired: 'Skip-Zeitfenster abgelaufen',
  skipNoSong: 'Skip ohne laufenden Song',
  skipError: 'Fehler beim Überspringen'
};

export default function ChatSettings({ onNotify }) {
  const { draft, loading, saving, error, update, updateNested, save, isDirty } =
    useSettings('chat');
  if (loading) return null;

  const onSave = async () => {
    if (await save()) onNotify?.({ ok: true, message: 'Einstellungen gespeichert' });
  };

  return (
    <div className="stack">
      <Card title="Chatnachrichten">
        <div className="stack">
          <Toggle
            checked={draft.messagesEnabled}
            onChange={(messagesEnabled) => update({ messagesEnabled })}
            label="Der Bot darf Nachrichten in den Twitch-Chat schreiben"
          />
          {!draft.messagesEnabled && (
            <Notice tone="warn">
              Alle Chatnachrichten sind deaktiviert - auch die Antwort auf den Song-Command.
            </Notice>
          )}
        </div>
      </Card>

      <Card title="Song-Command">
        <div className="stack">
          <Toggle
            checked={draft.nowPlaying.enabled}
            onChange={(enabled) => updateNested('nowPlaying', { enabled })}
            label="Command aktiv"
          />
          <div className="two-col">
            <Field label="Command">
              <TextInput
                value={draft.nowPlaying.command}
                onChange={(command) => updateNested('nowPlaying', { command })}
              />
            </Field>
            <Field
              label="Cooldown (Sekunden)"
              hint="Zeit, bis der Command erneut ausgelöst werden kann."
            >
              <NumberInput
                min={0}
                value={draft.nowPlaying.cooldownSeconds}
                onChange={(cooldownSeconds) => updateNested('nowPlaying', { cooldownSeconds })}
              />
            </Field>
          </div>
        </div>
      </Card>

      <Card title="Nachrichtentexte">
        <div className="stack">
          <Notice>
            Verfügbare Variablen: <code>{'${song}'}</code> (Titel - Interpret),{' '}
            <code>{'${artist}'}</code>, <code>{'${url}'}</code> (Spotify-Link),{' '}
            <code>{'${user}'}</code> (Twitch-Login). Bei Skip-Nachrichten zusätzlich{' '}
            <code>{'${votes}'}</code> und <code>{'${required}'}</code>, bei Fehlern{' '}
            <code>{'${error}'}</code> bzw. <code>{'${reason}'}</code>. Ein leeres Feld unterdrückt
            die jeweilige Nachricht.
          </Notice>
          <div className="msg-grid">
            {Object.entries(MESSAGE_LABELS).map(([key, label]) => (
              <Field key={key} label={label}>
                <TextInput
                  value={draft.messages[key]}
                  onChange={(value) => updateNested('messages', { [key]: value })}
                />
              </Field>
            ))}
          </div>
        </div>
      </Card>

      <SaveBar onSave={onSave} disabled={!isDirty()} saving={saving} error={error} />
    </div>
  );
}
