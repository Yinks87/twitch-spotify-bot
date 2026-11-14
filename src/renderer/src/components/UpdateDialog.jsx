import { useEffect, useState } from 'react';
import Markdown from './Markdown';
import { Button } from './ui';

// Blockierender Dialog: Der Download startet erst nach der Bestätigung, ein Überspringen ist nicht möglich.
export default function UpdateDialog() {
  const [update, setUpdate] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    window.updateApi.get().then((state) => active && setUpdate(state));
    const unsubscribe = window.updateApi.onState(setUpdate);
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  if (!update || !['available', 'downloading', 'downloaded'].includes(update.status)) return null;

  const confirm = async () => {
    setBusy(true);
    setError('');
    try {
      await window.updateApi.confirm();
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  const waiting = update.status === 'available' && !busy;
  const label = waiting
    ? 'Bestätigen und aktualisieren'
    : update.status === 'downloaded'
      ? 'App wird neu gestartet…'
      : `Wird heruntergeladen… ${update.percent}%`;

  return (
    <div className="dialog-backdrop">
      <div className="dialog update-dialog" role="dialog" aria-modal="true">
        <h2 style={{ marginTop: 0 }}>Update {update.version} verfügbar</h2>
        <p className="hint">Das ist neu in dieser Version:</p>
        <div className="update-notes">
          {update.notes ? <Markdown source={update.notes} /> : <p>Keine Patchnotes vorhanden.</p>}
        </div>
        {error && <div className="notice error">{error}</div>}
        <div className="row" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
          <Button variant="primary" onClick={confirm} disabled={!waiting} autoFocus>
            {label}
          </Button>
        </div>
      </div>
    </div>
  );
}
