import { expect, test } from '../fixtures/courtai';

const MESSAGE = "The beta is full right now. You're on the waitlist and we'll let you in soon.";

test('a waitlisted user sees the public home page under a banner and can sign out', async ({
  waitlistedPage,
}) => {
  const page = waitlistedPage;
  const refused = [];
  page.on('response', (response) => {
    if (response.status() === 403) refused.push(new URL(response.url()).pathname);
  });
  await page.goto('/');

  await expect(page.getByRole('heading', { name: "You're on the waitlist" })).toBeVisible();
  await expect(page.getByText(MESSAGE, { exact: true })).toBeVisible();
  await expect(page.getByText('e2e@courtai.test', { exact: true })).toBeVisible();
  // The signed-in app is narrowed to the public page, not replaced.
  await expect(page.getByRole('navigation', { name: 'Primary' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: "Today's games" })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Get more specific' })).toBeVisible();
  await expect(page.getByRole('article', { name: 'Best: Austin Reaves' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Your Targets' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Sign up free' })).toHaveCount(0);
  await expect(page.getByRole('textbox')).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Browse without a query' })).toBeDisabled();
  await expect(page.getByRole('alert')).toHaveCount(0);
  // The account learns it is waitlisted from the refusal of its first
  // authenticated reads. Once the banner is up, nothing more is sent that
  // would be refused, and the public sections did not need any of them.
  const discovery = [...refused];
  expect(refused).not.toContain('/api/games/slate');
  expect(refused).not.toContain('/api/games/slate/edges');
  expect(refused).not.toContain('/api/games/ladder');

  // Every other path returns to the home page.
  await page
    .getByRole('navigation', { name: 'Primary' })
    .getByRole('link', { name: 'Matchups' })
    .click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { name: "You're on the waitlist" })).toBeVisible();
  await expect(page.getByRole('navigation', { name: "Today's games" })).toBeVisible();
  expect(refused).toEqual(discovery);

  await page.getByRole('button', { name: 'Sign out' }).click();

  await expect(page.getByRole('heading', { name: 'Ask the box score' })).toBeVisible();
  await expect(page.getByRole('button', { name: /sign in with google/i }).first()).toBeVisible();
  await expect(page.getByRole('heading', { name: "You're on the waitlist" })).toHaveCount(0);
});

test('other 403 responses leave the signed-in app in place', async ({ authenticatedPage }) => {
  const page = authenticatedPage;
  await page.route('**/api/**', (route) =>
    route.fulfill({
      status: 403,
      json: { error: { code: 'forbidden', message: 'Admin access required.' } },
    }),
  );
  const refused = page.waitForResponse(
    (response) => response.url().includes('/api/') && response.status() === 403,
  );
  await page.goto('/');
  await refused;
  // Let React render whatever the refusal caused before looking.
  await page.evaluate(
    () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))),
  );

  await expect(page.getByRole('navigation', { name: 'Primary' })).toBeVisible();
  await expect(page.getByRole('heading', { name: "You're on the waitlist" })).toHaveCount(0);
});

for (const search of ['?browse=1', '?player_name=LeBron+James']) {
  test(`a waitlisted account opening /${search} lands on the public home page under the banner`, async ({
    waitlistedPage: page,
  }) => {
    await page.goto(`/${search}`);

    await expect(page.getByRole('heading', { name: "You're on the waitlist" })).toBeVisible();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('heading', { name: 'Get more specific' })).toBeVisible();
    await expect(page.getByRole('textbox')).toBeDisabled();
  });
}

test('the ladder route refuses any query parameter like the backend', async ({
  authenticatedPage: page,
}) => {
  await page.goto('/');
  const refusal = await page.evaluate(async () => {
    const response = await fetch('/api/games/ladder?player_name=LeBron+James');
    return { status: response.status, body: await response.json() };
  });

  expect(refusal).toEqual({
    status: 400,
    body: { error: { code: 'invalid_input', message: 'The ladder takes no query parameters.' } },
  });
});
