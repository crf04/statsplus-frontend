import { createServer as createHttpServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { createServer } from 'vite';
import {
  E2E_AUTH_STORAGE_KEY,
  E2E_ADMIN_STORAGE_KEY,
  installApiContract,
} from '../fixtures/courtai-contract.mjs';

// Every bootstrap owns a contract closure; cookies survive session.save(), routes do not.
export async function startBridge(port = 0) {
  const accounts = new Map();
  const httpServer = createHttpServer();
  const json = (res, status, body) => {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
  };
  const plugin = {
    name: 'courtai-fixture-bridge',
    transformIndexHtml(html) {
      // Offline fonts: even preconnect must not contact a third-party host.
      return html.replace(/<link\b[^>]*https:\/\/fonts\.[^>]*>/g, '');
    },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const origin = `http://127.0.0.1:${httpServer.address().port}`;
        if (req.headers.host !== new URL(origin).host)
          return json(res, 403, { error: 'Loopback host required' });
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader(
          'Content-Security-Policy',
          "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'",
        );
        const url = new URL(req.url, origin);
        // No headers, cookies, or bodies enter the evidence log.
        res.on('finish', () =>
          console.log(
            JSON.stringify({
              kind: 'http',
              method: req.method,
              origin,
              path: url.pathname,
              status: res.statusCode,
            }),
          ),
        );
        try {
          const bootstrap = /^\/__fixture\/bootstrap\/(reader|admin)$/.exec(url.pathname);
          if (bootstrap && req.method === 'GET') {
            const role = bootstrap[1];
            let handle;
            await installApiContract({
              route: async (_pattern, handler) => {
                handle = handler;
              },
            });
            const id = randomUUID();
            accounts.set(id, { role, handle });
            res.setHeader('Set-Cookie', `courtai-fixture=${id}; HttpOnly; SameSite=Strict; Path=/`);
            res.setHeader('Content-Type', 'text/html');
            res.end(`<!doctype html><title>Fixture bootstrap</title><script>
              localStorage.clear();
              localStorage.setItem(${JSON.stringify(E2E_AUTH_STORAGE_KEY)}, 'true');
              localStorage.setItem(${JSON.stringify(E2E_ADMIN_STORAGE_KEY)}, ${JSON.stringify(String(role === 'admin'))});
              location.replace(${JSON.stringify(role === 'admin' ? '/operations' : '/matchups?date=2026-01-15')});
            </script>`);
            return;
          }
          if (url.pathname === '/__fixture/network' && req.method === 'POST') {
            let body = '';
            for await (const chunk of req) body += chunk;
            for (const entry of JSON.parse(body)) {
              const observed = new URL(entry.url);
              console.log(
                JSON.stringify({
                  kind: 'browser-resource',
                  origin: observed.origin,
                  path: observed.pathname,
                  blocked: entry.blocked === true,
                }),
              );
            }
            res.writeHead(204).end();
            return;
          }
          if (url.pathname.startsWith('/__fixture/'))
            return json(res, 404, { error: 'Unknown fixture route' });
          if (!url.pathname.startsWith('/api/')) return next();
          const id = /(?:^|;\s*)courtai-fixture=([^;]+)/.exec(req.headers.cookie || '')?.[1];
          const account = accounts.get(id);
          if (!account || req.headers.authorization !== 'Bearer courtai-e2e-token')
            return json(res, 401, { error: 'Fixture session required' });
          if (url.pathname.startsWith('/api/admin/') && account.role !== 'admin')
            return json(res, 403, { error: 'Fixture administrator required' });
          let body = '';
          for await (const chunk of req) body += chunk;
          await account.handle({
            request: () => ({
              url: () => url.href,
              method: () => req.method,
              headers: () => req.headers,
              postData: () => body || null,
              postDataJSON: () => (body ? JSON.parse(body) : null),
            }),
            fulfill: async ({ status = 200, json: payload }) => json(res, status, payload),
          });
        } catch (error) {
          console.error(error.message);
          if (!res.headersSent) json(res, 500, { error: 'Fixture request failed' });
          else res.end();
        }
      });
    },
  };
  const server = await createServer({
    plugins: [plugin],
    envFile: false,
    define: {
      'process.env.REACT_APP_E2E_MODE': '"true"',
      // Relative to the document's origin, bypassing any developer .env API host.
      'process.env.REACT_APP_API_BASE_URL': 'window.location.origin',
      ...Object.fromEntries(
        [
          'API_KEY',
          'AUTH_DOMAIN',
          'PROJECT_ID',
          'STORAGE_BUCKET',
          'MESSAGING_SENDER_ID',
          'APP_ID',
        ].map((key) => [`process.env.REACT_APP_FIREBASE_${key}`, '""']),
      ),
    },
    server: { middlewareMode: true, hmr: false, proxy: {} },
  });
  httpServer.on('request', server.middlewares);
  await new Promise((resolve, reject) => {
    httpServer.once('error', reject);
    httpServer.listen(port, '127.0.0.1', resolve);
  }).catch(async (error) => {
    await server.close();
    throw error;
  });
  return {
    origin: `http://127.0.0.1:${httpServer.address().port}`,
    close: async () => {
      httpServer.closeAllConnections();
      await Promise.all([
        new Promise((resolve, reject) =>
          httpServer.close((error) => (error ? reject(error) : resolve())),
        ),
        server.close(),
      ]);
      accounts.clear();
    },
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.argv[2] ?? 0);
  if (!Number.isInteger(port) || port < 0 || port > 65535)
    throw new Error('Expected a port from 0 to 65535');
  const bridge = await startBridge(port);
  console.log(`Fixture bridge: ${bridge.origin}`);
  let closing;
  const close = () => (closing ??= bridge.close());
  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.once(signal, close);
}
