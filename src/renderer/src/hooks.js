import { useCallback, useEffect, useState } from 'react';

// Lädt einen Einstellungsbereich und stellt einen Entwurf bereit, der explizit gespeichert wird.
// Im Wizard speichert der "Weiter"-Button: Die Komponente stellt save/invalid über control bereit.
export function useWizardControl(control, save, invalid) {
  if (control) control.ref.current = { save, invalid };
  const onInvalidChange = control?.onInvalidChange;
  useEffect(() => {
    onInvalidChange?.(Boolean(invalid));
  }, [invalid, onInvalidChange]);
}

export function useSettings(section) {
  const [saved, setSaved] = useState(null);
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    window.storeApi
      .getSettings(section)
      .then((value) => {
        if (!active) return;
        setSaved(value);
        setDraft(value);
      })
      .catch((e) => active && setError(e.message));
    return () => {
      active = false;
    };
  }, [section]);

  const update = useCallback((patch) => setDraft((d) => ({ ...d, ...patch })), []);
  const updateNested = useCallback(
    (key, patch) => setDraft((d) => ({ ...d, [key]: { ...d[key], ...patch } })),
    []
  );

  // fields: optional Liste der Schlüssel, die verglichen werden.
  const isDirty = useCallback(
    (fields) => {
      if (!draft || !saved) return false;
      const keys = fields ?? Object.keys(draft);
      return keys.some((k) => JSON.stringify(draft[k]) !== JSON.stringify(saved[k]));
    },
    [draft, saved]
  );

  // fields: optional Liste der Schlüssel, die gespeichert werden sollen.
  const save = useCallback(
    async (fields) => {
      setSaving(true);
      setError('');
      try {
        const patch = fields ? Object.fromEntries(fields.map((k) => [k, draft[k]])) : draft;
        const result = await window.storeApi.setSettings(section, patch);
        setSaved(result);
        setDraft(result);
        return true;
      } catch (e) {
        setError(e.message);
        return false;
      } finally {
        setSaving(false);
      }
    },
    [draft, section]
  );

  return { draft, saved, loading: draft === null, saving, error, update, updateNested, save, isDirty };
}

export function formatDate(timestamp) {
  return timestamp ? new Date(timestamp).toLocaleString('de-DE') : '-';
}

const MAX_BUFFERED_ENTRIES = 1000;

export function useLogEntries() {
  const [entries, setEntries] = useState([]);

  useEffect(() => {
    let active = true;
    window.logApi.get().then((initial) => active && setEntries(initial));
    const unsubscribe = window.logApi.onEntry((entry) =>
      setEntries((list) => [...list.slice(-(MAX_BUFFERED_ENTRIES - 1)), entry])
    );
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  return [entries, setEntries];
}
