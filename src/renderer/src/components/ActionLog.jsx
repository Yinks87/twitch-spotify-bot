import { useMemo, useState } from 'react';
import { useLogEntries } from '../hooks';
import { Button, Card } from './ui';

const MAX_VISIBLE = 500;

export function LogEntry({ entry }) {
  return (
    <div className={`log-entry ${entry.level}`}>
      <span className="ts">{new Date(entry.ts).toLocaleString('de-DE')}</span>
      <span className="lvl">{entry.level.toUpperCase()}</span>
      <span className="src">{entry.source}</span>
      <div>
        {entry.message}
        {entry.details && <pre>{JSON.stringify(entry.details, null, 2)}</pre>}
      </div>
    </div>
  );
}

export default function ActionLog() {
  const [entries, setEntries] = useLogEntries();
  const [level, setLevel] = useState('all');
  const [source, setSource] = useState('all');
  const [query, setQuery] = useState('');

  const sources = useMemo(() => [...new Set(entries.map((e) => e.source))].sort(), [entries]);
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries
      .filter(
        (e) =>
          (level === 'all' || e.level === level) &&
          (source === 'all' || e.source === source) &&
          (!q || e.message.toLowerCase().includes(q))
      )
      .slice(-MAX_VISIBLE)
      .reverse();
  }, [entries, level, source, query]);

  const clear = async () => {
    await window.logApi.clear();
    setEntries([]);
  };

  return (
    <>
      <div className="page-header">
        <h1>Action-Log</h1>
        <Button variant="danger" onClick={clear}>
          Log leeren
        </Button>
      </div>
      <Card>
        <div className="row" style={{ marginBottom: 12 }}>
          <select value={level} onChange={(e) => setLevel(e.target.value)} style={{ width: 150 }}>
            <option value="all">Alle Level</option>
            <option value="info">Info</option>
            <option value="success">Erfolg</option>
            <option value="warn">Warnung</option>
            <option value="error">Fehler</option>
          </select>
          <select value={source} onChange={(e) => setSource(e.target.value)} style={{ width: 170 }}>
            <option value="all">Alle Bereiche</option>
            {sources.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Suchen…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ flex: 1, minWidth: 160 }}
          />
        </div>
        <div className="log-list">
          {visible.length === 0 && <div className="empty">Keine Einträge</div>}
          {visible.map((entry) => (
            <LogEntry key={entry.id} entry={entry} />
          ))}
        </div>
      </Card>
    </>
  );
}
