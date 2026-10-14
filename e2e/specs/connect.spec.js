import { expect, test } from '../fixtures/courtai';

const CONNECTOR_URL = 'https://statsplus-mcp-production.up.railway.app/mcp';

test('a signed-out visitor can copy the connector URL by hand or with the button', async ({
  page,
  context,
}) => {
  // The page is static: no backend call and no call to the connector itself.
  // The card's own HTML under /mcp-cards/ is a static asset, not the connector.
  const dataRequests = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    const toBackend = url.pathname.startsWith('/api/');
    const toConnector =
      url.hostname === new URL(CONNECTOR_URL).hostname ||
      url.pathname === '/mcp' ||
      url.pathname.startsWith('/mcp/');
    if (toBackend || toConnector) dataRequests.push(request.url());
  });
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.clock.install();
  await page.goto('/connect');

  await expect(
    page.getByRole('heading', { level: 1, name: 'Ask CourtAI from your chat' }),
  ).toBeVisible();

  // A blocked clipboard leaves manual selection as the way to copy.
  await page.getByText(CONNECTOR_URL, { exact: true }).click({ clickCount: 3 });
  expect(await page.evaluate(() => window.getSelection().toString().trim())).toBe(CONNECTOR_URL);

  await page.getByRole('button', { name: 'Copy connector URL' }).click();
  await expect(page.getByRole('button', { name: 'Copied' })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(CONNECTOR_URL);

  await page.clock.runFor(5000);
  await expect(page.getByRole('button', { name: 'Copy connector URL' })).toBeVisible();

  expect(dataRequests).toEqual([]);
});

test('setup steps render as numbered lists in both tabs', async ({ page }) => {
  await page.goto('/connect');

  for (const client of ['Claude', 'ChatGPT']) {
    await page.getByRole('tab', { name: client }).click();
    const steps = page.getByRole('tabpanel', { name: client }).getByRole('list');
    await expect(steps).toHaveCSS('list-style-type', 'decimal');
  }
});

test('the connector card renders the captured Matchup and sizes its frame', async ({ page }) => {
  await page.goto('/connect');

  const frame = page.frameLocator('iframe[title^="CourtAI Matchup card"]');
  await expect(frame.getByText('Cade Cunningham').first()).toBeVisible();
  await expect(frame.getByText(/Unscheduled Matchup/).first()).toBeVisible();
  await expect(frame.getByText(/State this once/)).toHaveCount(0);

  // The frame follows the card's own size report; a frame stuck at the
  // initial 560px would clip it or leave a gap.
  const frameBox = page.locator('iframe[title^="CourtAI Matchup card"]');
  await expect
    .poll(async () => {
      const outer = await frameBox.evaluate((node) => node.getBoundingClientRect().height);
      const inner = await frame
        .locator('html')
        .evaluate((node) => Math.ceil(node.getBoundingClientRect().height));
      return Math.abs(outer - inner) <= 2 && inner !== 560;
    })
    .toBe(true);

  // Wide enough for the card's side-by-side layout: the court beside the Bases.
  const court = await frame.locator('.court').first().boundingBox();
  const bases = await frame.getByText('Play types · PTS', { exact: false }).first().boundingBox();
  expect(bases.x).toBeGreaterThan(court.x + court.width - 1);
});

test('the home page points to the Connect page', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('link', { name: 'New Ask CourtAI in Claude or ChatGPT' }).click();
  await expect(page).toHaveURL(/\/connect$/);
  await expect(
    page.getByRole('heading', { level: 1, name: 'Ask CourtAI from your chat' }),
  ).toBeVisible();
});
