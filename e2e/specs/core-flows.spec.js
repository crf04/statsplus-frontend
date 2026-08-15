import fs from 'node:fs';
import path from 'node:path';
import { E2E_AUTH_STORAGE_KEY, expect, installApiContract } from '../fixtures/courtai';
import { test } from '../fixtures/deployedSmoke';

const vercelConfig = JSON.parse(
  fs.readFileSync(path.resolve(process.cwd(), 'vercel.json'), 'utf8'),
);
const productionBackendOrigin = new URL(vercelConfig.rewrites[0].destination).origin;

test('@smoke public landing page explains how to authenticate', async ({ deployedPage: page }) => {
  const rawBypassHeaders = [];
  page.on('request', (request) => {
    const headers = request.headers();
    if (headers['x-vercel-protection-bypass'] || headers['x-vercel-set-bypass-cookie']) {
      rawBypassHeaders.push(request.url());
    }
  });
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'CourtAI' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign in with Google' })).toBeVisible();
  await expect(page.getByRole('textbox')).toBeDisabled();
  expect(rawBypassHeaders).toHaveLength(0);
});

test('@smoke deployed Matchups shell and deep links resolve', async ({ deployedPage: page }) => {
  await page.goto('/matchups');
  await expect(page.getByRole('heading', { name: 'Sign in to view the slate' })).toBeVisible();

  await page.goto('/matchups/0022500584');
  await expect(page.getByRole('heading', { name: 'Sign in to view this matchup' })).toBeVisible();

  const bundledAssetUrls = await page
    .locator('script[src], link[rel="modulepreload"][href]')
    .evaluateAll((elements) =>
      elements
        .map((element) => element.src || element.href)
        .filter((url) => new URL(url).origin === window.location.origin),
    );
  expect(bundledAssetUrls.length).toBeGreaterThan(0);

  const bundledAssets = await Promise.all(
    bundledAssetUrls.map((url) => page.request.get(url).then((response) => response.text())),
  );
  expect(bundledAssets.length).toBeGreaterThan(0);
  expect(bundledAssets.join('\n')).not.toContain(productionBackendOrigin);
});

test('@smoke production Matchups API routing reaches authenticated backend', async ({
  request,
}) => {
  test.skip(!process.env.E2E_BASE_URL, 'Only meaningful against a deployed environment.');
  test.skip(
    process.env.E2E_PROTECTED_PREVIEW === 'true',
    'Production-only check avoids forwarding the protected-preview cookie through the proxy.',
  );

  const response = await request.get(
    new URL('/api/games/slate?date=2026-01-15', process.env.E2E_BASE_URL).href,
  );

  expect(response.status()).toBe(401);
  expect(response.headers()['content-type']).toContain('application/json');
  await expect(response.json()).resolves.toMatchObject({
    error: { code: 'authentication_required' },
  });
});

test('@critical the development auth adapter unlocks the search seam', async ({ page }) => {
  await installApiContract(page);
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'CourtAI' })).toBeVisible();
  await page.getByRole('button', { name: 'Sign in with Google' }).click();
  await expect(page.getByRole('textbox')).toBeEnabled();
  await expect(page.getByText('CourtAI Test User')).toBeVisible();
});

test('@critical natural-language search renders results and returns to search', async ({
  authenticatedPage: page,
}) => {
  await page.goto('/');

  const query = 'LeBron James last 10 games';
  await page.getByRole('textbox').fill(query);
  await page.getByRole('textbox').press('Enter');

  await expect(page.getByRole('heading', { name: 'LeBron James', exact: true })).toBeVisible();
  await expect(page.getByText(`"${query}"`)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Game Logs' })).toBeVisible();
  await expect(page.getByRole('cell', { name: '31', exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Back to search' }).click();
  await expect(page.getByRole('heading', { name: 'CourtAI' })).toBeVisible();
  await expect(page.getByRole('textbox')).toHaveValue('');
});

test('@critical the query reference is linkable and hands an example back to search', async ({
  authenticatedPage: page,
}) => {
  await page.goto('/');

  await page.getByRole('link', { name: 'Every filter we understand' }).click();
  await expect(page).toHaveURL(/\/help$/);
  await expect(page.getByRole('heading', { name: 'Query reference' })).toBeVisible();
  await expect(page.getByRole('rowheader', { name: 'Less Than 10 ft' })).toBeVisible();

  // The reference survives a reload because it is a route, not an overlay.
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Query reference' })).toBeVisible();

  const example = 'Giannis games at home with 10+ FGA playing 30+ minutes';
  await page.getByRole('link', { name: example }).click();
  await expect(page.getByRole('heading', { name: 'CourtAI' })).toBeVisible();
  await expect(page.getByRole('textbox')).toHaveValue(example);
});

test('@critical consulting the reference does not discard a half-typed query', async ({
  authenticatedPage: page,
}) => {
  await page.goto('/');

  const draft = 'Luka last 10 games';
  await page.getByRole('textbox').fill(draft);
  await page.getByRole('link', { name: 'Every filter we understand' }).click();

  await expect(page.getByRole('heading', { name: 'Query reference' })).toBeFocused();

  await page.getByRole('link', { name: 'Back to search' }).click();
  await expect(page.getByRole('textbox')).toHaveValue(draft);
});

test('the landing help and reference stay usable at a narrow viewport', async ({
  authenticatedPage: page,
}) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto('/');

  await page.getByRole('button', { name: /Narrow it down/ }).click();
  await expect(page.getByRole('textbox')).toHaveValue('Jalen Johnson this year without Trae Young');

  const overflows = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflows).toBe(false);

  await page.getByRole('link', { name: 'Every filter we understand' }).click();
  await expect(page.getByRole('rowheader', { name: 'PRRollMan' })).toBeVisible();
});

test('@critical a rejected natural-language query stays retryable', async ({ page }) => {
  await page.addInitScript((storageKey) => {
    window.localStorage.setItem(storageKey, 'true');
  }, E2E_AUTH_STORAGE_KEY);
  await installApiContract(page, {
    '/api/nl-query': {
      status: 422,
      body: { message: 'Query could not be parsed.' },
    },
  });
  await page.goto('/');

  await page.getByRole('textbox').fill('not a valid basketball query');
  await page.getByRole('textbox').press('Enter');

  await expect(page.getByText('Query could not be parsed.')).toBeVisible();
  await expect(page.getByRole('textbox')).toBeEnabled();
  await expect(page.getByRole('textbox')).toHaveValue('not a valid basketball query');
});

test('@critical structured filters serialize through the game-log request seam', async ({
  authenticatedPage: page,
}) => {
  const gameLogRequests = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/api/games/game_logs') {
      gameLogRequests.push(request.url());
    }
  });
  await page.goto('/');
  await page.getByRole('textbox').fill('LeBron James last 10 games');
  await page.getByRole('textbox').press('Enter');
  await expect(page.getByRole('heading', { name: 'Game Logs' })).toBeVisible();

  await page.getByLabel('Last N games:').fill('5');
  await page.getByRole('button', { name: 'Apply Filters' }).click();

  await expect.poll(() => gameLogRequests.length).toBeGreaterThan(1);
  const latestRequest = new URL(gameLogRequests.at(-1));
  expect(latestRequest.searchParams.get('game_filter')).toBe('5');
});
