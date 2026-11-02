import { useState } from 'react';
import ConnectionSetup from './ConnectionSetup';
import SkipSettings from './SkipSettings';
import { SongRequestSettings, SpotifyTargetSettings } from './SongRequestSettings';
import { Button, Card, Notice } from './ui';

const STEPS = [
  'Willkommen',
  'Twitch verbinden',
  'Twitch: Song-Request',
  'Spotify verbinden',
  'Spotify: Ziel',
  'Song-Skip',
  'Fertig'
];

export default function Wizard({ status, onNotify, onFinished }) {
  const [step, setStep] = useState(0);
  const [finishing, setFinishing] = useState(false);

  const next = () => setStep((s) => Math.min(STEPS.length - 1, s + 1));
  const back = () => setStep((s) => Math.max(0, s - 1));

  const finish = async () => {
    setFinishing(true);
    try {
      await window.oauthApi.completeSetup();
      onFinished();
    } catch (e) {
      onNotify({ ok: false, message: e.message });
      setFinishing(false);
    }
  };

  const nav = (canContinue) => (
    <div className="row between" style={{ marginTop: 18 }}>
      <Button onClick={back} disabled={step === 0}>
        Zurück
      </Button>
      {canContinue !== null && step < STEPS.length - 1 && (
        <Button variant="primary" onClick={next} disabled={!canContinue}>
          Weiter
        </Button>
      )}
    </div>
  );

  return (
    <div className="wizard">
      <h1>Einrichtung</h1>
      <div className="steps">
        {STEPS.map((name, index) => (
          <div key={name} className={`step-dot ${index <= step ? 'done' : ''}`} title={name} />
        ))}
      </div>
      <p className="hint">
        Schritt {step + 1} von {STEPS.length}: {STEPS[step]}
      </p>

      {step === 0 && (
        <Card title="Twitch Spotify Bot">
          <p>
            Mit dieser App können Zuschauer per Channelpoints oder Power-Ups Spotify-Songs in deine
            Warteschlange oder eine Playlist wünschen, den aktuellen Song per Chat-Command abrufen
            und gemeinsam Songs überspringen.
          </p>
          <p>
            Du benötigst jeweils eine eigene Entwickler-Anwendung bei Twitch und bei Spotify. Die
            App führt dich Schritt für Schritt durch die Einrichtung.
          </p>
          {nav(true)}
        </Card>
      )}

      {step === 1 && (
        <Card title="Twitch verbinden">
          <ConnectionSetup provider="twitch" status={status.twitch} />
          {nav(status.twitch.connected)}
        </Card>
      )}

      {step === 2 && (
        <Card title="Twitch: Song-Request">
          <SongRequestSettings saveLabel="Speichern & Weiter" onSaved={next} />
          {nav(null)}
        </Card>
      )}

      {step === 3 && (
        <Card title="Spotify verbinden">
          <ConnectionSetup provider="spotify" status={status.spotify} />
          {nav(status.spotify.connected)}
        </Card>
      )}

      {step === 4 && (
        <Card title="Spotify: Wohin sollen Songs hinzugefügt werden?">
          <SpotifyTargetSettings saveLabel="Speichern & Weiter" onSaved={next} />
          {nav(null)}
        </Card>
      )}

      {step === 5 && (
        <Card title="Song-Skip">
          <SkipSettings saveLabel="Speichern & Weiter" onSaved={next} />
          {nav(null)}
        </Card>
      )}

      {step === 6 && (
        <Card title="Alles bereit">
          <div className="stack">
            <Notice tone="ok">
              Nach dem Abschluss öffnet sich das Dashboard. Im Modus „Channelpoints“ werden die
              Rewards automatisch in deinem Kanal angelegt. Alle Einstellungen kannst du später im
              Bereich „Einstellungen“ ändern – dort findest du auch die Chat-Commands und
              Nachrichtentexte.
            </Notice>
            <div className="row between">
              <Button onClick={back}>Zurück</Button>
              <Button variant="primary" onClick={finish} disabled={finishing}>
                {finishing ? 'Wird abgeschlossen…' : 'Einrichtung abschließen'}
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
