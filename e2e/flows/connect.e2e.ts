import { expect } from 'e2e';
import { signedOutTest } from './support/courtai.ts';

const CONNECTOR_URL = 'https://statsplus-mcp-production.up.railway.app/mcp';

signedOutTest(
  'a signed-out visitor can select and copy the connector URL',
  async ({ app, screen, browser, api }) => {
    // Browser clipboard permissions are not exposed by e2e; grant a local clipboard
    // sink so this flow checks the exact write and feedback without OS permissions.
    await browser.addInitScript(() => {
      Object.defineProperty(navigator, 'clipboard', {
        value: {
          writeText: async (text: string) => {
            window.sessionStorage.setItem('connect:clipboard', text);
          },
        },
      });
    });
    await app.open('/connect');
    await expect(screen.getByRole('heading', 'Use CourtAI in Claude or ChatGPT')).toBeVisible();
    await screen.getByText(CONNECTOR_URL).tap();

    expect(await browser.evaluate(() => window.getSelection()?.toString().trim() ?? '')).toBe(
      CONNECTOR_URL,
    );
    await screen.getByRole('button', 'Copy connector URL').tap();
    await expect(screen.getByRole('button', 'Copied')).toBeVisible();
    expect(await browser.evaluate(() => window.sessionStorage.getItem('connect:clipboard'))).toBe(
      CONNECTOR_URL,
    );
    await expect(screen.getByRole('button', 'Copy connector URL')).toBeVisible({ timeout: 5000 });
    expect(api.requests).toEqual([]);
    await app.screenshot('connect-guide');
  },
);

signedOutTest('Connect setup steps render as numbered lists', async ({ app, screen, browser }) => {
  await app.open('/connect');
  for (const client of ['Claude', 'ChatGPT']) {
    await expect(screen.getByRole('region', client).getByRole('list')).toBeVisible();
  }
  expect(
    await browser.evaluate(() =>
      Array.from(
        document.querySelectorAll('.connect-clients ol'),
        (list) => getComputedStyle(list).listStyleType,
      ),
    ),
  ).toEqual(['decimal', 'decimal']);
});
