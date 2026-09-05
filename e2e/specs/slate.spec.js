import {
  expect,
  installApiContract,
  slateGame,
  slateGameWithMissingNameSentinels,
  slatePayload,
  test,
} from '../fixtures/courtai';

test('@critical authenticated user opens a slate and navigates dates', async ({
  authenticatedPage: page,
}, testInfo) => {
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
            poolFreshnessStatus: 'fresh',
            poolRetrievedAt: '2026-01-15T11:50:00Z',
          },
        );
      }
      return slatePayload(date, [slateGame], {
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

  await expect(page.getByRole('heading', { name: 'Thursday, January 15, 2026' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'LAL @ BOS' })).toBeVisible();
  const viewerLocalTip = await page.evaluate((scheduledAt) => {
    return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(
      new Date(scheduledAt),
    );
  }, slateGame.scheduled_at);
  await expect(page.getByText(viewerLocalTip, { exact: true })).toBeVisible();
  await expect(page.getByText('Los Angeles Lakers at Boston Celtics')).toBeVisible();
  await expect(page.getByLabel('9 targetable players, LAL 5, BOS 4')).toBeVisible();
  // One mark per targetable player, grouped away then home.
  await expect(page.locator('.slate-pip')).toHaveCount(9);
  await expect(page.getByText('NBA Paris Game')).toBeVisible();
  await expect(page.getByText('Preseason')).toHaveCount(0);
  await expect(page.getByText(/schedule is fresh.*as of/i)).toBeVisible();
  const freshness = page.getByRole('group', { name: 'Data freshness' });
  await expect(freshness.getByText(/player pool is stale-served/i)).toBeVisible();
  await expect(freshness.getByText(/underdog pool is missing/i)).toBeVisible();
  await expect(
    page.getByText(/prizepicks pool is stale.*older than 15m freshness bar/i),
  ).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('slate-stale-pool.png'), fullPage: true });

  await page.getByRole('button', { name: 'Previous date' }).click();
  await expect(page).toHaveURL(/date=2026-01-14/);
  await expect(page.getByText('No games on this slate.')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('slate-empty.png'), fullPage: true });

  await page.getByLabel('Slate date').fill('');
  await expect(page).toHaveURL(/\/matchups$/);
  await expect(page.getByRole('heading', { name: 'Thursday, January 15, 2026' })).toBeVisible();
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
  await expect(page.getByLabel('9 targetable players, NYK 5, MIL 4')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('slate-past.png'), fullPage: true });
  expect(requests.some((url) => new URL(url).searchParams.get('date') === '2026-01-10')).toBe(true);

  // Today is reachable from any date, not only as recovery from a bad one.
  await page.getByRole('button', { name: 'Today' }).click();
  await expect(page).toHaveURL(/\/matchups$/);
  await expect(page.getByRole('heading', { name: 'Thursday, January 15, 2026' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Today' })).toBeDisabled();
});

test('falls back to team tricodes when slate team names are unavailable', async ({
  authenticatedPage: page,
}) => {
  await installApiContract(page, {
    '/api/games/slate': slatePayload('2025-12-25', [slateGameWithMissingNameSentinels]),
  });

  await page.goto('/matchups?date=2025-12-25');

  const row = page.getByRole('link', { name: /^LAL @ BOS,/ });
  await expect(row.getByText('LAL at BOS')).toBeVisible();
});

test('signed-out matchups keeps the shared shell and does not redirect', async ({
  page,
}, testInfo) => {
  await installApiContract(page);
  await page.goto('/matchups?date=2026-01-15');

  await expect(page).toHaveURL(/\/matchups/);
  await expect(page.getByRole('navigation', { name: 'Primary' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Matchups' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Sign in to view the slate' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign in with Google' })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('slate-signed-out.png'), fullPage: true });

  await page.goto('/matchups/0022500584?player=2544');
  await expect(page).toHaveURL('/matchups/0022500584?player=2544');
  await expect(page.getByRole('heading', { name: 'Sign in to view this matchup' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Primary' })).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath('matchup-signed-out-deep-link.png'),
    fullPage: true,
  });
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
    '/api/games/slate': (request) => {
      const date = new URL(request.url()).searchParams.get('date');
      if (date) {
        return {
          status: 400,
          body: { error: { code: 'invalid_input', message: 'Enter a valid date.' } },
        };
      }
      return slatePayload('2026-01-15', [slateGame]);
    },
  });

  await page.goto('/matchups?date=2026-02-30');

  await expect(page.getByRole('heading', { name: 'Invalid slate date' })).toBeVisible();
  await expect(page.getByText(/requested date.*2026-02-30.*invalid/i)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Previous date' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Next date' })).toBeDisabled();
  await expect(page.getByRole('alert')).toContainText('Enter a valid date.');
  await expect(page.getByRole('button', { name: 'Today' })).toBeVisible();

  await page.getByRole('button', { name: 'Today' }).click();
  await expect(page).toHaveURL(/\/matchups$/);
  await expect(page.getByRole('heading', { name: 'Thursday, January 15, 2026' })).toBeVisible();
});

test('explicit unavailable pool status wins over stale provider evidence', async ({
  authenticatedPage: page,
}, testInfo) => {
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
        poolFreshnessStatus: 'unavailable',
        providers: {
          prizepicks: { status: 'stale-served', retrieved_at: '2026-01-15T09:00:00Z' },
        },
      },
    ),
  });

  await page.goto('/matchups?date=2026-01-15');

  await expect(page.getByText(/player pool is unavailable; no targetable players/i)).toBeVisible();
  await expect(page.getByText('prizepicks pool is stale-served — as of 3h ago')).toBeVisible();
  await expect(page.getByLabel('0 targetable players, LAL 0, BOS 0')).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath('slate-pool-unavailable.png'),
    fullPage: true,
  });
});

test('minimum slate freshness payload renders through the browser contract', async ({
  authenticatedPage: page,
}) => {
  await page.clock.setFixedTime(new Date('2026-01-15T12:00:00Z'));
  await installApiContract(page, {
    '/api/games/slate': {
      slate_date: '2026-01-15',
      freshness: {
        schedule: { retrieved_at: '2026-01-14T05:00:00Z' },
        pool: {
          providers: {
            prizepicks: { status: 'fresh', retrieved_at: '2026-01-15T11:40:00Z' },
            underdog: { status: 'missing', retrieved_at: null },
          },
        },
      },
      games: [
        {
          ...slateGame,
          status: { state: 'final', label: 'Final after review' },
          classification: null,
          preseason: true,
        },
      ],
    },
  });

  await page.goto('/matchups?date=2026-01-15');

  const freshness = page.getByRole('group', { name: 'Data freshness' });
  await expect(freshness).toBeVisible();
  await expect(page.getByText('Schedule is stale — as of 31h ago')).toBeVisible();
  await expect(freshness.getByText(/player pool is partial/i)).toBeVisible();
  await expect(page.getByText('Final after review')).toBeVisible();
  await expect(page.getByText('Preseason')).toBeVisible();
  await expect(page.getByText('NBA Paris Game')).toHaveCount(0);
  await expect(page.getByText(/counts reflect the available boards/i)).toBeVisible();
});

test('provider aggregate uses the oldest timestamp regardless of provider key order', async ({
  authenticatedPage: page,
}) => {
  await page.clock.setFixedTime(new Date('2026-01-15T12:00:00Z'));
  await installApiContract(page, {
    '/api/games/slate': (request) => {
      const date = new URL(request.url()).searchParams.get('date') || '2026-01-15';
      const entries = [
        ['newer', { status: 'fresh', retrieved_at: '2026-01-15T11:50:00Z' }],
        ['older', { status: 'fresh', retrieved_at: '2026-01-15T11:30:00Z' }],
      ];
      return {
        slate_date: date,
        freshness: {
          schedule: { status: 'fresh', retrieved_at: '2026-01-15T11:50:00Z' },
          pool: {
            providers: Object.fromEntries(date === '2026-01-15' ? entries : entries.reverse()),
          },
        },
        games: [slateGame],
      };
    },
  });

  await page.goto('/matchups?date=2026-01-15');
  await expect(
    page.getByText(/player pool is stale — as of 30m ago.*older than 15m freshness bar/i),
  ).toBeVisible();

  await page.getByLabel('Slate date').fill('2026-01-16');
  await expect(
    page.getByText(/player pool is stale — as of 30m ago.*older than 15m freshness bar/i),
  ).toBeVisible();
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
  await expect(page.getByRole('link', { name: 'Targets' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: /CourtAI Test User/i })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Previous date' })).toBeFocused();

  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});
