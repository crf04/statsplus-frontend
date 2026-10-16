import { expect, test } from '../fixtures/courtai';

const PAGES = [
  { path: '/terms', heading: 'Terms of Use', footerLink: 'Terms' },
  { path: '/privacy', heading: 'Privacy Policy', footerLink: 'Privacy' },
  {
    path: '/responsible-gambling',
    heading: 'Responsible gambling',
    footerLink: 'Responsible gambling',
  },
];

const legalNav = (page) => page.getByRole('navigation', { name: 'Legal' });

for (const { path, heading } of PAGES) {
  test(`${path} opens signed out, keeps its query string and survives a reload`, async ({
    page,
  }) => {
    // The signed-in shell sends unknown paths to `/` and drops the query string.
    await page.goto(`${path}?ref=x-picks`);
    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`${path}\\?ref=x-picks$`));

    await page.reload();
    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`${path}\\?ref=x-picks$`));
  });

  test(`${path} opens for a signed-in reader`, async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    await page.goto(`${path}?ref=x-picks`);
    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`${path}\\?ref=x-picks$`));
    await expect(page.getByRole('navigation', { name: 'Primary' })).toBeVisible();
    await expect(page.getByText('By signing in you agree to the')).toHaveCount(0);
  });

  test(`${path} opens for a waitlisted account`, async ({ waitlistedPage }) => {
    const page = waitlistedPage;
    await page.goto(`${path}?ref=x-picks`);
    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`${path}\\?ref=x-picks$`));
    await expect(page.getByRole('heading', { name: "You're on the waitlist" })).toHaveCount(0);
    await expect(legalNav(page)).toBeVisible();
  });
}

test('the footer on the landing page reaches every legal page', async ({ page }) => {
  for (const { path, heading, footerLink } of PAGES) {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Ask the box score' })).toBeVisible();
    await legalNav(page).getByRole('link', { name: footerLink }).click();
    await expect(page).toHaveURL(new RegExp(`${path}$`));
    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
  }
});

test('the Connect page links the Terms and the Privacy Policy', async ({ page }) => {
  await page.goto('/connect');
  const notes = page.locator('section', {
    has: page.getByRole('heading', { name: 'Good to know' }),
  });

  await notes.getByRole('link', { name: 'Privacy Policy' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Privacy Policy' })).toBeVisible();
  await page.goBack();
  await notes.getByRole('link', { name: 'Terms' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Terms of Use' })).toBeVisible();
});

test('the sign-up line under the home page query box reaches the Terms', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Free account. Sign up with Google to run it.')).toBeVisible();

  const line = page.getByText('By signing up you agree to the');
  await expect(line).toBeVisible();
  await line.getByRole('link', { name: 'Terms' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Terms of Use' })).toBeVisible();
});

test('responsible gambling gives the helpline as a call link', async ({ page }) => {
  await page.goto('/responsible-gambling');
  await expect(page.getByRole('link', { name: '1-800-GAMBLER' })).toHaveAttribute(
    'href',
    'tel:+18004262537',
  );
  await expect(
    page.getByText('CourtAI reports facts; it never predicts or gives betting advice.').first(),
  ).toBeVisible();
});

test.describe('sign-in', () => {
  test('desktop: the line under the sign-in button reaches the Terms, and the header keeps its height', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/connect');
    const header = page.getByRole('banner');
    const note = header.getByText('By signing in you agree to the');

    await expect(note).toBeVisible();
    // 69px is --ct-header-height; the workspace controls clear the header by it.
    expect((await header.boundingBox()).height).toBe(69);
    await note.getByRole('link', { name: 'Terms' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Terms of Use' })).toBeVisible();
  });

  test('phone: the same line sits in the footer and the header does not grow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/connect');

    await expect(page.getByRole('banner').getByText('By signing in you agree to the')).toBeHidden();
    const note = page.getByRole('contentinfo').getByText('By signing in you agree to the');
    await expect(note).toBeVisible();
    await note.getByRole('link', { name: 'Privacy' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Privacy Policy' })).toBeVisible();
    // The phone band measures 83px (its links wrap onto a second row; App.css
    // publishes 81px for it, two short on master). A line of text under the
    // button would add 14px or more.
    expect((await page.getByRole('banner').boundingBox()).height).toBeLessThanOrEqual(84);
  });
});

test('tablet: the header keeps its height and the line moves to the footer', async ({ page }) => {
  // Under the button the line wraps in the narrower header and would make it taller.
  await page.setViewportSize({ width: 768, height: 900 });
  await page.goto('/connect');

  await expect(page.getByRole('banner').getByText('By signing in you agree to the')).toBeHidden();
  await expect(
    page.getByRole('contentinfo').getByText('By signing in you agree to the'),
  ).toBeVisible();
  expect((await page.getByRole('banner').boundingBox()).height).toBe(69);
});

test('every legal page fits a phone without sideways scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const { path, heading } of PAGES) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth),
    ).toBe(false);
  }
});

test('a signed-in account that lands on a legal page still records its first touch', async ({
  authenticatedPage,
}) => {
  const page = authenticatedPage;
  const bodies = [];
  page.on('request', (request) => {
    if (request.url().endsWith('/api/user/attribution') && request.method() === 'POST') {
      bodies.push(request.postDataJSON());
    }
  });

  await page.goto('/privacy?utm_source=x&ref=x-picks');
  await expect(page.getByRole('heading', { level: 1, name: 'Privacy Policy' })).toBeVisible();

  await expect.poll(() => bodies.length).toBe(1);
  expect(bodies[0]).toMatchObject({
    utm_source: 'x',
    ref: 'x-picks',
    landing_path: '/privacy',
  });
});
