import { E2E_AUTH_STORAGE_KEY, expect, installApiContract, test } from '../fixtures/courtai';

test('@critical authenticated user opens a slate and navigates dates', async ({ page }) => {
  await page.addInitScript((storageKey) => {
    window.localStorage.setItem(storageKey, 'true');
  }, E2E_AUTH_STORAGE_KEY);
  const requests = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/api/games/slate') requests.push(request.url());
  });
  await installApiContract(page);

  await page.goto('/matchups?date=2026-01-15');

  await expect(page.getByRole('heading', { name: 'Thursday, January 15' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'LAL @ BOS' })).toBeVisible();
  await expect(page.getByText('Los Angeles Lakers')).toBeVisible();
  await expect(page.getByText('5 targetable')).toBeVisible();
  await expect(page.getByRole('article').getByText('Pool unavailable')).toBeVisible();
  await expect(page.getByText(/schedule as of/i)).toBeVisible();
  await expect(page.getByLabel('Data freshness').getByText('Pool unavailable')).toBeVisible();
  await page.screenshot({ path: 'test-results/slate-desktop.png', fullPage: true });

  await page.getByRole('button', { name: 'Previous date' }).click();
  await expect(page).toHaveURL(/date=2026-01-14/);
  await expect(page.getByText('No games on this slate.')).toBeVisible();

  await page.getByLabel('Slate date').fill('2026-01-10');
  await expect(page).toHaveURL(/date=2026-01-10/);
  await expect(page.getByRole('heading', { name: 'NYK @ MIL' })).toBeVisible();
  await expect(page.getByText('Past slate — player pool unavailable.')).toBeVisible();
  expect(requests.some((url) => new URL(url).searchParams.get('date') === '2026-01-10')).toBe(true);
});

test('signed-out matchups keeps the shared shell and does not redirect', async ({ page }) => {
  await installApiContract(page);
  await page.goto('/matchups?date=2026-01-15');

  await expect(page).toHaveURL(/\/matchups/);
  await expect(page.getByRole('navigation', { name: 'Primary' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Matchups' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Sign in to view the slate' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign in with Google' })).toBeVisible();
});

test('unknown paths return to the search landing page', async ({ page }) => {
  await page.goto('/not-a-route');
  await expect(page).toHaveURL('/');
  await expect(page.getByRole('heading', { name: 'CourtAI' })).toBeVisible();
});

test('a rejected slate request leaves date navigation available', async ({ page }) => {
  await page.addInitScript((storageKey) => {
    window.localStorage.setItem(storageKey, 'true');
  }, E2E_AUTH_STORAGE_KEY);
  await installApiContract(page, {
    '/api/games/slate': {
      status: 503,
      body: { error: { code: 'provider_unavailable', message: 'Schedule is unavailable.' } },
    },
  });

  await page.goto('/matchups?date=2026-01-15');

  await expect(page.getByRole('alert')).toContainText('Schedule is unavailable.');
  await expect(page.getByRole('button', { name: 'Next date' })).toBeEnabled();
  await expect(page.getByLabel('Slate date')).toBeEnabled();
});

test('slate remains usable at a narrow viewport and from the keyboard', async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 });
  await page.addInitScript((storageKey) => {
    window.localStorage.setItem(storageKey, 'true');
  }, E2E_AUTH_STORAGE_KEY);
  await installApiContract(page);
  await page.goto('/matchups?date=2026-01-15');
  await expect(page.getByRole('heading', { name: 'LAL @ BOS' })).toBeVisible();

  const searchLink = page.getByRole('link', { name: 'Search' });
  await searchLink.focus();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Matchups' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: /CourtAI Test User/i })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Previous date' })).toBeFocused();

  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: 'test-results/slate-narrow.png', fullPage: true });
});
