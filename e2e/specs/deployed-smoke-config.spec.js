import { expect, test } from '@playwright/test';
import http from 'node:http';
import { blockWrites, bootstrapVercelBypassCookie } from '../fixtures/deployedSmokeConfig';

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
