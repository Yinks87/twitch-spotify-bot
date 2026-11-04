import { useEffect, useState } from 'react';
import { Badge, Button, Card, ConfirmDialog, Switch } from './ui';

export default function RewardsCard({ connected, onNotify }) {
  const [rewards, setRewards] = useState([]);
  const [busy, setBusy] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);

  useEffect(() => {
    let active = true;
    const load = () => window.rewardApi.list().then((list) => active && setRewards(list));
    load();
    const unsubscribe = window.rewardApi.onUpdate(load);
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  if (rewards.length === 0) return null;

  const run = async (action, successMessage) => {
    setBusy(true);
    try {
      await action();
      onNotify({ ok: true, message: successMessage });
    } catch (e) {
      onNotify({ ok: false, message: e.message });
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = () => {
    const reward = pendingDelete;
    setPendingDelete(null);
    run(() => window.rewardApi.remove(reward.key), 'Reward gelöscht');
  };

  return (
    <Card
      title="Channelpoint-Rewards"
      actions={
        <Button
          disabled={busy || !connected}
          onClick={() => run(() => window.rewardApi.sync(), 'Rewards synchronisiert')}
        >
          Synchronisieren / neu anlegen
        </Button>
      }
    >
      <div className="stack">
        {rewards.map((reward) => (
          <div key={reward.key} className="row between">
            <div>
              <strong>{reward.label}</strong>
              {reward.title && (
                <span className="hint">
                  {' '}
                  {reward.title} · {reward.cost} Punkte
                </span>
              )}
              <div className="hint">
                {reward.suspended && !reward.exists
                  ? 'Gelöscht - wird nicht automatisch neu angelegt'
                  : !reward.wanted
                    ? 'Im aktuellen Modus nicht mehr vorgesehen'
                    : ''}
              </div>
            </div>
            <div className="row">
              <Switch
                checked={!reward.isPaused}
                disabled={busy || !connected}
                onChange={() => run(() => window.rewardApi.toggle(reward.key), 'Reward aktualisiert')}
                title="Reward aktivieren/deaktivieren"
              />
              <Badge tone={reward.exists ? 'ok' : 'idle'}>
                {reward.exists ? 'Angelegt' : 'Nicht angelegt'}
              </Badge>
              {reward.exists && (
                <Button
                  variant="danger"
                  disabled={busy || !connected}
                  onClick={() => setPendingDelete(reward)}
                >
                  Löschen
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
      {pendingDelete && (
        <ConfirmDialog
          title="Reward löschen"
          message={`Reward „${pendingDelete.label}“ wirklich bei Twitch löschen?`}
          confirmLabel="Löschen"
          danger
          onConfirm={confirmDelete}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </Card>
  );
}
