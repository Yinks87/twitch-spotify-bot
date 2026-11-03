import { useState } from 'react';

export function Card({ title, className = '', actions, children }) {
  return (
    <section className={`card ${className}`}>
      {(title || actions) && (
        <div className="row between" style={{ marginBottom: 12 }}>
          {title && <h2 style={{ margin: 0 }}>{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function Field({ label, hint, children }) {
  return (
    <div className="field">
      {label && <span className="label">{label}</span>}
      {children}
      {hint && <div className="hint">{hint}</div>}
    </div>
  );
}

export function TextInput({ value, onChange, ...rest }) {
  return <input type="text" value={value} onChange={(e) => onChange(e.target.value)} {...rest} />;
}

export function NumberInput({ value, onChange, min, max, ...rest }) {
  return (
    <input
      type="number"
      value={value}
      min={min}
      max={max}
      onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
      {...rest}
    />
  );
}

export function SecretInput({ value, onChange, ...rest }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="secret-input">
      <input
        type="text"
        className={visible ? '' : 'blurred'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="off"
        spellCheck={false}
        {...rest}
      />
      <button type="button" className="btn" onClick={() => setVisible((v) => !v)}>
        {visible ? 'Verbergen' : 'Anzeigen'}
      </button>
    </div>
  );
}

export function Toggle({ checked, onChange, label }) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

export function RadioGroup({ value, onChange, options }) {
  return (
    <div className="radio-group">
      {options.map((option) => (
        <label key={option.value} className={`radio ${value === option.value ? 'selected' : ''}`}>
          <input
            type="radio"
            checked={value === option.value}
            onChange={() => onChange(option.value)}
          />
          <span>
            <strong>{option.label}</strong>
            {option.description && <div className="hint">{option.description}</div>}
          </span>
        </label>
      ))}
    </div>
  );
}

export function Button({ variant = '', ...rest }) {
  return <button type="button" className={`btn ${variant}`} {...rest} />;
}

export function Badge({ tone = 'idle', children }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}

export function Notice({ tone = '', children }) {
  return <div className={`notice ${tone}`}>{children}</div>;
}

export function CopyField({ value }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await window.oauthApi.copy(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="copy-field">
      <code>{value}</code>
      <Button onClick={copy}>{copied ? 'Kopiert ✓' : 'Kopieren'}</Button>
    </div>
  );
}

export function SaveBar({ onSave, saving, error, label = 'Speichern', disabled, hideButton }) {
  return (
    <div className="stack" style={{ marginTop: 16 }}>
      {error && <Notice tone="error">{error}</Notice>}
      {!hideButton && (
        <div className="row">
          <Button variant="primary" onClick={onSave} disabled={saving || disabled}>
            {saving ? 'Speichere…' : label}
          </Button>
        </div>
      )}
    </div>
  );
}

export function Switch({ checked, onChange, disabled }) {
  return (
    <label className="switch">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
      />
      <span className="slider" />
    </label>
  );
}