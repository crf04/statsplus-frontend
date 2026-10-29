// Flow: shared Log Workspace links (crf04/statsplus#381). Anyone opens a link
// and reads its game logs, without prices unless signed in. A signed-out
// visitor's change to the Filter Set signs up first and then applies; a
// waitlisted account reads the link as it is. Share tags the link it copies.
import type { Screen } from 'e2e';
import { expect } from 'e2e';
import { RATE_LIMITED, averages, gameLogs, waitlistedResponse } from '../fixtures/courtai.js';
import {
  freezeClock,
  overflowsHorizontally,
  signedInTest,
  signedOutTest,
  waitlistedTest,
} from './support/courtai.ts';
import type { Browser } from '@e2e-dev/web';
import type { Api } from './support/courtai.ts';

const BEARER = 'Bearer courtai-e2e-token';
const SIGNED_OUT_NOTICE = "You're viewing a shared link. Sign up free to change it or save it.";
const WAITLISTED_NOTICE = 'Changing or saving it opens once your account is off the waitlist.';
const QUERY = 'LeBron James last 10 games';

// `game_filter=1` keeps only the first logged game (31 points); without it
// both games show (31 and 27).
const lastOneGame = (request: { url(): string }) => ({
  game_logs:
    new URL(request.url()).searchParams.get('game_filter') === '1'
      ? gameLogs.slice(0, 1)
      : gameLogs,
  averages: [averages],
  season_averages: [averages],
  season_game_count: gameLogs.length,
});

const setLastNGames = async (screen: Screen, games: string) => {
  const panel = screen.getByTestId('filter-panel');
  const field = screen.getByLabel('Last N games');
  if (!(await field.isVisible())) await panel.getByRole('button', '+ Last N').tap();
  await field.fill(games);
  await screen.getByRole('button', { name: /^Apply/ }).tap();
};

const postedLineLabels = async (screen: Screen) => {
  const buttons = await screen.getByRole('group', 'Posted Lines:').getByRole('button').all();
  return Promise.all(buttons.map((button) => button.getAttribute('aria-label')));
};

// What each posted-line button shows: the source and line, then its prices
// only when it has them.
const postedLineTexts = (screen: Screen) =>
  screen.getByRole('group', 'Posted Lines:').getByRole('button').allTextContents();

const UNPRICED_TEXTS = [
  'DABBLE 26.5',
  'UNDERDOG 26.5',
  'DRAFTKINGS 26.5',
  'FANDUEL 26.5',
  'BETRIVERS 27.5',
];

// On 2026-10-27 the backend offers 2026-27 ahead of its cutover beside the
// Published 2025-26, so an admitted account reads 2026-27 by default.
const SEASON_DAY = '2026-10-27T16:00:00Z';
const serving = (season: string) => ({ served_season: season, state: 'serving' });
const seasonChoices = {
  seasons: ['2025-26'],
  default_season: '2025-26',
  choices: [
    {
      season: '2026-27',
      mode: 'unpublished',
      families: { game_logs: serving('2026-27') },
      team_games: { min: 2, max: 4 },
    },
    { season: '2025-26', mode: 'published', families: { game_logs: serving('2025-26') } },
  ],
};

// The lines of the shared-link notice's text that the floating search toggle
// covers; a readable notice has none.
const noticeLinesUnderSearchToggle = (browser: Browser) =>
  browser.evaluate(() => {
    const toggle = document.querySelector('[aria-label="Open search"]')!.getBoundingClientRect();
    const text = document.createRange();
    text.selectNodeContents(document.querySelector('.shared-link-notice')!);
    return [...text.getClientRects()]
      .filter(
        (line) =>
          line.left < toggle.right &&
          toggle.left < line.right &&
          line.top < toggle.bottom &&
          toggle.top < line.bottom,
      )
      .map((line) => ({ top: line.top, left: line.left, width: line.width }));
  });

const gameLogReads = (api: Api) =>
  api.sent('/api/games/game_logs', 'GET').filter((request) => request.search.has('player_name'));

signedOutTest(
  'a signed-out visitor reads a shared link, unpriced, and signing in adds the prices',
  { tags: ['critical'] },
  async ({ app, screen, browser, api }) => {
    await app.open('/?player_name=Stephen+Curry&ref=share');

    await expect(screen.getByRole('status').filter({ hasText: SIGNED_OUT_NOTICE })).toBeVisible();
    await expect(screen.getByRole('heading', 'Game Logs')).toBeVisible();
    await expect(screen.getByRole('cell', '42')).toBeVisible();
    // Dabble's 26.5 is the default line; one of his two games clears it.
    await expect(screen.getByRole('heading', 'Hit rate')).toBeVisible();
    await expect(screen.getByText('1/2', { exact: true }).first()).toBeVisible();
    expect(await postedLineLabels(screen)).toEqual([
      'Dabble 26.5',
      'Underdog 26.5',
      'DraftKings 26.5',
      'FanDuel 26.5',
      'BetRivers 27.5',
    ]);
    expect(await postedLineTexts(screen)).toEqual(UNPRICED_TEXTS);
    await expect(browser).toHaveURL('/?player_name=Stephen+Curry&ref=share');
    // Every read is anonymous, and the attribution tag never reaches the API.
    expect(gameLogReads(api).length).toBeGreaterThan(0);
    for (const request of gameLogReads(api)) {
      expect([request.authorization, request.search.has('ref')]).toEqual([undefined, false]);
    }
    expect(await noticeLinesUnderSearchToggle(browser)).toEqual([]);
    expect(await overflowsHorizontally(browser)).toBe(false);
    await app.screenshot('shared-link-signed-out');

    await screen.getByRole('button', 'Sign in with Google').first().tap();
    await expect(screen.getByText('CourtAI Test User').first()).toBeVisible();
    await expect(screen.getByRole('status').filter({ hasText: SIGNED_OUT_NOTICE })).toHaveCount(0);
    await expect
      .poll(() => postedLineLabels(screen))
      .toEqual([
        'Dabble 26.5, Over −122, Under −122',
        'Underdog 26.5, Over −112, Under −112',
        'DraftKings 26.5, Over −110, Under −115',
        'FanDuel 26.5, Over −114, Under −106',
        'BetRivers 27.5, Over +102, Under −128',
      ]);
  },
);

signedOutTest(
  'a signed-out filter change signs up and then applies the change',
  { tags: ['critical'] },
  async ({ app, screen, browser, api }) => {
    await api.override({ '/api/games/game_logs': lastOneGame });
    await app.open('/?player_name=LeBron+James');
    await expect(screen.getByRole('cell', '27')).toBeVisible();
    await expect(screen.getByRole('button', 'Sign in with Google').first()).toBeVisible();

    await setLastNGames(screen, '1');

    await expect(screen.getByText('CourtAI Test User').first()).toBeVisible();
    await expect(browser).toHaveURL('/?player_name=LeBron+James&game_filter=1');
    await expect(screen.getByRole('cell', '31')).toBeVisible();
    await expect(screen.getByRole('cell', '27')).toHaveCount(0);
    const narrowed = gameLogReads(api).filter((request) => request.search.has('game_filter'));
    expect(narrowed.map((request) => request.authorization)).toEqual([BEARER]);
  },
);

signedOutTest(
  'a signed-out prose search signs up and then runs the query',
  async ({ app, screen, browser, api }) => {
    await app.open('/?player_name=Stephen+Curry');
    await expect(screen.getByRole('cell', '42')).toBeVisible();

    await screen.getByRole('button', 'Open search').tap();
    await screen.getByRole('textbox', 'Ask about your favorite player').fill(QUERY);
    await screen.getByRole('textbox', 'Ask about your favorite player').press('Enter');

    await expect(screen.getByText('CourtAI Test User').first()).toBeVisible();
    await expect(browser).toHaveURL('/?player_name=LeBron+James&game_filter=10');
    await expect(screen.getByRole('cell', '31')).toBeVisible();
    expect(api.sent('/api/nl-query', 'POST').map((request) => request.body)).toEqual([
      { query: QUERY },
    ]);
  },
);

signedOutTest(
  'a signed-out player search signs up and then opens that player',
  async ({ app, screen, browser }) => {
    await app.open('/?player_name=LeBron+James');
    await expect(screen.getByRole('cell', '31')).toBeVisible();

    await screen.getByLabel('Player:').fill('Stephen');
    await screen.getByRole('option', 'Stephen Curry').tap();

    await expect(screen.getByText('CourtAI Test User').first()).toBeVisible();
    await expect(browser).toHaveURL('/?player_name=Stephen+Curry');
    await expect(screen.getByRole('cell', '42')).toBeVisible();
  },
);

signedOutTest(
  'a signed-out Save signs up and then saves the Filter Set without its tag',
  async ({ app, screen, api }) => {
    await app.open('/?player_name=LeBron+James&game_filter=10&ref=share');
    await expect(screen.getByRole('cell', '31')).toBeVisible();

    await screen.getByTestId('filter-panel').getByRole('button', 'Save').tap();

    await expect(screen.getByText('CourtAI Test User').first()).toBeVisible();
    await screen.getByLabel('Name this Filter Set').fill('LeBron last 10');
    await screen.getByLabel('Name this Filter Set').press('Enter');
    await expect(
      screen.getByTestId('filter-panel').getByText('Saved as LeBron last 10').first(),
    ).toBeVisible();
    expect(api.sent('/api/user/saved-filter-sets', 'POST').map((request) => request.body)).toEqual([
      { name: 'LeBron last 10', query_string: 'player_name=LeBron+James&game_filter=10' },
    ]);
  },
);

signedOutTest(
  'a rate-limited signed-out read says to try again shortly, or sign in',
  async ({ app, screen, api }) => {
    await api.override({ '/api/games/game_logs': RATE_LIMITED });
    await app.open('/?player_name=LeBron+James');

    await expect(screen.getByRole('alert')).toHaveText(
      'Too many requests. Try again shortly, or sign in.',
    );
    await expect(screen.getByRole('cell', '31')).toHaveCount(0);
  },
);

waitlistedTest(
  'a waitlisted account keeps a shared link and reads it, unpriced and unchangeable',
  { tags: ['critical'] },
  async ({ app, screen, browser }) => {
    await app.open('/?player_name=Stephen+Curry');

    await expect(screen.getByRole('status').filter({ hasText: WAITLISTED_NOTICE })).toBeVisible();
    await expect(browser).toHaveURL('/?player_name=Stephen+Curry');
    await expect(screen.getByRole('cell', '42')).toBeVisible();
    expect(await postedLineLabels(screen)).toEqual([
      'Dabble 26.5',
      'Underdog 26.5',
      'DraftKings 26.5',
      'FanDuel 26.5',
      'BetRivers 27.5',
    ]);
    expect(await postedLineTexts(screen)).toEqual(UNPRICED_TEXTS);
    await expect(screen.getByRole('button', { name: /^Apply/ })).toBeDisabled();
    await expect(screen.getByLabel('Player:')).toBeDisabled();
    await expect(screen.getByTestId('filter-panel').getByRole('button', 'Save')).toHaveCount(0);
    await expect(screen.getByRole('tab', { name: /^Saved/ })).toHaveCount(0);
    expect(await noticeLinesUnderSearchToggle(browser)).toEqual([]);
    expect(await overflowsHorizontally(browser)).toBe(false);
    await app.screenshot('shared-link-waitlisted');
  },
);

signedInTest(
  'Share copies the link pinned to its season and tagged ref=share, which opens the same Filter Set',
  { tags: ['critical'] },
  async ({ app, screen, browser, api }) => {
    await freezeClock(browser, SEASON_DAY);
    await api.override({ '/api/games/seasons': { body: seasonChoices } });
    await browser.addInitScript(() => {
      Object.defineProperty(navigator, 'share', { value: undefined });
      Object.defineProperty(navigator, 'clipboard', {
        value: {
          writeText: async (text: string) => {
            window.sessionStorage.setItem('share:clipboard', text);
          },
        },
      });
    });
    await app.open('/?player_name=LeBron+James&game_filter=10');
    // 2026-27 holds one game for him, 44 points.
    await expect(screen.getByRole('cell', '44')).toBeVisible();

    await screen.getByRole('button', 'Share').tap();
    await expect(screen.getByRole('button', 'Copied')).toBeVisible();
    const copied = new URL(
      await browser.evaluate(() => window.sessionStorage.getItem('share:clipboard') ?? ''),
    );
    expect(`${copied.pathname}${copied.search}`).toBe(
      '/?player_name=LeBron+James&game_filter=10&season_filter=2026-27&ref=share',
    );

    const readsBefore = gameLogReads(api).length;
    await app.open(`${copied.pathname}${copied.search}`);
    await expect(screen.getByRole('cell', '44')).toBeVisible();
    const opened = gameLogReads(api).slice(readsBefore);
    expect(opened.length).toBeGreaterThan(0);
    for (const request of opened) {
      expect(request.search.get('player_name')).toBe('LeBron James');
      expect(request.search.get('season_filter')).toBe('2026-27');
      expect(request.search.has('ref')).toBe(false);
    }
    expect(
      opened.some((request) => request.search.get('game_filter') === '10'),
      'the copied link reads the same Filter Set',
    ).toBe(true);
  },
);

signedInTest(
  'Share waits for the page season, so a link copied straight after loading still pins it',
  async ({ app, screen, browser, api }) => {
    await freezeClock(browser, SEASON_DAY);
    let release!: () => void;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    await api.override({
      '/api/games/seasons': async () => {
        await pending;
        return seasonChoices;
      },
    });
    await browser.addInitScript(() => {
      Object.defineProperty(navigator, 'share', { value: undefined });
      Object.defineProperty(navigator, 'clipboard', {
        value: {
          writeText: async (text: string) => {
            window.sessionStorage.setItem('share:clipboard', text);
          },
        },
      });
    });
    await app.open('/?player_name=LeBron+James');
    try {
      await expect.poll(() => api.sent('/api/games/seasons').length).toBe(1);
      await expect(screen.getByRole('button', 'Share')).toBeDisabled();
    } finally {
      release();
    }

    await expect(screen.getByRole('cell', '44')).toBeVisible();
    await screen.getByRole('button', 'Share').tap();
    await expect(screen.getByRole('button', 'Copied')).toBeVisible();
    const copied = new URL(
      await browser.evaluate(() => window.sessionStorage.getItem('share:clipboard') ?? ''),
    );
    expect(`${copied.pathname}${copied.search}`).toBe(
      '/?player_name=LeBron+James&season_filter=2026-27&ref=share',
    );
  },
);

signedOutTest(
  'a signed-out link to a season not yet public says so, and signing up reads it',
  async ({ app, screen, browser, api }) => {
    await app.open('/?player_name=LeBron+James&season_filter=2026-27&ref=share');

    await expect(
      screen.getByText(
        "This link uses the 2026-27 season, which isn't public yet. Sign up free to view it.",
      ),
    ).toBeVisible();
    await expect(screen.getByRole('cell', '44')).toHaveCount(0);
    await expect(screen.getByRole('cell', '31')).toHaveCount(0);
    expect(await overflowsHorizontally(browser)).toBe(false);
    await app.screenshot('shared-link-season-held');

    await screen.getByRole('alert').getByRole('button', 'Sign up free').tap();

    await expect(screen.getByText('CourtAI Test User').first()).toBeVisible();
    await expect(screen.getByRole('cell', '44')).toBeVisible();
    expect(gameLogReads(api).at(-1)?.authorization).toBe(BEARER);
  },
);

waitlistedTest(
  'a waitlisted link to a season not yet public says it opens off the waitlist',
  async ({ app, screen }) => {
    await app.open('/?player_name=LeBron+James&season_filter=2026-27');

    await expect(
      screen.getByText(
        "This link uses the 2026-27 season, which isn't public yet. " +
          'It opens once your account is off the waitlist.',
      ),
    ).toBeVisible();
    await expect(screen.getByRole('button', 'Sign up free')).toHaveCount(0);
    await expect(screen.getByRole('cell', '44')).toHaveCount(0);
  },
);

signedInTest(
  'after signing out, a season change signs up first and then applies',
  async ({ app, screen, browser, api }) => {
    await app.open('/?player_name=LeBron+James');
    await expect(screen.getByRole('cell', '31')).toBeVisible();
    await screen.getByRole('banner').getByRole('button', 'CT CourtAI Test User').tap();
    await screen.getByRole('button', 'Sign out').tap();
    await expect(screen.getByRole('status').filter({ hasText: SIGNED_OUT_NOTICE })).toBeVisible();

    await screen.getByRole('combobox', 'Season').selectOption({ value: '2026-27' });

    await expect(screen.getByText('CourtAI Test User').first()).toBeVisible();
    await expect(browser).toHaveURL('/?player_name=LeBron+James&season_filter=2026-27');
    await expect(screen.getByRole('cell', '44')).toBeVisible();
    const chosen = gameLogReads(api).filter(
      (request) => request.search.get('season_filter') === '2026-27',
    );
    expect(new Set(chosen.map((request) => request.authorization))).toEqual(new Set([BEARER]));
  },
);

signedInTest(
  'an account waitlisted mid-session stops showing the prices it read while admitted',
  async ({ app, screen, api }) => {
    await app.open('/?player_name=Stephen+Curry');
    await expect
      .poll(() => postedLineLabels(screen))
      .toContain('DraftKings 26.5, Over −110, Under −115');

    // From here the backend holds the account on the waitlist: game logs come
    // without prices, and its next account write is refused.
    await api.override({
      '/api/games/game_logs': {
        body: {
          game_logs: gameLogs,
          averages: [averages],
          season_averages: [averages],
          season_game_count: gameLogs.length,
          posted_line: {
            lines: { PTS: { value: 26.5, provider: 'dabble' } },
            provider_lines: { dabble: { PTS: 26.5 } },
            book_lines: {
              PTS: {
                as_of: '2026-10-21T15:00:00Z',
                closing: false,
                books: [{ book: 'draftkings', line: 26.5 }],
              },
            },
          },
        },
      },
      '/api/user/saved-filter-sets': {
        status: waitlistedResponse.status,
        body: waitlistedResponse.json,
      },
    });
    await screen.getByTestId('filter-panel').getByRole('button', 'Save').tap();
    await screen.getByLabel('Name this Filter Set').fill('Curry');
    await screen.getByLabel('Name this Filter Set').press('Enter');

    await expect(screen.getByRole('status').filter({ hasText: WAITLISTED_NOTICE })).toBeVisible();
    await expect.poll(() => postedLineTexts(screen)).toEqual(['DABBLE 26.5', 'DRAFTKINGS 26.5']);
  },
);
