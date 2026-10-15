import { expect, test } from '../fixtures/courtai';

const MESSAGE = "The beta is full right now. You're on the waitlist and we'll let you in soon.";

test('a waitlisted user sees the waitlist screen and can sign out', async ({ waitlistedPage }) => {
  const page = waitlistedPage;
  await page.goto('/');

  await expect(
    page.getByRole('heading', { level: 1, name: "You're on the waitlist" }),
  ).toBeVisible();
  await expect(page.getByText(MESSAGE, { exact: true })).toBeVisible();
  await expect(page.getByText('e2e@courtai.test', { exact: true })).toBeVisible();
  // The signed-in app is replaced, not covered.
  await expect(page.getByRole('navigation', { name: 'Primary' })).toHaveCount(0);

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
