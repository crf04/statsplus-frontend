import { expect, installApiContract, slateGame, slatePayload, test } from '../fixtures/courtai';

test('@critical authenticated user opens a slate and navigates dates', async ({
  authenticatedPage: page,
}) => {
  await page.clock.setFixedTime(new Date('2026-01-15T12:00:00Z'));
  const requests = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/api/games/slate') requests.push(request.url());
  });
  await installApiContract(page, {
    '/api/games/slate': (request) => {
      const date = new URL(request.url()).searchParams.get('date') || '2026-01-15';
      if (date === '2026-01-14') return slatePayload(date, []);
      if (date === '2026-01-10') {
        return slatePayload(
          date,
          [
            {
              ...slateGame,
              game_id: '0022500541',
              away_team: {
                ...slateGame.away_team,
                tricode: 'NYK',
                name: 'New York Knicks',
              },
              home_team: {
                ...slateGame.home_team,
                tricode: 'MIL',
                name: 'Milwaukee Bucks',
              },
              scheduled_at: '2026-01-11T01:00:00Z',
              status: { state: 'final', label: 'Final' },
              classification: null,
            },
          ],
          {
            poolStatus: 'fresh',
            poolFreshnessStatus: 'fresh',
            poolRetrievedAt: '2026-01-15T10:00:00Z',
          },
        );
      }
      return slatePayload(date, [slateGame], {
        poolStatus: 'stale-served',
        poolFreshnessStatus: 'stale-served',
        poolRetrievedAt: '2026-01-15T10:00:00Z',
        providers: {
          prizepicks: { status: 'fresh', retrieved_at: '2026-01-15T10:00:00Z' },
          underdog: { status: 'missing', retrieved_at: null },
        },
      });
    },
  });

  await page.goto('/matchups?date=2026-01-15');

  await expect(page.getByRole('heading', { name: 'Thursday, January 15' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'LAL @ BOS' })).toBeVisible();
  const viewerLocalTip = await page.evaluate((scheduledAt) => {
    return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(
      new Date(scheduledAt),
    );
  }, slateGame.scheduled_at);
  await expect(page.getByText(viewerLocalTip, { exact: true })).toBeVisible();
  await expect(page.getByText('Los Angeles Lakers')).toBeVisible();
  await expect(page.getByText('5 targetable')).toBeVisible();
  await expect(page.getByText(/schedule is fresh.*as of/i)).toBeVisible();
  await expect(page.getByRole('alert').getByText(/player pool is stale-served/i)).toBeVisible();
  await expect(page.getByRole('alert').getByText(/underdog pool is missing/i)).toBeVisible();
  await page.screenshot({ path: 'test-results/slate-desktop.png', fullPage: true });

  await page.getByRole('button', { name: 'Previous date' }).click();
  await expect(page).toHaveURL(/date=2026-01-14/);
  await expect(page.getByText('No games on this slate.')).toBeVisible();

  await page.getByLabel('Slate date').fill('2026-01-10');
  await expect(page).toHaveURL(/date=2026-01-10/);
  await expect(page.getByRole('heading', { name: 'NYK @ MIL' })).toBeVisible();
  await expect(
    page.getByText(/current player pool is not displayed for historical dates/i),
  ).toBeVisible();
  await expect(
    page.getByText(/final game cards retain the posted targetable counts/i),
  ).toBeVisible();
  await expect(page.getByText('5 targetable')).toBeVisible();
  await expect(page.getByText('4 targetable')).toBeVisible();
  await page.screenshot({ path: 'test-results/slate-past.png', fullPage: true });
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

test('a rejected slate request leaves date navigation available', async ({
  authenticatedPage: page,
}) => {
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

test('slate remains usable at a narrow viewport and from the keyboard', async ({
  authenticatedPage: page,
}) => {
  await page.clock.setFixedTime(new Date('2026-01-15T12:00:00Z'));
  await page.setViewportSize({ width: 393, height: 852 });
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
