import { useSettings, useWizardControl } from '../hooks';
import RewardFields from './RewardFields';
import { Field, Notice, RadioGroup, SaveBar, TextInput } from './ui';

export function SongRequestSettings({ control, onSaved, saveLabel }) {
  const { draft, loading, saving, error, update, updateNested, save } = useSettings('songRequest');
  const invalid = !loading && draft.mode === 'powerup' && !draft.powerUpName.trim();
  const onSave = async () => {
    if (await save(['mode', 'powerUpName', 'reward'])) onSaved?.();
  };
  useWizardControl(control, () => save(['mode', 'powerUpName', 'reward']), invalid);
  if (loading) return null;

  return (
    <div className="stack">
      <Notice>
        Bei Song-Requests ist die Eingabe des Zuschauers immer erforderlich - daraus wird der Song
        (Suchbegriff oder Spotify-Link) ermittelt.
      </Notice>

      <RadioGroup
        value={draft.mode}
        onChange={(mode) => update({ mode })}
        options={[
          {
            value: 'channelpoints',
            label: 'Channelpoints',
            description:
              'Die App legt den Reward „Song Request“ automatisch über die Twitch-API an.'
          },
          {
            value: 'powerup',
            label: 'Power-Ups',
            description: 'Ein vorhandenes Power-Up deines Kanals löst den Song-Request aus.'
          }
        ]}
      />

      {draft.mode === 'powerup' ? (
        <Field
          label="Genauer Name des Power-Ups"
          hint="Titel des eigenen (Custom) Power-Ups, exakt wie in Twitch. Die Eingabe des Zuschauers beim Einlösen ist die Song-Eingabe - das Power-Up muss also eine Texteingabe verlangen."
        >
          <TextInput
            value={draft.powerUpName}
            onChange={(powerUpName) => update({ powerUpName })}
            placeholder="z. B. Song Request"
          />
        </Field>
      ) : (
        <RewardFields
          reward={draft.reward}
          onChange={(patch) => updateNested('reward', patch)}
          withPrompt
        />
      )}

      <SaveBar
        onSave={onSave}
        saving={saving}
        error={error}
        label={saveLabel}
        disabled={invalid}
        hideButton={Boolean(control)}
      />
    </div>
  );
}

export function SpotifyTargetSettings({ control, onSaved, saveLabel }) {
  const { draft, loading, saving, error, update, save } = useSettings('songRequest');
  useWizardControl(control, () => save(['target', 'playlist']), false);
  if (loading) return null;

  const onSave = async () => {
    if (await save(['target', 'playlist'])) onSaved?.();
  };

  return (
    <div className="stack">
      <RadioGroup
        value={draft.target}
        onChange={(target) => update({ target })}
        options={[
          {
            value: 'queue',
            label: 'Warteschlange',
            description: 'Der Song wird direkt in die aktuelle Spotify-Warteschlange eingereiht.'
          },
          {
            value: 'playlist',
            label: 'Playlist',
            description: 'Der Song wird einer Playlist hinzugefügt.'
          }
        ]}
      />
      {draft.target === 'playlist' && (
        <Field
          label="Playlist (Link, URI oder ID)"
          hint="Leer lassen, um die aktuell laufende Playlist zu verwenden."
        >
          <TextInput
            value={draft.playlist}
            onChange={(playlist) => update({ playlist })}
            placeholder="https://open.spotify.com/playlist/…"
          />
        </Field>
      )}
      <SaveBar
        onSave={onSave}
        saving={saving}
        error={error}
        label={saveLabel}
        hideButton={Boolean(control)}
      />
    </div>
  );
}
