import { useSettings, useWizardControl } from '../hooks';
import RewardFields from './RewardFields';
import { Field, NumberInput, Notice, RadioGroup, SaveBar, TextInput, Toggle } from './ui';

export default function SkipSettings({ control, saveLabel, onSaved }) {
  const { draft, loading, saving, error, update, updateNested, save } = useSettings('skip');

  const invalid =
    !loading &&
    draft.enabled &&
    ((draft.mode === 'powerup' && !draft.powerUpName.trim()) ||
      (draft.mode === 'command' && !draft.command.trim()) ||
      !(Number(draft.votesRequired) >= 1) ||
      !(Number(draft.windowSeconds) >= 10));

  const onSave = async () => {
    if (await save()) onSaved?.();
  };
  useWizardControl(control, () => save(), invalid);
  if (loading) return null;

  return (
    <div className="stack">
      <Toggle
        checked={draft.enabled}
        onChange={(enabled) => update({ enabled })}
        label="Song-Skip per Zuschauer-Abstimmung aktivieren"
      />

      {draft.enabled && (
        <>
          <Notice>
            Es ist immer nur eine Variante aktiv. Jeder Zuschauer kann pro Abstimmung nur einmal
            abstimmen. Wird die Stimmenzahl im Zeitfenster nicht erreicht, werden alle Stimmen
            verworfen und eine neue Abstimmung kann beginnen.
          </Notice>

          <RadioGroup
            value={draft.mode}
            onChange={(mode) => update({ mode })}
            options={[
              {
                value: 'command',
                label: 'Chat-Command',
                description: 'Zuschauer schreiben den Command in den Chat.'
              },
              {
                value: 'channelpoints',
                label: 'Channelpoints',
                description: 'Die App legt einen Skip-Reward automatisch an.'
              },
              {
                value: 'powerup',
                label: 'Power-Up',
                description: 'Ein Power-Up deines Kanals zählt als Stimme.'
              }
            ]}
          />

          {draft.mode === 'command' && (
            <Field label="Chat-Command">
              <TextInput value={draft.command} onChange={(command) => update({ command })} />
            </Field>
          )}
          {draft.mode === 'powerup' && (
            <Field
              label="Genauer Name des Power-Ups"
              hint="Titel des eigenen (Custom) Power-Ups, exakt wie in Twitch. Es sollte sich vom Song-Request-Power-Up unterscheiden."
            >
              <TextInput
                value={draft.powerUpName}
                onChange={(powerUpName) => update({ powerUpName })}
              />
            </Field>
          )}
          {draft.mode === 'channelpoints' && (
            <RewardFields
              reward={draft.reward}
              onChange={(patch) => updateNested('reward', patch)}
            />
          )}

          <div className="two-col">
            <Field label="Nötige Stimmen" hint="Standard: 3">
              <NumberInput
                min={1}
                value={draft.votesRequired}
                onChange={(votesRequired) => update({ votesRequired })}
              />
            </Field>
            <Field label="Zeitfenster (Sekunden)" hint="Standard: 120">
              <NumberInput
                min={10}
                value={draft.windowSeconds}
                onChange={(windowSeconds) => update({ windowSeconds })}
              />
            </Field>
          </div>
        </>
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
