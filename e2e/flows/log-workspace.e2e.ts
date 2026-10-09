// Flow: Log Workspace. Browse without a query, apply a structured filter
// through the filter panel, undo it with browser Back, and refuse a link
// carrying an unusable value.
import type { Screen } from 'e2e';
import { expect } from 'e2e';
import { averages, gameLogs } from '../fixtures/courtai.js';
import { overflowsHorizontally, signedInTest } from './support/courtai.ts';

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
  await expect(screen.getByText('POINTS', { exact: true })).toBeVisible();
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
