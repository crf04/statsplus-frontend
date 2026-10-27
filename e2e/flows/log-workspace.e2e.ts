// Flow: Log Workspace. Browse without a query, apply a structured filter
// through the filter panel, undo it with browser Back, and refuse a link
// carrying an unusable value.
import type { Screen } from 'e2e';
import { expect } from 'e2e';
import { averages, gameLogs } from '../fixtures/courtai.js';
import { freezeClock, overflowsHorizontally, signedInTest } from './support/courtai.ts';

// The first logged game scored 31, the second 27; `game_filter=1` keeps only
// the first, so the two Filter Sets are told apart by the cells they show.
const lastOneGame = (request: { url(): string }) => ({
  game_logs:
    new URL(request.url()).searchParams.get('game_filter') === '1'
      ? gameLogs.slice(0, 1)
      : gameLogs,
  averages: [averages],
  season_averages: [averages],
  season_game_count: gameLogs.length,
  next_game: 'Atlanta Hawks',
});

const setLastNGames = async (screen: Screen, games: string) => {
  const panel = screen.getByTestId('filter-panel');
  const field = screen.getByLabel('Last N games');
  if (!(await field.isVisible())) await panel.getByRole('button', '+ Last N').tap();
  await field.fill(games);
  await screen.getByRole('button', { name: /^Apply/ }).tap();
};

signedInTest(
  'browsing without a query reaches game logs with no language model',
  { tags: ['critical'] },
  async ({ app, screen, browser, api }) => {
    await app.open('/');
    await screen.getByRole('button', 'Browse without a query').tap();
    await expect(browser).toHaveURL('/?browse=1');

    await screen.getByLabel('Player:').fill('LeBron');
    await screen.getByRole('option', 'LeBron James').tap();

    await expect(screen.getByRole('heading', 'Game Logs')).toBeVisible();
    await expect(screen.getByRole('cell', '31')).toBeVisible();
    expect(api.sent('/api/nl-query')).toHaveLength(0);
    expect(await overflowsHorizontally(browser)).toBe(false);
  },
);

signedInTest(
  'a filter applied from the panel reaches the request and browser Back undoes it',
  { tags: ['critical'] },
  async ({ app, screen, browser, api }) => {
    await api.override({ '/api/games/game_logs': lastOneGame });
    await app.open('/?player_name=LeBron+James');
    await expect(screen.getByRole('heading', 'Game Logs')).toBeVisible();
    await expect(screen.getByRole('cell', '27')).toBeVisible();

    const requestsBeforeApply = api.sent('/api/games/game_logs').length;
    await setLastNGames(screen, '1');

    await expect(browser).toHaveURL('/?player_name=LeBron+James&game_filter=1');
    await expect(screen.getByText('GAMES <= 1').first()).toBeVisible();
    await expect(screen.getByRole('cell', '31')).toBeVisible();
    await expect(screen.getByRole('cell', '27')).toHaveCount(0);
    expect(api.sent('/api/games/game_logs')).toHaveLength(requestsBeforeApply + 1);
    expect(api.sent('/api/games/game_logs')[requestsBeforeApply].search.get('game_filter')).toBe(
      '1',
    );
    // The table card has no named region, and its badges sit outside the table.
    // Scope via its heading so the chart's duplicate badge cannot satisfy this.
    // Keep this local until the card gains a semantic region for product navigation.
    expect(
      await browser.evaluate(
        () =>
          [...document.querySelectorAll('h4')].find(
            (heading) => heading.textContent === 'Game Logs',
          )?.parentElement?.textContent ?? null,
      ),
    ).toContain('GAMES <= 1');

    await browser.back();
    await expect(browser).toHaveURL('/?player_name=LeBron+James');
    await expect(screen.getByRole('cell', '27')).toBeVisible();
    await expect(screen.getByText('GAMES <= 1')).toHaveCount(0);
  },
);

signedInTest(
  'a link with an unusable value names it and requests nothing',
  async ({ app, screen, api }) => {
    await app.open('/?player_name=LeBron+James&game_filter=-3');

    await expect(screen.getByRole('alert')).toContainText('game_filter');
    await expect(screen.getByRole('button', 'Save Filter Set')).toHaveCount(0);
    expect(api.sent('/api/games/game_logs')).toHaveLength(0);
  },
);

signedInTest(
  'the agent narrows the workspace to the last game',
  { tags: ['agent'] },
  async ({ app, agent, screen, browser, api }) => {
    await api.override({ '/api/games/game_logs': lastOneGame });
    await app.open('/?player_name=LeBron+James');
    await expect(screen.getByRole('cell', '27')).toBeVisible();

    await agent.act('limit the game logs to the last {games} game and apply it', {
      params: { games: '1' },
    });
    await expect(browser).toHaveURL('/?player_name=LeBron+James&game_filter=1');
    await expect(screen.getByRole('cell', '27')).toHaveCount(0);
    await expect(screen.getByRole('cell', '31')).toBeVisible();
  },
);

signedInTest(
  'an empty result says so without displaying stale game rows',
  async ({ app, screen, api }) => {
    await api.override({
      '/api/games/game_logs': {
        body: { game_logs: [], averages: [], season_averages: [], season_game_count: 0 },
      },
    });
    await app.open('/?player_name=LeBron+James&game_filter=1');
    await expect(screen.getByRole('heading', 'No game logs to display')).toBeVisible();
    await expect(screen.getByRole('cell', '31')).toHaveCount(0);
  },
);

signedInTest(
  'a failed game-log request explains the failure and recovers on reload',
  async ({ app, screen, browser, api }) => {
    let failed = true;
    await api.override({
      '/api/games/game_logs': (request) =>
        failed
          ? { status: 503, body: { error: { message: 'Game logs temporarily unavailable.' } } }
          : lastOneGame(request),
    });
    await app.open('/?player_name=LeBron+James&game_filter=1');
    await expect(
      screen.getByRole('alert').filter({ hasText: 'Game logs temporarily unavailable.' }),
    ).toBeVisible();
    failed = false;
    await browser.reload();
    await expect(screen.getByRole('cell', '31')).toBeVisible();
    await expect(screen.getByRole('cell', '27')).toHaveCount(0);
  },
);

signedInTest('the workspace shows stats cards and per-36 averages', async ({ app, screen }) => {
  await app.open('/?player_name=LeBron+James&game_filter=10');
  await expect(screen.getByRole('cell', '31')).toBeVisible();
  await expect(screen.getByRole('group', 'Points')).toBeVisible();
  await expect(screen.getByText('29.0', { exact: true })).toBeVisible();
  await expect(screen.getByText('+2.0 vs Season', { exact: true })).toBeVisible();
  await expect(screen.getByRole('heading', 'Per 36 Minutes Comparison')).toBeVisible();
  await expect(screen.getByText('2 of 2 games', { exact: true })).toBeVisible();
  await expect(screen.getByText('29.8', { exact: true })).toBeVisible();
  await expect(screen.getByText('27.8', { exact: true })).toBeVisible();
});

signedInTest(
  'a pending Apply clears the previous rows until its response arrives',
  async ({ app, screen, api }) => {
    let release!: () => void;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    await api.override({
      '/api/games/game_logs': async (request) => {
        if (new URL(request.url()).searchParams.get('game_filter') === '1') await pending;
        return lastOneGame(request);
      },
    });
    await app.open('/?player_name=LeBron+James');
    await expect(screen.getByRole('cell', '27')).toBeVisible();
    try {
      await setLastNGames(screen, '1');
      await expect
        .poll(
          () =>
            api
              .sent('/api/games/game_logs')
              .filter((request) => request.search.get('game_filter') === '1').length,
        )
        .toBe(1);
      await expect(screen.getByRole('cell', '27')).toHaveCount(0);
      await expect(screen.getByRole('cell', '31')).toHaveCount(0);
    } finally {
      release();
    }
    await expect(screen.getByRole('cell', '31')).toBeVisible();
    await expect(screen.getByRole('cell', '27')).toHaveCount(0);
  },
);

signedInTest(
  'the Season select switches the season in the URL and the results, keeping the other filters',
  async ({ app, screen, browser, api }) => {
    await app.open('/?player_name=LeBron+James&game_filter=10');
    await expect(screen.getByRole('cell', '31')).toBeVisible();
    await expect(screen.getByRole('combobox', 'Season')).toHaveValue('2025-26');
    expect(api.sent('/api/games/seasons')).toHaveLength(1);
    expect(await overflowsHorizontally(browser)).toBe(false);

    await screen.getByRole('combobox', 'Season').selectOption({ value: '2026-27' });

    await expect(browser).toHaveURL(
      '/?player_name=LeBron+James&season_filter=2026-27&game_filter=10',
    );
    await expect(screen.getByRole('cell', '44')).toBeVisible();
    await expect(screen.getByRole('combobox', 'Season')).toHaveValue('2026-27');
    expect(api.sent('/api/games/game_logs').at(-1)?.search.get('season_filter')).toBe('2026-27');
    expect(await overflowsHorizontally(browser)).toBe(false);

    // A reload, and the same link opened fresh, keep the season.
    await browser.reload();
    await expect(screen.getByRole('combobox', 'Season')).toHaveValue('2026-27');
    await expect(screen.getByRole('cell', '44')).toBeVisible();
    await app.open('/?player_name=Stephen+Curry&season_filter=2026-27');
    await expect(screen.getByRole('combobox', 'Season')).toHaveValue('2026-27');
    // Curry's own 2026-27 game (his 42-point opener plus 13), not LeBron's 44.
    await expect(screen.getByRole('cell', '55')).toBeVisible();
    expect(api.sent('/api/games/game_logs').at(-1)?.search.get('player_name')).toBe(
      'Stephen Curry',
    );
  },
);

signedInTest(
  'the Season select is absent when the seasons cannot be read',
  async ({ app, screen, api }) => {
    await api.override({
      '/api/games/seasons': { status: 503, body: { error: { code: 'provider_unavailable' } } },
    });
    await app.open('/?player_name=LeBron+James&game_filter=10');

    await expect(screen.getByRole('cell', '31')).toBeVisible();
    await expect(screen.getByTestId('filter-panel')).toBeVisible();
    expect(api.sent('/api/games/seasons')).toHaveLength(1);
    await expect(screen.getByRole('combobox', 'Season')).toHaveCount(0);
  },
);

// A backend that serves 2026-27 before its cutover (crf04/statsplus#330)
// offers it as an Unpublished Season beside the Published one.
const serving = (season: string) => ({ served_season: season, state: 'serving' });
const seasonChoices = {
  seasons: ['2025-26', '2024-25'],
  default_season: '2025-26',
  choices: [
    {
      season: '2026-27',
      mode: 'unpublished',
      families: { game_logs: serving('2026-27') },
      team_games: { min: 2, max: 4 },
    },
    { season: '2025-26', mode: 'published', families: { game_logs: serving('2025-26') } },
    { season: '2024-25', mode: 'retained', families: { game_logs: serving('2024-25') } },
  ],
};

// crf04/statsplus#348: on a 2026-27 day the Workspace reads 2026-27 with no
// season chosen, and a chosen 2025-26 is kept in the URL.
signedInTest(
  'an offered 2026-27 is read by default and chipped, a chosen 2025-26 survives a reload, and a refusal is plain',
  async ({ app, screen, browser, api }) => {
    await freezeClock(browser, '2026-10-27T16:00:00Z');
    let refuse = false;
    await api.override({
      '/api/games/seasons': { body: seasonChoices },
      '/api/games/game_logs': (request) =>
        refuse
          ? {
              status: 503,
              body: {
                error: {
                  code: 'season_unavailable',
                  message: 'The requested season is unavailable.',
                  details: { selected_season: '2026-27', published_season: '2025-26' },
                },
              },
            }
          : lastOneGame(request),
    });
    const sentSeasons = () =>
      api.sent('/api/games/game_logs').map((request) => request.search.get('season_filter'));
    await app.open('/?player_name=LeBron+James');
    const season = screen.getByRole('combobox', 'Season');
    await expect(season).toHaveValue('2026-27');
    await expect(screen.getByRole('option', '2026-27 · early, 2–4 games per team')).toHaveCount(1);
    await expect(screen.getByTestId('evidence-season-chip')).toHaveCount(0);
    await expect(screen.getByRole('cell', '31')).toBeVisible();
    await expect(browser).toHaveURL('/?player_name=LeBron+James');
    expect(new Set(sentSeasons())).toEqual(new Set(['2026-27']));
    expect(await overflowsHorizontally(browser)).toBe(false);
    await app.screenshot('season-2026-27-default');

    await season.selectOption({ value: '2025-26' });
    await expect(browser).toHaveURL('/?player_name=LeBron+James&season_filter=2025-26');
    await browser.reload();
    await expect(season).toHaveValue('2025-26');
    await expect(screen.getByRole('cell', '31')).toBeVisible();
    await expect(screen.getByTestId('evidence-season-chip')).toHaveCount(0);
    expect(sentSeasons().at(-1)).toBe('2025-26');
    await app.screenshot('season-2025-26-chosen');

    await season.selectOption({ value: '2026-27' });
    await expect(browser).toHaveURL('/?player_name=LeBron+James');
    await expect(screen.getByTestId('evidence-season-chip')).toHaveCount(0);

    refuse = true;
    await browser.reload();
    await expect(screen.getByRole('alert')).toContainText(
      "2026-27 isn't available yet. CourtAI still reads 2025-26 by default.",
    );
    await expect(screen.getByRole('heading', 'No game logs to display')).toHaveCount(0);
    await expect(screen.getByRole('cell', '31')).toHaveCount(0);
    expect(await overflowsHorizontally(browser)).toBe(false);
    await app.screenshot('season-2026-27-unavailable');
  },
);
