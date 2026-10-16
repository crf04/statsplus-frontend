// Flow: Legal pages. Terms, Privacy and Responsible gambling are public routes
// reached from the footer, the sign-in line and the Connect page, at both widths.
import { expect } from 'e2e';
import { overflowsHorizontally, signedInTest, signedOutTest } from './support/courtai.ts';

const PAGES = [
  { path: '/terms', heading: 'Terms of Use', link: 'Terms', shot: 'legal-terms' },
  { path: '/privacy', heading: 'Privacy Policy', link: 'Privacy', shot: 'legal-privacy' },
  {
    path: '/responsible-gambling',
    heading: 'Responsible gambling',
    link: 'Responsible gambling',
    shot: 'legal-responsible-gambling',
  },
];

signedOutTest(
  'a visitor reaches every legal page from the landing page footer',
  async ({ app, screen, browser }) => {
    for (const { path, heading, link, shot } of PAGES) {
      await app.open('/');
      await expect(screen.getByRole('heading', 'Ask the box score')).toBeVisible();
      await screen.getByRole('navigation', 'Legal').getByRole('link', link).tap();

      await expect(browser).toHaveURL(path);
      await expect(screen.getByRole('heading', heading)).toBeVisible();
      expect(await overflowsHorizontally(browser)).toBe(false);
      await app.screenshot(shot);
    }
  },
);

signedOutTest(
  'a legal page keeps its query string and survives a reload',
  async ({ app, screen, browser }) => {
    await app.open('/privacy?ref=x-picks');
    await expect(screen.getByRole('heading', 'Privacy Policy')).toBeVisible();
    await expect(browser).toHaveURL('/privacy?ref=x-picks');

    await browser.reload();
    await expect(screen.getByRole('heading', 'Privacy Policy')).toBeVisible();
    await expect(browser).toHaveURL('/privacy?ref=x-picks');
  },
);

signedOutTest(
  'the line beside sign-in links the Terms and Privacy',
  async ({ app, screen, browser }) => {
    await app.open('/connect');
    // Under the header's button where the header has room, else in the footer.
    const wide = await browser.evaluate(() => window.innerWidth >= 1000);
    const line = screen
      .getByRole(wide ? 'banner' : 'contentinfo')
      .getByText('By signing in you agree to the Terms and Privacy.');
    await expect(line).toBeVisible();
    await line.getByRole('link', 'Privacy').tap();

    await expect(browser).toHaveURL('/privacy');
    await expect(screen.getByRole('heading', 'Privacy Policy')).toBeVisible();
  },
);

signedOutTest(
  'the Connect page links the Terms and the Privacy Policy',
  async ({ app, screen, browser }) => {
    await app.open('/connect');
    const notes = screen.getByRole('region', 'Good to know');
    await notes.getByRole('link', 'Privacy Policy').tap();
    await expect(browser).toHaveURL('/privacy');
    await expect(screen.getByRole('heading', 'Privacy Policy')).toBeVisible();

    await browser.back();
    await notes.getByRole('link', 'Terms').tap();
    await expect(browser).toHaveURL('/terms');
    await expect(screen.getByRole('heading', 'Terms of Use')).toBeVisible();
  },
);

signedOutTest('responsible gambling gives the helpline as a call link', async ({ app, screen }) => {
  await app.open('/responsible-gambling');
  await expect(screen.getByRole('link', '1-800-GAMBLER')).toHaveAttribute(
    'href',
    'tel:+18004262537',
  );
});

signedInTest(
  'a signed-in reader opens a legal page without the sign-in line',
  async ({ app, screen }) => {
    await app.open('/terms');
    await expect(screen.getByRole('heading', 'Terms of Use')).toBeVisible();
    await expect(screen.getByRole('navigation', 'Primary')).toBeVisible();
    await expect(screen.getByText('By signing in you agree to the Terms and Privacy.')).toHaveCount(
      0,
    );
  },
);
