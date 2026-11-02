import { Field, NumberInput, TextInput, Toggle } from './ui';

export default function RewardFields({ reward, onChange, withPrompt = false }) {
  return (
    <div className="stack">
      <div className="two-col">
        <Field label="Name des Rewards" hint="Maximal 45 Zeichen.">
          <TextInput
            value={reward.title}
            maxLength={45}
            onChange={(title) => onChange({ title })}
          />
        </Field>
        <Field label="Kosten (Channelpoints)">
          <NumberInput min={1} value={reward.cost} onChange={(cost) => onChange({ cost })} />
        </Field>
      </div>

      {withPrompt && (
        <Field label="Beschreibung für Zuschauer">
          <TextInput
            value={reward.prompt}
            maxLength={200}
            onChange={(prompt) => onChange({ prompt })}
          />
        </Field>
      )}

      <Field label="Farbe">
        <div className="row">
          <input
            type="color"
            value={reward.color}
            onChange={(e) => onChange({ color: e.target.value.toUpperCase() })}
          />
          <code>{reward.color}</code>
        </div>
      </Field>

      <div className="two-col">
        <Field label="Max. Einlösungen pro Stream">
          <Toggle
            checked={reward.maxPerStreamEnabled}
            onChange={(maxPerStreamEnabled) => onChange({ maxPerStreamEnabled })}
            label="Begrenzen"
          />
          {reward.maxPerStreamEnabled && (
            <NumberInput
              min={1}
              value={reward.maxPerStream}
              onChange={(maxPerStream) => onChange({ maxPerStream })}
            />
          )}
        </Field>
        <Field label="Max. Einlösungen pro Zuschauer und Stream">
          <Toggle
            checked={reward.maxPerUserEnabled}
            onChange={(maxPerUserEnabled) => onChange({ maxPerUserEnabled })}
            label="Begrenzen"
          />
          {reward.maxPerUserEnabled && (
            <NumberInput
              min={1}
              value={reward.maxPerUser}
              onChange={(maxPerUser) => onChange({ maxPerUser })}
            />
          )}
        </Field>
      </div>
    </div>
  );
}
