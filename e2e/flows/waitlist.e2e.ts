// Ported from e2e/specs/waitlist.spec.js, retired 2026-10-16 (see MIGRATION.md).
// Titles are the source titles, in source order.
import { expect } from 'e2e';
import { observeResponses, signedInTest, waitlistedTest } from './support/courtai.ts';

const MESSAGE = "The beta is full right now. You're on the waitlist and we'll let you in soon.";

waitlistedTest(
  'a waitlisted user sees the public home page under a banner and can sign out',
  async ({ app, screen, browser, api }) => {
    // The source listened for every response the page received, in any frame, across
    // navigations. `observeResponses` records the non-`/api` ones for the whole test;
    // the contract records the status of each `/api` one.
    const others = await observeResponses(browser, new URL(app.baseUrl!).origin);
    const refused = () => [
      ...api.requests.filter((r) => r.status === 403).map((r) => r.path),
      ...others.filter((r) => r.status === 403).map((r) => r.path),
    ];
    await app.open('/');

    await expect(screen.getByRole('heading', "You're on the waitlist")).toBeVisible();
    await expect(screen.getByText(MESSAGE, { exact: true })).toBeVisible();
    await expect(screen.getByText('e2e@courtai.test', { exact: true })).toBeVisible();
    // The signed-in app is narrowed to the public page, not replaced.
    await expect(screen.getByRole('navigation', 'Primary')).toBeVisible();
    await expect(screen.getByRole('navigation', "Today's games")).toBeVisible();
    await expect(screen.getByRole('heading', 'Get more specific')).toBeVisible();
    await expect(screen.getByRole('article', 'Best: Austin Reaves')).toBeVisible();
    await expect(screen.getByRole('heading', /Your Targets/i)).toHaveCount(0);
    await expect(screen.getByRole('button', /Sign up free/i)).toHaveCount(0);
    await expect(screen.getByRole('textbox')).toBeDisabled();
    await expect(screen.getByRole('button', 'Browse without a query')).toBeDisabled();
    await expect(screen.getByRole('alert')).toHaveCount(0);
    // The account learns it is waitlisted from the refusal of its first
    // authenticated reads. Once the banner is up, nothing more is sent that
    // would be refused, and the public sections did not need any of them.
    const discovery = refused();
    // Not in the source: an observer that saw nothing would pass the checks below.
    expect(discovery.length).toBeGreaterThan(0);
    expect(others.length).toBeGreaterThan(0);
    expect(refused()).not.toContain('/api/games/slate');
    expect(refused()).not.toContain('/api/games/slate/edges');
    expect(refused()).not.toContain('/api/games/ladder');

    // Every other path returns to the home page.
    await screen.getByRole('navigation', 'Primary').getByRole('link', 'Matchups').tap();
    await expect(browser).toHaveURL(/\/$/);
    await expect(screen.getByRole('heading', "You're on the waitlist")).toBeVisible();
    await expect(screen.getByRole('navigation', "Today's games")).toBeVisible();
    expect(refused()).toEqual(discovery);

    await screen.getByRole('button', 'Sign out').tap();

    await expect(screen.getByRole('heading', 'Ask the box score')).toBeVisible();
    await expect(screen.getByRole('button', /sign in with google/i).first()).toBeVisible();
    await expect(screen.getByRole('heading', /You're on the waitlist/i)).toHaveCount(0);
  },
);

signedInTest(
  'other 403 responses leave the signed-in app in place',
  async ({ app, screen, browser }) => {
    // Newest route first: this answers every `/api` request before the contract.
    await browser.route('**/api/**', (route) =>
      route.fulfill({
        status: 403,
        json: { error: { code: 'forbidden', message: 'Admin access required.' } },
      }),
    );
    await app.open('/');
    // waitForResponse needs an open page, so the browser's own record of the
    // responses it received stands in for the source's waitForResponse.
    await expect
      .poll(() =>
        browser.evaluate(() =>
          performance
            .getEntriesByType('resource')
            .filter((entry) => entry.name.includes('/api/'))
            .map((entry) => (entry as PerformanceResourceTiming).responseStatus),
        ),
      )
      .toContain(403);
    // Let React render whatever the refusal caused before looking.
    await browser.evaluate(
      () =>
        new Promise<null>((done) =>
          requestAnimationFrame(() => requestAnimationFrame(() => done(null))),
        ),
    );

    await expect(screen.getByRole('navigation', 'Primary')).toBeVisible();
    await expect(screen.getByRole('heading', /You're on the waitlist/i)).toHaveCount(0);
  },
);

for (const search of ['?browse=1', '?player_name=LeBron+James']) {
  waitlistedTest(
    `a waitlisted account opening /${search} lands on the public home page under the banner`,
    async ({ app, screen, browser }) => {
      await app.open(`/${search}`);

      await expect(screen.getByRole('heading', "You're on the waitlist")).toBeVisible();
      await expect(browser).toHaveURL(/\/$/);
      await expect(screen.getByRole('heading', 'Get more specific')).toBeVisible();
      await expect(screen.getByRole('textbox')).toBeDisabled();
    },
  );
}

signedInTest(
  'the ladder route refuses any query parameter like the backend',
  async ({ app, browser }) => {
    await app.open('/');
    const refusal = await browser.evaluate(async () => {
      const response = await fetch('/api/games/ladder?player_name=LeBron+James');
      return { status: response.status, body: await response.json() };
    });

    expect(refusal).toEqual({
      status: 400,
      body: { error: { code: 'invalid_input', message: 'The ladder takes no query parameters.' } },
    });
  },
);
