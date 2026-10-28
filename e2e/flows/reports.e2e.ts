// CourtAI reports (crf04/statsplus#342): a published report is a public page.
import { expect } from 'e2e';
import type { Browser } from '@e2e-dev/web';
import { reportPayload, researchEntry, researchPayload } from '../fixtures/courtai.js';
import { signedOutTest, waitlistedTest } from './support/courtai.ts';

const REPORT = '/reports/k3x9q2mtzr';
const TITLE = 'Injury brief · Sunday, October 25';

type CardFrame = { title: string | null; sandbox: string | null; html: number };

const cardFrames = (browser: Browser): Promise<CardFrame[]> =>
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
    // Every card kind draws from its stored HTML: on/off, rotation, injury report here,
    // game logs and matchup in the spot below.
    for (const chip of ['Rotation', 'Report']) {
      await screen.getByRole('button', chip).tap();
      expect((await cardFrames(browser)).map((frame: CardFrame) => frame.title)).toEqual([chip]);
    }

    // Spots: a graded row opens into its story beside its cards.
    await screen.getByRole('tab', /Spots/).tap();
    await screen.getByText('Desmond Bane o18.5 PTS', { exact: false }).tap();
    await expect(screen.getByRole('button', 'Bane PTS w/o Banchero')).toBeVisible();
    await screen.getByRole('button', 'Bane matchup').tap();
    expect((await cardFrames(browser)).map((frame: CardFrame) => frame.title)).toEqual([
      'Bane matchup',
    ]);

    await screen.getByRole('tab', /Set aside/).tap();
    // A list item that carries more than a line opens like a row, card included.
    await screen.getByText('Ausar Thompson (DET)', { exact: true }).tap();
    await expect(screen.getByText('Set aside: his absence moves nobody.')).toBeVisible();
    expect((await cardFrames(browser)).map((frame: CardFrame) => frame.title)).toEqual(['Report']);
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

signedOutTest(
  'a signed-out visitor finds a listed report from the nav and its author page',
  async ({ app, screen, api }) => {
    const listed = researchPayload({ reports: [researchEntry()] });
    await api.override({
      '/api/research': { body: listed },
      '/api/research/authors/bighatprops': { body: listed },
      '/api/reports/k3x9q2mtzr': () => ({
        report: {
          ...reportPayload().report,
          listed: true,
          author: { label: '@bighatprops', handle: 'bighatprops' },
        },
      }),
    });
    await app.open('/privacy');
    await screen.getByRole('link', 'Research').tap();
    await expect(screen.getByRole('heading', 'Research', { level: 1 })).toBeVisible();
    await screen.getByRole('link', '@bighatprops').tap();
    await expect(screen.getByRole('heading', '@bighatprops', { level: 1 })).toBeVisible();
    await screen.getByRole('link', TITLE).tap();
    await expect(screen.getByRole('heading', TITLE, { level: 1 })).toBeVisible();
    await expect(
      screen.getByText("CourtAI reports facts; this is the author's view.", { exact: false }),
    ).toBeVisible();
    await app.screenshot('research-report');
  },
);
