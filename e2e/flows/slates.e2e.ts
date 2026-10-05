// Flow: Slates (/matchups). A signed-in reader opens a dated slate, steps
// between dates, reaches an empty slate, and recovers from a rejected one.
import { expect } from 'e2e';
import { slatePayload } from '../fixtures/courtai.js';
import { overflowsHorizontally, signedInTest, signedOutTest } from './support/courtai.ts';

signedInTest(
  'a dated slate lists its game and the date controls step through the calendar',
  { tags: ['critical'] },
  async ({ app, screen, browser, api }) => {
    // Pin both Date() and Date.now() before the app computes Today. The web
    // engine exposes init scripts rather than Playwright's page.clock.
    await browser.addInitScript(() => {
      const RealDate = Date;
      const instant = RealDate.parse('2026-04-01T02:00:00Z'); // March 31 in New York.
      window.Date = new Proxy(RealDate, {
        construct: (target, args) => Reflect.construct(target, args.length ? args : [instant]),
        apply: () => new RealDate(instant).toString(),
        get: (target, key) => (key === 'now' ? () => instant : Reflect.get(target, key)),
      });
    });
    await app.open('/matchups?date=2026-01-15');

    await expect(screen.getByRole('heading', 'Thursday, January 15, 2026')).toBeVisible();
    await expect(screen.getByRole('heading', 'LAL @ BOS')).toBeVisible();
    await expect(screen.getByLabel('Slate date')).toHaveValue('2026-01-15');
    await expect(screen.getByText('Los Angeles Lakers at Boston Celtics')).toBeVisible();
    expect(api.sent('/api/games/slate')[0].search.get('date')).toBe('2026-01-15');
    expect(await overflowsHorizontally(browser)).toBe(false);

    await screen.getByRole('button', 'Next date').tap();
    await expect(browser).toHaveURL('/matchups?date=2026-01-16');
    await expect(screen.getByRole('heading', 'Friday, January 16, 2026')).toBeVisible();

    await expect(screen.getByLabel('Slate date')).toHaveValue('2026-01-16');
    await screen.getByRole('button', 'Previous date').tap();
    await expect(browser).toHaveURL('/matchups?date=2026-01-15');
    await expect(screen.getByLabel('Slate date')).toHaveValue('2026-01-15');

    await screen.getByLabel('Slate date').fill('2026-03-29');
    await expect(browser).toHaveURL('/matchups?date=2026-03-29');
    await expect(screen.getByRole('heading', 'LAC @ MIL')).toBeVisible();
    await expect(screen.getByLabel('Slate date')).toHaveValue('2026-03-29');

    const today = '2026-03-31';
    await screen.getByRole('button', 'Today').tap();
    await expect(browser).toHaveURL(`/matchups?date=${today}`);
    await expect(screen.getByLabel('Slate date')).toHaveValue(today);
    await expect(screen.getByRole('button', 'Today')).toBeDisabled();
  },
);

signedInTest('a date with no games says so', async ({ app, screen, api }) => {
  await api.override({ '/api/games/slate': { body: slatePayload('2026-01-14', []) } });
  await app.open('/matchups?date=2026-01-14');

  await expect(screen.getByRole('heading', 'Wednesday, January 14, 2026')).toBeVisible();
  await expect(screen.getByText('No games on this slate.')).toBeVisible();
});

signedInTest(
  'a rejected slate shows the reason and leaves date navigation usable',
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
    await api.override({});
    await screen.getByLabel('Slate date').fill('2026-03-29');
    await expect(screen.getByRole('heading', 'LAC @ MIL')).toBeVisible();
  },
);

signedInTest(
  'an impossible date is named and only Today is offered',
  async ({ app, screen, api }) => {
    await api.override({
      '/api/games/slate': {
        status: 400,
        body: { error: { code: 'invalid_input', message: 'Enter a valid date.' } },
      },
    });
    await app.open('/matchups?date=2026-02-30');

    await expect(screen.getByRole('heading', 'Invalid slate date')).toBeVisible();
    await expect(screen.getByText('Requested date “2026-02-30” is invalid.')).toBeVisible();
    await expect(screen.getByLabel('Slate date')).toHaveValue('');
    await expect(screen.getByRole('alert')).toContainText('Enter a valid date.');
    await expect(screen.getByRole('button', 'Previous date')).toBeDisabled();
    await expect(screen.getByRole('button', 'Next date')).toBeDisabled();
    await expect(screen.getByRole('button', 'Today')).toBeEnabled();
  },
);

signedOutTest(
  'a signed-out reader keeps the shell and the deep link',
  async ({ app, screen, browser, api }) => {
    await app.open('/matchups?date=2026-01-15');
    await expect(screen.getByRole('heading', 'Sign in to view the slate')).toBeVisible();
    await expect(screen.getByRole('navigation', 'Primary')).toBeVisible();
    expect(api.sent('/api/games/slate')).toHaveLength(0);

    await app.open('/matchups/0022500584?player=2544');
    await expect(browser).toHaveURL('/matchups/0022500584?player=2544');
    await expect(screen.getByRole('heading', 'Sign in to view this matchup')).toBeVisible();
  },
);

signedInTest(
  'the agent moves the slate to another date',
  { tags: ['agent'] },
  async ({ app, agent, screen, browser }) => {
    await app.open('/matchups?date=2026-01-15');
    await expect(screen.getByRole('heading', 'LAL @ BOS')).toBeVisible();

    await agent.act('show the slate for {date}', { params: { date: 'March 29, 2026' } });
    await expect(browser).toHaveURL('/matchups?date=2026-03-29');
    await expect(screen.getByRole('heading', 'LAC @ MIL')).toBeVisible();
  },
);
