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
    page.getByRole('heading', { level: 1, name: 'Use StatsPlus in Claude or ChatGPT' }),
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
