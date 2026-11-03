import { expect, test } from '@playwright/test';
import http from 'node:http';
import {
  blockWrites,
  bootstrapVercelBypassCookie,
  routeApiToCandidate,
} from '../fixtures/deployedSmokeConfig';

const deploymentUrl = 'https://statsplus-frontend-pj8o7a8n2-chris-fus-projects.vercel.app/';

test('bootstraps a host-scoped cookie through a real browser context', async ({ browser }) => {
  const browserContext = await browser.newContext();
  const requestApi = {
    newContext: async () => ({
      get: async () => ({
        status: () => 307,
        headersArray: () => [
          { name: 'set-cookie', value: '_vercel_jwt=jwt-token; Path=/; Secure; HttpOnly' },
        ],
      }),
      dispose: async () => {},
    }),
  };

  try {
    await bootstrapVercelBypassCookie({
      browserContext,
      configuredBaseUrl: deploymentUrl,
      bypassSecret: 'offline-test-secret',
      protectedDeployment: true,
      requestApi,
    });

    const [cookie] = await browserContext.cookies(deploymentUrl);
    expect(cookie).toEqual(
      expect.objectContaining({
        name: '_vercel_jwt',
        value: 'jwt-token',
        domain: new URL(deploymentUrl).hostname,
        path: '/',
        secure: true,
        httpOnly: true,
        sameSite: 'Lax',
      }),
    );
  } finally {
    await browserContext.close();
  }
});

test('the read-only guard aborts a page POST before it reaches the server', async ({ browser }) => {
  const received = [];
  const server = http.createServer((req, res) => {
    received.push(`${req.method} ${req.url}`);
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(
      `<script>fetch('/mutate', { method: 'POST', body: 'x' }).catch(() => (document.title = 'blocked'));</script>`,
    );
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browserContext = await browser.newContext();

  try {
    const blocked = await blockWrites(browserContext);
    const page = await browserContext.newPage();
    await page.goto(origin);
    await expect(page).toHaveTitle('blocked');

    expect(blocked).toEqual([`POST ${origin}/mutate`]);
    expect(received).toEqual(['GET /']);
  } finally {
    await browserContext.close();
    await new Promise((resolve) => server.close(resolve));
  }
});

// The compatibility Release Check: a frontend whose same-origin /api answers "production"
// (as a Vercel rewrite does) must, in that mode only, render what the candidate API answers.
const listen = (handler) =>
  new Promise((resolve) => {
    const server = http.createServer(handler);
    server.listen(0, '127.0.0.1', () => resolve(server));
  });

const renderWith = async (browser, mode) => {
  const seen = { frontend: [], candidate: [] };
  const frontend = await listen((req, res) => {
    seen.frontend.push(`${req.method} ${req.url}`);
    if (req.url.startsWith('/api/')) {
      res.writeHead(200, { 'content-type': 'text/plain' });
      return res.end('production answer');
    }
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(
      `<script>fetch('/api/ping?x=1').then((r) => r.text()).then((t) => (document.title = t));` +
        `fetch('/api/mutate', { method: 'POST', body: 'x' }).catch(() => {});</script>`,
    );
  });
  const candidate = await listen((req, res) => {
    seen.candidate.push(`${req.method} ${req.url}`);
    res.writeHead(200, { 'content-type': 'text/plain' });
    res.end('candidate answer');
  });
  const env = {
    RELEASE_CHECK_MODE: mode,
    E2E_BASE_URL: `http://127.0.0.1:${frontend.address().port}`,
    E2E_API_BASE_URL: `http://127.0.0.1:${candidate.address().port}`,
  };
  const browserContext = await browser.newContext();
  try {
    const blocked = await blockWrites(browserContext);
    const routed = await routeApiToCandidate(browserContext, env);
    const page = await browserContext.newPage();
    await page.goto(env.E2E_BASE_URL);
    await expect(page).not.toHaveTitle('');
    return { title: await page.title(), routed, seen, blocked, env };
  } finally {
    await browserContext.close();
    await new Promise((resolve) => frontend.close(resolve));
    await new Promise((resolve) => candidate.close(resolve));
  }
};

test('compatibility mode renders the page from the candidate API, reads only', async ({
  browser,
}) => {
  const { title, routed, seen, blocked, env } = await renderWith(browser, 'compatibility');

  expect(routed).toBe(true);
  expect(title).toBe('candidate answer');
  expect(seen.candidate).toEqual(['GET /api/ping?x=1']);
  expect(seen.frontend).toEqual(['GET /']);
  expect(blocked).toEqual([`POST ${env.E2E_BASE_URL}/api/mutate`]);
});

test('every other mode leaves the page on its own origin', async ({ browser }) => {
  for (const mode of ['production', 'staging', undefined]) {
    const { title, routed, seen } = await renderWith(browser, mode);

    expect(routed, String(mode)).toBe(false);
    expect(title, String(mode)).toBe('production answer');
    expect(seen.candidate, String(mode)).toEqual([]);
  }
});
