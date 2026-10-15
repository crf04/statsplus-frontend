import { test } from '@e2e-dev/web';
import { expect } from 'e2e';
import { auditNetwork } from '../bridge/network-audit.ts';

// No browser routes or init scripts: these are the actual HTTP/MCP bootstrap paths.
test.setup(
  'bootstrap the disposable bug-bash reader',
  { sessions: ['bb-reader'] },
  async ({ app, screen, browser, session }) => {
    await app.open('/__fixture/bootstrap/reader');
    await expect(screen.getByLabel('Slate date')).toHaveValue('2026-01-15');
    await expect(screen.getByRole('heading', 'LAL @ BOS')).toBeVisible();
    await app.open('/operations');
    await expect(screen.getByRole('heading', 'Administrator permission required')).toBeVisible();
    await app.open('/targets');
    await expect(screen.getByRole('heading', 'No Targets yet.')).toBeVisible();
    await expect(browser).toHaveURL('/targets');
    await session.save('bb-reader');
  },
);

test.setup(
  'bootstrap the disposable bug-bash administrator',
  { sessions: ['bb-admin'] },
  async ({ app, screen, session }) => {
    await app.open('/__fixture/bootstrap/admin');
    await expect(screen.getByRole('heading', 'Operations Console')).toBeVisible();
    await expect(screen.getByText('collector-e2e-1').first()).toBeVisible();
    await expect(screen.getByRole('button', 'Repair traditional_opponent')).toBeVisible();
    await session.save('bb-admin');
  },
);

test(
  'restored reader loads data over HTTP and cannot read admin diagnostics',
  { session: 'bb-reader' },
  async ({ app, screen, browser }) => {
    await app.open('/?player_name=LeBron+James');
    await expect(screen.getByRole('cell', '31', { exact: true }).first()).toBeVisible();
    const status = await browser.evaluate(
      async () =>
        (
          await fetch('/api/admin/collection/diagnostics', {
            headers: { Authorization: 'Bearer courtai-e2e-token' },
          })
        ).status,
    );
    expect(status).toBe(403);
    await app.screenshot('bridge-reader');
  },
);

test(
  'restored administrator loads Operations over HTTP',
  { session: 'bb-admin' },
  async ({ app, screen }) => {
    await app.open('/operations');
    await expect(screen.getByRole('button', 'Repair traditional_opponent')).toBeVisible();
    await app.screenshot('bridge-admin');
  },
);

test('browser audit observes local resources and CSP-blocked WebSockets', async ({
  app,
  browser,
  screen,
}) => {
  const entries: { url: string; blocked?: boolean }[] = [];
  await browser.addInitScript(auditNetwork);
  await browser.route('**/__fixture/network', async (route) => {
    entries.push(...JSON.parse(route.request.postData ?? '[]'));
    await route.continue();
  });
  await app.open('/connect');
  await expect(screen.getByRole('heading', 'Ask CourtAI from your chat')).toBeVisible();
  await expect
    .poll(() =>
      entries.some((entry) => new URL(entry.url).pathname === '/src/connect/ConnectPage.js'),
    )
    .toBe(true);
  await expect
    .poll(() =>
      entries.some((entry) => new URL(entry.url).pathname === '/e2e/bridge/fonts/barlow-400.woff2'),
    )
    .toBe(true);
  await browser.evaluate(() => {
    try {
      new WebSocket('wss://fixture-audit.invalid/socket');
    } catch {
      /* CSP refuses before any network connection. */
    }
    return null;
  });
  await expect
    .poll(() => entries.find((entry) => entry.url === 'wss://fixture-audit.invalid/socket'))
    .toEqual({ url: 'wss://fixture-audit.invalid/socket', blocked: true });
});
