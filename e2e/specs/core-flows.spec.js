import { E2E_AUTH_STORAGE_KEY, expect, installApiContract, test } from '../fixtures/courtai';

test('@smoke public landing page explains how to authenticate', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'CourtAI' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign in with Google' })).toBeVisible();
  await expect(page.getByRole('textbox')).toBeDisabled();
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
