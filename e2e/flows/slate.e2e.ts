// Ported from e2e/specs/slate.spec.js. Nine of its ten tests are here, with the
// source titles in order. The tenth, "authenticated user opens a slate and
// navigates dates", stays in that spec because it observes browser requests.
// flows/slates.e2e.ts covers the happy paths with different titles.
import { expect } from 'e2e';
import { slateGame, slateGameWithMissingNameSentinels, slatePayload } from '../fixtures/courtai.js';
import { freezeClock, signedInTest, signedOutTest } from './support/courtai.ts';

// `page.clock.setFixedTime(new Date('2026-01-15T12:00:00Z'))` in the source.
const FIXED_NOW = '2026-01-15T12:00:00Z';

signedInTest(
  'falls back to team tricodes when slate team names are unavailable',
  async ({ app, screen, api }) => {
    await api.override({
      '/api/games/slate': {
        body: slatePayload('2025-12-25', [slateGameWithMissingNameSentinels]),
      },
    });

    await app.open('/matchups?date=2025-12-25');

    const row = screen.getByRole('link', /^LAL @ BOS,/);
    await expect(row.getByText('LAL at BOS')).toBeVisible();
  },
);

signedOutTest(
  'signed-out matchups keeps the shared shell and does not redirect',
  async ({ app, screen, browser }) => {
    await app.open('/matchups?date=2026-01-15');

    await expect(browser).toHaveURL(/\/matchups/);
    await expect(screen.getByRole('navigation', 'Primary')).toBeVisible();
    await expect(screen.getByRole('link', 'Matchups')).toBeVisible();
    await expect(screen.getByRole('heading', 'Sign in to view the slate')).toBeVisible();
    await expect(screen.getByRole('button', 'Sign in with Google')).toBeVisible();
    await expect(screen.getByRole('button', 'Sign up free')).toBeVisible();
    // Extra: the first URL check can pass before a late redirect, so check the
    // address again once the signed-out page has rendered.
    await expect(browser).toHaveURL('/matchups?date=2026-01-15');
    await app.screenshot('slate-signed-out');

    await app.open('/matchups/0022500584?player=2544');
    await expect(browser).toHaveURL('/matchups/0022500584?player=2544');
    await expect(screen.getByRole('heading', 'Sign in to view this matchup')).toBeVisible();
    await expect(screen.getByRole('button', 'Sign up free')).toBeVisible();
    await expect(screen.getByRole('navigation', 'Primary')).toBeVisible();
    await app.screenshot('matchup-signed-out-deep-link');
  },
);

signedOutTest(
  'unknown paths return to the search landing page',
  async ({ app, screen, browser }) => {
    await app.open('/not-a-route');
    await expect(browser).toHaveURL('/');
    await expect(screen.getByRole('heading', 'Ask the box score')).toBeVisible();
  },
);

signedInTest(
  'a rejected slate request leaves date navigation available',
  async ({ app, screen, api }) => {
    await api.override({
      '/api/games/slate': {
        status: 503,
        body: { error: { code: 'provider_unavailable', message: 'Schedule is unavailable.' } },
      },
    });

    await app.open('/matchups?date=2026-01-15');

    await expect(screen.getByRole('alert')).toContainText('Schedule is unavailable.');
    await expect(screen.getByRole('button', 'Next date')).toBeEnabled();
    await expect(screen.getByLabel('Slate date')).toBeEnabled();
  },
);

signedInTest(
  'an invalid requested date stays neutral until the backend rejects it',
  async ({ app, screen, browser, api }) => {
    await freezeClock(browser, FIXED_NOW);
    await api.override({
      '/api/games/slate': (request) => {
        const date = new URL(request.url()).searchParams.get('date');
        if (date === '2026-02-30') {
          return {
            status: 400,
            body: { error: { code: 'invalid_input', message: 'Enter a valid date.' } },
          };
        }
        return slatePayload('2026-01-15', [slateGame]);
      },
    });

    await app.open('/matchups?date=2026-02-30');

    await expect(screen.getByRole('heading', 'Invalid slate date')).toBeVisible();
    await expect(screen.getByText(/requested date.*2026-02-30.*invalid/i)).toBeVisible();
    await expect(screen.getByRole('button', 'Previous date')).toBeDisabled();
    await expect(screen.getByRole('button', 'Next date')).toBeDisabled();
    await expect(screen.getByRole('alert')).toContainText('Enter a valid date.');
    await expect(screen.getByRole('button', 'Today')).toBeVisible();

    await screen.getByRole('button', 'Today').tap();
    await expect(browser).toHaveURL(/\/matchups\?date=2026-01-15$/);
    await expect(screen.getByRole('heading', 'Thursday, January 15, 2026')).toBeVisible();
  },
);

signedInTest(
  'explicit unavailable pool status wins over stale provider evidence',
  async ({ app, screen, browser, api }) => {
    await freezeClock(browser, FIXED_NOW);
    await api.override({
      '/api/games/slate': {
        body: slatePayload(
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
      },
    });

    await app.open('/matchups?date=2026-01-15');

    await expect(
      screen.getByText(/player pool is unavailable; no targetable players/i),
    ).toBeVisible();
    await expect(screen.getByText('prizepicks pool is stale-served — as of 3h ago')).toBeVisible();
    await expect(
      screen.getByLabel('0 targetable players, LAL 0, BOS 0', { exact: false }),
    ).toBeVisible();
    await app.screenshot('slate-pool-unavailable');
  },
);

signedInTest(
  'minimum slate freshness payload renders through the browser contract',
  async ({ app, screen, browser, api }) => {
    await freezeClock(browser, FIXED_NOW);
    await api.override({
      '/api/games/slate': {
        body: {
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
      },
    });

    await app.open('/matchups?date=2026-01-15');

    const freshness = screen.getByRole('group', 'Data freshness');
    await expect(freshness).toBeVisible();
    await expect(screen.getByText('Schedule is stale — as of 31h ago')).toBeVisible();
    await expect(freshness.getByText(/player pool is partial/i)).toBeVisible();
    await expect(screen.getByText('Final after review')).toBeVisible();
    await expect(screen.getByText('Preseason')).toBeVisible();
    await expect(screen.getByText('NBA Paris Game', { exact: false })).toHaveCount(0);
    await expect(screen.getByText(/counts reflect the available boards/i)).toBeVisible();
  },
);

signedInTest(
  'provider aggregate uses the oldest timestamp regardless of provider key order',
  async ({ app, screen, browser, api }) => {
    await freezeClock(browser, FIXED_NOW);
    await api.override({
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

    await app.open('/matchups?date=2026-01-15');
    await expect(
      screen.getByText(/player pool is stale — as of 30m ago.*older than 15m freshness bar/i),
    ).toBeVisible();

    await screen.getByLabel('Slate date').fill('2026-01-16');
    await expect(
      screen.getByText(/player pool is stale — as of 30m ago.*older than 15m freshness bar/i),
    ).toBeVisible();
  },
);

signedInTest(
  'slate remains usable at a narrow viewport and from the keyboard',
  async ({ app, screen, browser }) => {
    await freezeClock(browser, FIXED_NOW);
    await browser.setViewport({ width: 393, height: 852 });
    await app.open('/matchups?date=2026-01-15');
    await expect(screen.getByRole('heading', 'LAL @ BOS')).toBeVisible();

    const searchLink = screen.getByRole('link', { name: 'Search', exact: false });
    await searchLink.focus();
    await browser.keyboard.press('Tab');
    await expect(screen.getByRole('link', { name: 'Matchups', exact: false })).toBeFocused();
    await browser.keyboard.press('Tab');
    await expect(screen.getByRole('link', 'Targets')).toBeFocused();
    await browser.keyboard.press('Tab');
    await expect(screen.getByRole('link', { name: 'Connect', exact: false })).toBeFocused();
    await browser.keyboard.press('Tab');
    await expect(screen.getByRole('button', /CourtAI Test User/i)).toBeFocused();
    await browser.keyboard.press('Tab');
    await expect(screen.getByRole('button', { name: 'Previous date', exact: false })).toBeFocused();

    expect(
      await browser.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  },
);
