import http from 'node:http';
import { logger } from './logger';
import { errorMessage } from './template';

export const AUTH_PORT = 3131;

const handlers = {};

export function registerAuthHandler(provider, handler) {
  handlers[provider] = handler;
}

const escapeHtml = (text) =>
  String(text).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );

function page(ok, title, message) {
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>body{font-family:system-ui,sans-serif;background:#0e0e10;color:#efeff1;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}
.box{text-align:center;max-width:480px;padding:32px;border-radius:12px;background:#18181b;border:1px solid ${ok ? '#00c853' : '#e53935'}}</style></head>
<body><div class="box"><h1>${escapeHtml(title)}</h1><p>${escapeHtml(message)}</p></div></body></html>`;
}

async function onRequest(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const match = url.pathname.match(/^\/auth\/(twitch|spotify)\/callback$/);
  const send = (status, html) => {
    res.writeHead(status, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store'
    });
    res.end(html);
  };

  if (req.method !== 'GET' || !match) {
    send(404, page(false, 'Nicht gefunden', 'Diese Adresse wird von der App nicht verwendet.'));
    return;
  }

  const provider = match[1];
  const error = url.searchParams.get('error');
  if (error) {
    const description = url.searchParams.get('error_description') || error;
    logger.error('auth', `${provider}: Autorisierung abgelehnt (${description})`);
    handlers[provider]?.({ error: description });
    send(400, page(false, 'Autorisierung abgebrochen', description));
    return;
  }

  try {
    const result = await handlers[provider]?.({
      code: url.searchParams.get('code'),
      state: url.searchParams.get('state')
    });
    send(
      200,
      page(true, 'Erfolgreich verbunden', result?.message ?? 'Du kannst dieses Fenster schließen.')
    );
  } catch (err) {
    logger.error('auth', `${provider}: Autorisierung fehlgeschlagen: ${errorMessage(err)}`);
    send(400, page(false, 'Verbindung fehlgeschlagen', errorMessage(err)));
  }
}

// Nur Loopback: "localhost" (Twitch) kann auf 127.0.0.1 oder ::1 auflösen.
export function startAuthServer() {
  for (const host of ['127.0.0.1', '::1']) {
    const server = http.createServer(onRequest);
    server.on('error', (error) => {
      if (host === '::1' && ['EADDRNOTAVAIL', 'EAFNOSUPPORT'].includes(error.code)) return;
      logger.error(
        'auth',
        `Callback-Server (${host}:${AUTH_PORT}) Fehler: ${error.code ?? errorMessage(error)}`
      );
    });
    server.listen(AUTH_PORT, host, () => {
      logger.info('auth', `Callback-Server läuft auf ${host}:${AUTH_PORT}`);
    });
  }
}
