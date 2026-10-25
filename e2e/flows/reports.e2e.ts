// CourtAI reports (crf04/statsplus#342): a published report is a public page.
import { expect } from 'e2e';
import { signedOutTest, waitlistedTest } from './support/courtai.ts';

const REPORT = '/reports/k3x9q2mtzr';
const TITLE = 'Injury brief · Sunday, October 25';

const cardFrames = (browser) =>
  browser.evaluate(() =>
    [...document.querySelectorAll('iframe.report-card')].map((frame) => ({
      title: frame.getAttribute('title'),
      sandbox: frame.getAttribute('sandbox'),
      html: (frame.getAttribute('srcdoc') || '').length,
    })),
  );

signedOutTest(
  'a signed-out visitor reads a report: games, a spot with its cards, set aside',
  async ({ app, screen, browser }) => {
    await app.open(REPORT);
    await expect(screen.getByRole('heading', TITLE, { level: 1 })).toBeVisible();
    await expect(screen.getByText('by @bighatprops', { exact: false })).toBeVisible();

    // Games: a tile opens into its read and its first card, drawn from stored HTML.
    await screen.getByText('The read and cards').first().tap();
    await expect(screen.getByText('Banchero started both games', { exact: false })).toBeVisible();
    expect(await cardFrames(browser)).toEqual([
      { title: 'ORL on/off', sandbox: 'allow-scripts', html: expect.any(Number) },
    ]);
    expect((await cardFrames(browser))[0].html).toBeGreaterThan(1000);

    // Spots: a graded row opens into its story beside its cards.
    await screen.getByRole('tab', /Spots/).tap();
    await screen.getByText('Desmond Bane o18.5 PTS', { exact: false }).tap();
    await expect(screen.getByRole('button', 'Bane PTS w/o Banchero')).toBeVisible();
    await screen.getByRole('button', 'ORL on/off').tap();
    expect((await cardFrames(browser)).map((frame) => frame.title)).toEqual(['ORL on/off']);

    await screen.getByRole('tab', /Set aside/).tap();
    await expect(screen.getByRole('link', 'Make your own →')).toBeVisible();
    await app.screenshot('report');
  },
);

signedOutTest('a report that does not exist says so', async ({ app, screen }) => {
  await app.open('/reports/zzzzzzzzzz');
  await expect(
    screen.getByRole('heading', "This report isn't available", { level: 1 }),
  ).toBeVisible();
});

waitlistedTest('a waitlisted account can still read a report', async ({ app, screen }) => {
  await app.open(REPORT);
  await expect(screen.getByRole('heading', TITLE, { level: 1 })).toBeVisible();
});
