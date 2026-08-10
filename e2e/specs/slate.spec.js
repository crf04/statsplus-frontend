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
          prizepicks: { status: 'fresh', retrieved_at: '2026-01-15T11:40:00Z' },
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
  const freshness = page.getByRole('group', { name: 'Data freshness' });
  await expect(freshness.getByText(/player pool is stale-served/i)).toBeVisible();
  await expect(freshness.getByText(/underdog pool is missing/i)).toBeVisible();
  await expect(page.getByText('prizepicks pool is fresh — as of 20m ago')).toBeVisible();
  await page.screenshot({ path: 'test-results/slate-desktop.png', fullPage: true });

  await page.getByRole('button', { name: 'Previous date' }).click();
  await expect(page).toHaveURL(/date=2026-01-14/);
  await expect(page.getByText('No games on this slate.')).toBeVisible();

  await page.getByLabel('Slate date').fill('');
  await expect(page).toHaveURL(/\/matchups$/);
  await expect(page.getByRole('heading', { name: 'Thursday, January 15' })).toBeVisible();
  expect(requests.some((url) => !new URL(url).searchParams.has('date'))).toBe(true);

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

test('an invalid requested date stays neutral until the backend rejects it', async ({
  authenticatedPage: page,
}) => {
  await installApiContract(page, {
    '/api/games/slate': {
      status: 400,
      body: { error: { code: 'invalid_input', message: 'Enter a valid date.' } },
    },
  });

  await page.goto('/matchups?date=2026-02-30');

  await expect(page.getByRole('heading', { name: 'Invalid slate date' })).toBeVisible();
  await expect(page.getByText(/requested date.*2026-02-30.*invalid/i)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Previous date' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Next date' })).toBeDisabled();
  await expect(page.getByRole('alert')).toContainText('Enter a valid date.');
  await page.screenshot({ path: 'test-results/slate-invalid-date.png', fullPage: true });
});

test('explicit unavailable pool status wins over stale provider evidence', async ({
  authenticatedPage: page,
}) => {
  await page.clock.setFixedTime(new Date('2026-01-15T12:00:00Z'));
  await installApiContract(page, {
    '/api/games/slate': slatePayload(
      '2026-01-15',
      [
        {
          ...slateGame,
          away_team: { ...slateGame.away_team, targetable_player_count: 0 },
          home_team: { ...slateGame.home_team, targetable_player_count: 0 },
        },
      ],
      {
        poolStatus: 'unavailable',
        poolFreshnessStatus: 'unavailable',
        providers: {
          prizepicks: { status: 'stale-served', retrieved_at: '2026-01-15T09:00:00Z' },
        },
      },
    ),
  });

  await page.goto('/matchups?date=2026-01-15');

  await expect(page.getByText(/player pool unavailable; no targetable players/i)).toBeVisible();
  await expect(page.getByText('prizepicks pool is stale-served — as of 3h ago')).toBeVisible();
  await expect(page.getByText('0 targetable')).toHaveCount(2);
  await page.screenshot({ path: 'test-results/slate-pool-contradiction.png', fullPage: true });
});

test('minimum slate freshness payload renders through the browser contract', async ({
  authenticatedPage: page,
}) => {
  await page.clock.setFixedTime(new Date('2026-01-15T12:00:00Z'));
  await installApiContract(page, {
    '/api/games/slate': {
      slate_date: '2026-01-15',
      freshness: {
        schedule: { retrieved_at: '2026-01-15T11:00:00Z' },
        pool: {
          retrieved_at: null,
          providers: {
            prizepicks: { status: 'fresh', retrieved_at: '2026-01-15T11:40:00Z' },
          },
        },
      },
      games: [
        {
          ...slateGame,
          status: { state: 'final', label: 'Final after review' },
        },
      ],
    },
  });

  await page.goto('/matchups?date=2026-01-15');

  await expect(page.getByRole('group', { name: 'Data freshness' })).toBeVisible();
  await expect(page.getByText('Schedule is fresh — as of 1h ago')).toBeVisible();
  await expect(page.getByText('Player pool is fresh — as of 20m ago')).toBeVisible();
  await expect(page.getByText('Final after review')).toBeVisible();
  await expect(page.getByText(/targetable counts use the current player pool/i)).toBeVisible();
  await page.screenshot({ path: 'test-results/slate-minimum-payload.png', fullPage: true });
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
