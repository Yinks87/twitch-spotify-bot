import { useState } from 'react';
import { useSettings } from '../hooks';
import ChatSettings from './ChatSettings';
import ConnectionSetup from './ConnectionSetup';
import SkipSettings from './SkipSettings';
import { SongRequestSettings, SpotifyTargetSettings } from './SongRequestSettings';
import { Card, Field, RadioGroup, SaveBar, Toggle } from './ui';

const TABS = [
  ['twitch', 'Twitch'],
  ['songRequest', 'Twitch: Song-Request'],
  ['spotify', 'Spotify'],
  ['target', 'Spotify: Ziel'],
  ['skip', 'Song-Skip'],
  ['chat', 'Chat'],
  ['general', 'Allgemein']
];

function GeneralSettings() {
  const { draft, loading, saving, error, update, save } = useSettings('app');
  if (loading) return null;
  return (
    <div className="stack">
      <Toggle
        checked={draft.showActionLog}
        onChange={(showActionLog) => update({ showActionLog })}
        label="Action-Log in der Navigation und im Dashboard anzeigen (die Aktionen werden immer protokolliert)"
      />
      <Toggle
        checked={draft.autoStart}
        onChange={(autoStart) => update({ autoStart })}
        label="App beim Anmelden an Windows automatisch starten (minimiert im Tray)"
      />
      <Field label="Beim Schließen des Fensters">
        <RadioGroup
          value={draft.closeAction}
          onChange={(closeAction) => update({ closeAction })}
          options={[
            { value: 'quit', label: 'App beenden' },
            {
              value: 'tray',
              label: 'In den Tray minimieren',
              description: 'Der Bot läuft im Hintergrund weiter. Beenden über das Tray-Symbol.'
            }
          ]}
        />
      </Field>
      <SaveBar
        onSave={() => save(['showActionLog', 'autoStart', 'closeAction'])}
        saving={saving}
        error={error}
      />
    </div>
  );
}

export default function Settings({ status }) {
  const [tab, setTab] = useState('twitch');

  return (
    <>
      <div className="page-header">
        <h1>Einstellungen</h1>
      </div>
      <div className="tabs">
        {TABS.map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`tab ${tab === id ? 'active' : ''}`}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'chat' ? (
        <ChatSettings />
      ) : (
        <Card>
          {tab === 'twitch' && <ConnectionSetup provider="twitch" status={status.twitch} />}
          {tab === 'songRequest' && <SongRequestSettings />}
          {tab === 'spotify' && <ConnectionSetup provider="spotify" status={status.spotify} />}
          {tab === 'target' && <SpotifyTargetSettings />}
          {tab === 'skip' && <SkipSettings />}
          {tab === 'general' && <GeneralSettings />}
        </Card>
      )}
    </>
  );
}
