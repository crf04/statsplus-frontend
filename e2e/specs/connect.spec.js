import { expect, test } from '../fixtures/courtai';

const CONNECTOR_URL = 'https://statsplus-mcp-production.up.railway.app/mcp';

test('a signed-out visitor can copy the connector URL by hand or with the button', async ({
  page,
  context,
}) => {
  const apiRequests = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/api/')) apiRequests.push(request.url());
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

  expect(apiRequests).toEqual([]);
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

  // The card reports its own height; a frame stuck at the initial 560px would clip it.
  const height = await page
    .locator('iframe[title^="CourtAI Matchup card"]')
    .evaluate((node) => node.getBoundingClientRect().height);
  expect(height).toBeGreaterThan(900);
});

test('the home page points to the Connect page', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('link', { name: 'New Ask CourtAI in Claude or ChatGPT' }).click();
  await expect(page).toHaveURL(/\/connect$/);
  await expect(
    page.getByRole('heading', { level: 1, name: 'Ask CourtAI from your chat' }),
  ).toBeVisible();
});
