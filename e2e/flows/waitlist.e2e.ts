// Ported from e2e/specs/waitlist.spec.js, which stays: its other two tests observe
// browser responses (see MIGRATION.md). Titles are the source titles.
import { expect } from 'e2e';
import { signedInTest, waitlistedTest } from './support/courtai.ts';

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
