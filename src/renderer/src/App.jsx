import { useCallback, useEffect, useState } from 'react';
import ActionLog from './components/ActionLog';
import Dashboard from './components/Dashboard';
import Settings from './components/Settings';
import Wizard from './components/Wizard';

function App() {
  const [appSettings, setAppSettings] = useState(null);
  const [status, setStatus] = useState(null);
  const [skip, setSkip] = useState({ votes: 0, expiresAt: null });
  const [view, setView] = useState('dashboard');
  const [toast, setToast] = useState(null);

  const notify = useCallback((message) => {
    setToast(message);
    setTimeout(() => setToast((current) => (current === message ? null : current)), 5000);
  }, []);

  useEffect(() => {
    const refresh = () =>
      window.oauthApi.getState().then((state) => {
        setStatus(state.status);
        setSkip(state.skip);
      });
    refresh();
    // Zusätzlich zu den Push-Updates regelmäßig abgleichen, falls ein Update verpasst wurde.
    const poll = setInterval(refresh, 10000);
    window.addEventListener('focus', refresh);
    window.storeApi.getSettings('app').then(setAppSettings);

    const unsubscribers = [
      window.oauthApi.onStatus(setStatus),
      window.oauthApi.onSkipState(setSkip),
      window.oauthApi.onResult((result) =>
        notify({
          ok: result.ok,
          message: `${result.provider === 'twitch' ? 'Twitch' : 'Spotify'}: ${result.message}`
        })
      )
    ];
    return () => {
      clearInterval(poll);
      window.removeEventListener('focus', refresh);
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [notify]);

  // Die Sichtbarkeit des Logs wird beim Wechsel der Ansicht neu geladen.
  const navigate = useCallback((target) => {
    window.storeApi.getSettings('app').then(setAppSettings);
    setView(target);
  }, []);

  if (!status || !appSettings) return null;

  const toastView = toast && (
    <div className={`toast ${toast.ok ? 'ok' : 'error'}`}>{toast.message}</div>
  );

  if (!appSettings.setupCompleted) {
    return (
      <>
        <Wizard
          status={status}
          onNotify={notify}
          onFinished={() => {
            window.storeApi.getSettings('app').then(setAppSettings);
            setView('dashboard');
          }}
        />
        {toastView}
      </>
    );
  }

  const items = [
    ['dashboard', 'Dashboard'],
    ['settings', 'Einstellungen'],
    ...(appSettings.showActionLog ? [['log', 'Action-Log']] : [])
  ];
  const current = items.some(([id]) => id === view) ? view : 'dashboard';

  return (
    <div className="app">
      <nav className="sidebar">
        <div className="brand">
          Twitch Spotify Bot
        </div>
        {items.map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`nav-item ${current === id ? 'active' : ''}`}
            onClick={() => navigate(id)}
          >
            {label}
          </button>
        ))}
      </nav>
      <main className="content">
        {current === 'dashboard' && (
          <Dashboard
            status={status}
            skip={skip}
            showLog={appSettings.showActionLog}
            onNavigate={navigate}
            onNotify={notify}
          />
        )}
        {current === 'settings' && <Settings status={status} />}
        {current === 'log' && <ActionLog />}
      </main>
      {toastView}
    </div>
  );
}

export default App;
