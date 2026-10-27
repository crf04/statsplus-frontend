import { expect } from 'e2e';
import {
  HISTORICAL_GAME_ID,
  historicalMatchupPayload,
  postCutoverHistoricalMatchupPayload,
  servingSeasonMatchupPayload,
  slateGame,
  slatePayload,
  SYNERGY_TRAILING,
} from '../fixtures/courtai.js';
import { overflowsHorizontally, signedInTest } from './support/courtai.ts';

signedInTest(
  'a slate opens team sheets and local controls change their evidence',
  { tags: ['critical'] },
  async ({ app, screen, browser, api }) => {
    await app.open('/matchups?date=2026-01-15');
    await screen.getByRole('link', { name: /Open Team Sheets/ }).tap();
    await expect(browser).toHaveURL('/matchups/0022500584');
    await expect(screen.getByRole('heading', 'What BOS allows')).toBeVisible();
    // The page opens on points: the rail leads with LeBron's posted line.
    const categories = screen.getByRole('group', 'Market');
    await expect(categories.getByRole('button', 'PTS')).toHaveAttribute('aria-pressed', 'true');
    await expect(screen.getByRole('article', 'LeBron James player')).toContainText('27.5');
    await expect(screen.getByRole('article', 'Transition')).toBeVisible();
    await expect(screen.getByRole('article', 'Above-the-break 3s')).toHaveCount(0);
    await screen.getByRole('button', 'FG2A').tap();
    await expect(categories.getByRole('button', 'FG2A')).toHaveAttribute('aria-pressed', 'true');
    await expect(categories.getByRole('button', 'PTS')).toHaveAttribute('aria-pressed', 'false');
    await expect(screen.getByRole('article', 'Restricted area')).toBeVisible();
    await expect(screen.getByRole('article', 'Transition')).toHaveCount(0);
    await screen.getByRole('button', 'FG3A').tap();
    await expect(screen.getByRole('article', 'Catch-and-shoot 3s')).toBeVisible();
    await expect(screen.getByRole('article', 'Restricted area')).toHaveCount(0);
    await expect(screen.getByRole('button', 'BOS defense vs LAL players')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await screen.getByRole('button', 'LAL defense vs BOS players').tap();
    await expect(screen.getByRole('button', 'LAL defense vs BOS players')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(screen.getByRole('button', 'BOS defense vs LAL players')).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    await expect(screen.getByRole('heading', 'What LAL allows')).toBeVisible();
    await expect(screen.getByRole('article', 'Jayson Tatum player')).toBeVisible();
    expect(api.sent('/api/games/matchup')).toHaveLength(1);
    expect(await overflowsHorizontally(browser)).toBe(false);
  },
);

signedInTest(
  'historical sheets distinguish unavailable snapshots from published season evidence',
  async ({ app, screen }) => {
    await app.open('/matchups/0022501082');
    await expect(screen.getByRole('heading', 'What MIL allows')).toBeVisible();
    await expect(screen.getByRole('region', 'Matchup summary')).toContainText(
      'Final. Full-season defense ranks; no Last 15 or injury report.',
    );
    await expect(screen.getByRole('button', 'Last 15')).toBeDisabled();
    await expect(screen.getByRole('article', 'Transition')).toBeVisible();
    const kawhi = screen.getByRole('article', 'Kawhi Leonard player');
    await expect(kawhi).toContainText('+2.6 vs his season average');
    await expect(kawhi).toContainText('24');
    await screen.getByRole('group', 'Stat category').getByRole('button', 'All').tap();
    await expect(screen.getByRole('article', 'Above-the-break 3s')).toBeVisible();
    await screen.getByRole('group', 'Stat category').getByRole('button', 'PTS').tap();
    await expect(screen.getByRole('article', 'Transition')).toBeVisible();
    await expect(screen.getByRole('article', 'Above-the-break 3s')).toHaveCount(0);
  },
);

signedInTest(
  'selection cards preserve history, change the log stat, and close by button or Escape',
  { tags: ['critical'] },
  async ({ app, screen, browser, api }) => {
    await app.open('/matchups/0022500584?context=kept');
    await screen
      .getByRole('article', 'LeBron James player')
      .getByRole('button', 'Open selection card')
      .tap();
    await expect(browser).toHaveURL('/matchups/0022500584?context=kept&player=2544');
    await expect(screen.getByRole('heading', 'LeBron James')).toBeVisible();
    await expect(screen.getByRole('region', 'LeBron James')).toBeFocused();
    const matrix = screen.getByRole('table', 'LeBron James Score Matrix');
    await expect(matrix).toContainText('+12%');
    await expect(matrix.getByRole('button', 'PTS')).toHaveAttribute('aria-pressed', 'true');
    const logStats = screen.getByRole('group', 'Selection log stat');
    await expect(logStats.getByRole('button', 'PTS')).toHaveAttribute('aria-pressed', 'true');
    await logStats.getByRole('button', 'PRA').tap();
    await expect(logStats.getByRole('button', 'PRA')).toHaveAttribute('aria-pressed', 'true');
    await expect(logStats.getByRole('button', 'PTS')).toHaveAttribute('aria-pressed', 'false');
    await expect(matrix.getByRole('button', 'PRA')).toHaveAttribute('aria-pressed', 'true');
    await expect(matrix.getByRole('button', 'PTS')).toHaveAttribute('aria-pressed', 'false');
    await expect(screen.getByRole('columnheader', 'PRA').first()).toBeVisible();
    await expect(screen.getByText('+0.102').first()).toBeVisible();
    expect(api.sent('/api/games/matchup/selection')).toHaveLength(1);
    expect(await overflowsHorizontally(browser)).toBe(false);
    await app.screenshot('selection-card');
    await browser.back();
    await expect(browser).toHaveURL('/matchups/0022500584?context=kept');
    await expect(screen.getByRole('heading', 'LeBron James')).toHaveCount(0);
    await browser.forward();
    await expect(browser).toHaveURL('/matchups/0022500584?context=kept&player=2544');
    await expect(screen.getByRole('region', 'LeBron James')).toBeFocused();
    await screen.getByRole('button', 'Close selection card').tap();
    await expect(browser).toHaveURL('/matchups/0022500584?context=kept');
    await expect(screen.getByRole('heading', 'LeBron James')).toHaveCount(0);
    await screen
      .getByRole('article', 'LeBron James player')
      .getByRole('button', 'Open selection card')
      .tap();
    await expect(screen.getByRole('region', 'LeBron James')).toBeFocused();
    await browser.keyboard.press('Escape');
    await expect(browser).toHaveURL('/matchups/0022500584?context=kept');
    await expect(screen.getByRole('heading', 'LeBron James')).toHaveCount(0);
    await expect(
      screen.getByRole('article', 'LeBron James player').getByRole('button'),
    ).toBeFocused();
    await browser.reload();
    await expect(screen.getByRole('heading', 'What BOS allows')).toBeVisible();
  },
);

signedInTest(
  'an empty selection explains why no opponent logs are shown',
  async ({ app, screen }) => {
    await app.open('/matchups/0022500584?player=1630559');
    await expect(screen.getByRole('heading', 'Austin Reaves')).toBeVisible();
    await expect(screen.getByText('No games vs this opponent data is available.')).toBeVisible();
    await expect(
      screen.getByText('No score components were computable for FG3A in Season.'),
    ).toBeVisible();
  },
);

signedInTest(
  'a failed selection read shows a handled error while the sheet remains usable',
  async ({ app, screen, api }) => {
    await api.override({
      '/api/games/matchup/selection': {
        status: 500,
        body: { error: { code: 'provider_unavailable' } },
      },
    });
    await app.open('/matchups/0022500584?player=2544');
    await expect(screen.getByRole('alert')).toContainText('Unable to load selection logs');
    await expect(screen.getByRole('heading', 'What BOS allows')).toBeVisible();
  },
);

signedInTest(
  'the agent opens a player selection card',
  { tags: ['agent'] },
  async ({ app, agent, screen }) => {
    await app.open('/matchups/0022500584');
    await expect(screen.getByRole('heading', 'What BOS allows')).toBeVisible();
    await agent.act('open the selection card for LeBron James');
    await expect(screen.getByRole('heading', 'LeBron James')).toBeVisible();
    await expect(screen.getByRole('table', 'LeBron James Score Matrix')).toContainText('+12%');
  },
);

signedInTest(
  'a Matchup player opens their Log Workspace',
  { tags: ['critical'] },
  async ({ app, screen, browser, api }) => {
    await app.open('/matchups/0022500584');
    await screen.getByRole('link', 'LeBron James game logs').tap();
    await expect(browser).toHaveURL('/?player_name=LeBron+James&season_filter=2025-26');
    await expect(screen.getByRole('heading', 'LeBron James')).toBeVisible();
    await expect(screen.getByRole('heading', 'Game Logs')).toBeVisible();
    await expect(screen.getByRole('cell', '31')).toBeVisible();
    expect(api.sent('/api/games/game_logs')[0].search.get('player_name')).toBe('LeBron James');
  },
);

signedInTest(
  'Back to slate leaves Matchup detail and shows the game list',
  { tags: ['critical'] },
  async ({ app, screen, browser }) => {
    await app.open('/matchups/0022500584');
    await expect(screen.getByRole('heading', 'What BOS allows')).toBeVisible();
    await screen.getByRole('link', '← Back to slate').tap();
    await expect(browser).toHaveURL('/matchups');
    await expect(screen.getByRole('heading', 'LAL @ BOS')).toBeVisible();
    await expect(screen.getByRole('link', { name: /Open Team Sheets/ })).toBeVisible();
    await expect(screen.getByRole('heading', 'What BOS allows')).toHaveCount(0);
  },
);

signedInTest(
  'a trailing section names its season and a short Last 15 names its games',
  async ({ app, screen, browser, api }) => {
    await api.override({ '/api/games/matchup': { body: servingSeasonMatchupPayload } });
    await app.open('/matchups/0022500584');
    await expect(screen.getByRole('heading', 'What BOS allows')).toBeVisible();
    await screen.getByRole('group', 'Market').getByRole('button', 'All').tap();
    await expect(
      screen.getByRole('region', 'Play types').getByText('2025-26 season'),
    ).toBeVisible();
    await expect(screen.getByText('2025-26 season')).toHaveCount(1);
    await expect(screen.getByRole('button', 'Last 15')).toHaveCount(0);
    expect(await overflowsHorizontally(browser)).toBe(false);
    await app.screenshot('matchup-trailing-season');

    await screen.getByRole('button', 'Last 6').tap();
    await expect(screen.getByRole('button', 'Last 6')).toHaveAttribute('aria-pressed', 'true');
    await expect(screen.getByText('2025-26 season')).toHaveCount(0);
    await expect(
      screen.getByText('Play types unavailable for Last 6: provider_unsupported.'),
    ).toBeVisible();
    await expect(screen.getByRole('region', 'Play types').getByText('Last 15')).toHaveCount(0);
    await app.screenshot('matchup-last-n');
  },
);

signedInTest(
  'a past game served after the Season Cutover carries no season badge',
  async ({ app, screen, browser, api }) => {
    await api.override({ '/api/games/matchup': { body: postCutoverHistoricalMatchupPayload } });
    await app.open('/matchups/0022501082');
    await expect(screen.getByRole('heading', 'What MIL allows')).toBeVisible();
    await screen.getByRole('group', 'Stat category').getByRole('button', 'All').tap();
    await expect(screen.getByRole('article', 'Above-the-break 3s')).toBeVisible();
    await expect(screen.getByText('2025-26 season')).toHaveCount(0);
    expect(await overflowsHorizontally(browser)).toBe(false);
    await app.screenshot('matchup-post-cutover-historical');
  },
);

// A backend serving 2026-27 before its cutover (crf04/statsplus#330) offers it
// as an Evidence season. QA cannot seed a 2026-27 candidate, so these states
// are fixtures.
const evidenceSeasons = {
  seasons: ['2025-26', '2024-25'],
  default_season: '2025-26',
  choices: [
    {
      season: '2026-27',
      mode: 'unpublished',
      families: { game_logs: { served_season: '2026-27', state: 'serving' } },
      team_games: { min: 2, max: 4 },
    },
    {
      season: '2025-26',
      mode: 'published',
      families: { game_logs: { served_season: '2025-26', state: 'serving' } },
    },
    {
      season: '2024-25',
      mode: 'retained',
      families: { game_logs: { served_season: '2024-25', state: 'serving' } },
    },
  ],
};
const seasonContext = { selected_season: '2026-27', published_season: '2025-26' };
const trailingSample = { team_games: { min: 80, max: 82 } };
const selectedMatchup = {
  ...servingSeasonMatchupPayload,
  as_of: { ...servingSeasonMatchupPayload.as_of, season: '2025-26' },
  season_context: seasonContext,
  trailing: [{ ...SYNERGY_TRAILING, ...trailingSample }],
};
const selectedSlate = {
  ...slatePayload('2026-01-15', [slateGame]),
  season_context: seasonContext,
  trailing: [
    {
      family: 'team_defense',
      serving_season: '2025-26',
      rule: 'every team has played 10 games',
      ...trailingSample,
    },
  ],
};
const seasonOf = (request: { url(): string }) => new URL(request.url()).searchParams.get('season');

signedInTest(
  'a 2026-27 Evidence season rides from the Slate to the Matchup and names every sample',
  async ({ app, screen, browser, api }) => {
    await api.override({
      '/api/games/seasons': { body: evidenceSeasons },
      '/api/games/slate': { body: selectedSlate },
      '/api/games/matchup': { body: selectedMatchup },
    });
    await app.open('/matchups?date=2026-01-15&season=2026-27');
    await expect(screen.getByRole('combobox', 'Evidence season')).toHaveValue('2026-27');
    await expect(screen.getByTestId('evidence-season-chip')).toHaveCount(0);
    await expect(
      screen.getByText(
        'Scores use 2025-26 team defense (80–82 games per team) until every team has played 10 games.',
      ),
    ).toBeVisible();
    expect(api.sent('/api/games/slate').map((request) => request.search.get('season'))).toEqual([
      '2026-27',
    ]);
    expect(await overflowsHorizontally(browser)).toBe(false);
    await app.screenshot('slate-evidence-2026-27');

    await screen.getByRole('link', { name: /Open Team Sheets/ }).tap();
    await expect(browser).toHaveURL('/matchups/0022500584?season=2026-27');
    await expect(screen.getByRole('heading', 'What BOS allows')).toBeVisible();
    await expect(screen.getByTestId('evidence-season-chip')).toHaveCount(0);
    await screen.getByRole('group', 'Market').getByRole('button', 'All').tap();
    await expect(
      screen.getByRole('region', 'Play types').getByText('2025-26 season · 80–82 games per team'),
    ).toBeVisible();
    await expect(screen.getByRole('link', 'LeBron James game logs')).toHaveAttribute(
      'href',
      '/?player_name=LeBron+James&season_filter=2026-27',
    );
    await expect(screen.getByRole('link', '← Back to slate')).toHaveAttribute(
      'href',
      '/matchups?season=2026-27',
    );
    expect(api.sent('/api/games/matchup').map((request) => request.search.get('season'))).toEqual([
      '2026-27',
    ]);
    expect(await overflowsHorizontally(browser)).toBe(false);
    await app.screenshot('matchup-evidence-2026-27');
  },
);

signedInTest(
  '2026-27 evidence for a 2025-26 game is refused with a way back, and an unoffered season falls back',
  async ({ app, screen, browser, api }) => {
    await api.override({
      '/api/games/seasons': { body: evidenceSeasons },
      '/api/games/matchup': (request) =>
        seasonOf(request)
          ? {
              status: 400,
              body: {
                error: {
                  code: 'season_after_game',
                  message: 'The 2026-27 season cannot be selected for a 2025-26 game.',
                  details: { selected_season: '2026-27', game_season: '2025-26' },
                },
              },
            }
          : historicalMatchupPayload,
    });
    await app.open(`/matchups/${HISTORICAL_GAME_ID}?season=2026-27`);
    await expect(screen.getByRole('alert')).toHaveText(
      'This is a 2025-26 game, so it has no 2026-27 evidence. CourtAI still reads 2025-26 by default. Show 2025-26',
    );
    await expect(screen.getByRole('heading', 'What MIL allows')).toHaveCount(0);
    expect(await overflowsHorizontally(browser)).toBe(false);
    await app.screenshot('matchup-season-after-game');

    await screen.getByRole('button', 'Show 2025-26').tap();
    await expect(browser).toHaveURL(`/matchups/${HISTORICAL_GAME_ID}`);
    await expect(screen.getByRole('heading', 'What MIL allows')).toBeVisible();

    await app.open(`/matchups/${HISTORICAL_GAME_ID}?season=2027-28`);
    await expect(browser).toHaveURL(`/matchups/${HISTORICAL_GAME_ID}`);
    await expect(
      screen.getByText('2027-28 isn’t offered, so this is 2025-26 evidence.'),
    ).toBeVisible();
    await expect(screen.getByRole('heading', 'What MIL allows')).toBeVisible();
    expect(api.sent('/api/games/matchup').at(-1)?.search.get('season')).toBeNull();
    await app.screenshot('matchup-season-fallback');
  },
);

// crf04/statsplus#348: once 2026-27 is offered, a 2026-27 date and game read it
// with no season chosen, and a chosen 2025-26 is kept in the URL.
signedInTest(
  'a 2026-27 date and game read 2026-27 by default, and a chosen 2025-26 survives a reload',
  async ({ app, screen, browser, api }) => {
    const autumnGame = { ...slateGame, game_id: '0022600003' };
    await api.override({
      '/api/games/seasons': { body: evidenceSeasons },
      '/api/games/slate': (request) => ({
        ...slatePayload('2026-10-27', [autumnGame]),
        ...(seasonOf(request) ? { season_context: seasonContext } : {}),
      }),
      '/api/games/matchup': (request) =>
        seasonOf(request) ? selectedMatchup : servingSeasonMatchupPayload,
    });
    await app.open('/matchups?date=2026-10-27');
    await expect(screen.getByRole('combobox', 'Evidence season')).toHaveValue('2026-27');
    await expect(screen.getByTestId('evidence-season-chip')).toHaveCount(0);
    expect(api.sent('/api/games/slate').map((request) => request.search.get('season'))).toEqual([
      '2026-27',
    ]);

    await screen.getByRole('link', { name: /Open Team Sheets/ }).tap();
    await expect(browser).toHaveURL('/matchups/0022600003');
    await expect(screen.getByRole('heading', 'What BOS allows')).toBeVisible();
    await expect(screen.getByRole('combobox', 'Evidence season')).toHaveValue('2026-27');
    expect(api.sent('/api/games/matchup').map((request) => request.search.get('season'))).toEqual([
      '2026-27',
    ]);
    await app.screenshot('matchup-evidence-default-2026-27');

    await screen.getByRole('combobox', 'Evidence season').selectOption({ value: '2025-26' });
    await expect(browser).toHaveURL('/matchups/0022600003?season=2025-26');
    await browser.reload();
    await expect(screen.getByRole('heading', 'What BOS allows')).toBeVisible();
    await expect(screen.getByRole('combobox', 'Evidence season')).toHaveValue('2025-26');
    expect(api.sent('/api/games/matchup').at(-1)?.search.get('season')).toBeNull();
    expect(await overflowsHorizontally(browser)).toBe(false);
    await app.screenshot('matchup-evidence-chosen-2025-26');
  },
);
