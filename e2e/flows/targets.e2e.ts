import { expect } from 'e2e';
import type { Locator, Screen } from 'e2e';
import { historicalMatchupPayload, slateGame, slatePayload } from '../fixtures/courtai.js';
import { overflowsHorizontally, signedInTest, signedOutTest } from './support/courtai.ts';

const threshold = async (screen: Screen, percent: number) => {
  const slider = screen.getByLabel('Qualifier 1 threshold percent');
  await slider.fill(String(percent));
  await expect(slider).toHaveValue(String(percent));
};

const composeAssists = async (screen: Screen) => {
  await screen.getByRole('button', '+ New Target').tap();
  await screen.getByRole('combobox', 'Opponent').selectOption({ value: 'ATL' });
  await screen.getByLabel('Qualifier 1 diet base').selectOption({ value: 'assist_locations' });
  await screen.getByLabel('Qualifier 1 slice').selectOption({ value: 'AtRimAssists' });
  await threshold(screen, 30);
};

const playerNames = async (games: Locator) =>
  (await games.getByRole('link').allTextContents()).sort();

const sampleCount = (screen: Screen) =>
  screen
    .getByRole('region', { name: /Lab · Backtest/ })
    .getByRole('list', 'Backtest summary')
    .getByRole('listitem', 'Player-games');

signedInTest(
  'sample Targets stay unsaved until copied, edited and explicitly saved',
  { tags: ['critical'] },
  async ({ app, screen, browser, api }) => {
    await app.open('/targets');
    await expect(screen.getByRole('heading', 'No Targets yet.')).toBeVisible();
    const samples = screen.getByRole('region', 'Sample Targets');
    await expect(samples.getByRole('article')).toHaveCount(2);
    await expect(samples.getByRole('list', 'Backtest summary')).toHaveCount(2);
    expect(api.sent('/api/user/targets', 'POST')).toHaveLength(0);
    await samples
      .getByRole('article', 'ORL vs P&R ball handler ≥ 25%')
      .getByRole('button', 'Add to my targets')
      .tap();
    await expect(screen.getByRole('combobox', 'Opponent')).toHaveValue('ORL');
    await expect(screen.getByLabel('Qualifier 1 threshold percent')).toHaveValue('25');
    await screen.getByLabel('Qualifier 1 threshold percent').press('ArrowRight');
    await expect(screen.getByLabel('Qualifier 1 threshold percent')).toHaveValue('26');
    expect(api.sent('/api/user/targets', 'POST')).toHaveLength(0);
    await screen.getByRole('button', 'Save Target').tap();
    await expect(browser).toHaveURL('/targets/1');
    await expect(screen.getByRole('heading', 'ORL vs P&R ball handler ≥ 26%')).toBeVisible();
    await screen.getByRole('link', '← All Targets').tap();
    await expect(screen.getByRole('article', 'ORL vs P&R ball handler ≥ 26%')).toBeVisible();
    await expect(samples).toHaveCount(0);
    await browser.reload();
    await expect(screen.getByRole('article', 'ORL vs P&R ball handler ≥ 26%')).toBeVisible();
    expect(api.sent('/api/user/targets', 'POST')).toHaveLength(1);
    expect(await overflowsHorizontally(browser)).toBe(false);
  },
);

signedInTest(
  'a Target can be created, reverted, edited, reopened and deleted',
  { tags: ['critical'] },
  async ({ app, screen, browser, api }) => {
    await app.open('/targets');
    await composeAssists(screen);
    await screen.getByLabel('Why · optional').fill('Watch cutters against Atlanta.');
    await expect(sampleCount(screen)).toHaveText('4 player-games');
    await screen.getByRole('button', 'Save Target').tap();
    await expect(browser).toHaveURL('/targets/1');
    await expect(screen.getByRole('heading', 'ATL vs At-rim assists ≥ 30%')).toBeVisible();
    await screen.getByLabel('Qualifier 1 threshold percent').press('ArrowRight');
    await expect(sampleCount(screen)).toHaveText('3 player-games');
    await screen.getByRole('button', 'Revert').tap();
    await expect(screen.getByLabel('Qualifier 1 threshold percent')).toHaveValue('30');
    await expect(sampleCount(screen)).toHaveText('4 player-games');
    await screen.getByLabel('Qualifier 1 threshold percent').press('ArrowRight');
    await screen.getByRole('button', 'Save changes').tap();
    await expect(screen.getByRole('heading', 'ATL vs At-rim assists ≥ 31%')).toBeVisible();
    await browser.reload();
    await expect(screen.getByLabel('Qualifier 1 threshold percent')).toHaveValue('31');
    await expect(sampleCount(screen)).toHaveText('3 player-games');
    await screen.getByRole('link', '← All Targets').tap();
    const card = screen.getByRole('article', 'ATL vs At-rim assists ≥ 31%');
    await expect(card).toContainText('Watch cutters against Atlanta.');
    await expect(card.getByRole('listitem', 'Player-games')).toHaveText('3 player-games');
    await card.getByRole('link', 'View Details / Edit').tap();
    await screen.getByRole('button', 'Delete').tap();
    await screen.getByRole('button', 'Keep it').tap();
    await expect(sampleCount(screen)).toHaveText('3 player-games');
    await screen.getByRole('button', 'Delete').tap();
    await screen.getByRole('button', 'Yes, delete').tap();
    await expect(browser).toHaveURL('/targets');
    await expect(screen.getByRole('heading', 'No Targets yet.')).toBeVisible();
    await browser.reload();
    await expect(screen.getByRole('heading', 'No Targets yet.')).toBeVisible();
    expect(api.sent('/api/user/targets/1', 'DELETE')).toHaveLength(1);
  },
);

signedInTest(
  'the Lab updates its evidence and hands a player to the filtered Log Workspace',
  { tags: ['critical'] },
  async ({ app, screen, browser }) => {
    await app.open('/targets');
    await composeAssists(screen);
    await expect(sampleCount(screen)).toHaveText('4 player-games');
    await screen.getByLabel('Qualifier 1 threshold percent').press('ArrowRight');
    await expect(sampleCount(screen)).toHaveText('3 player-games');
    await screen.getByRole('button', 'Save Target').tap();
    await expect(browser).toHaveURL('/targets/1');
    const games = screen.getByRole('region', 'Backtest games');
    await expect(games.getByRole('listitem')).toHaveCount(3);
    await expect(games).not.toContainText('Austin Reaves');
    await screen.getByRole('button', { name: /^AST\/36 / }).tap();
    await expect(screen.getByRole('list', { name: /graded by AST\/36 margin/ })).toBeVisible();
    expect(await overflowsHorizontally(browser)).toBe(false);
    await games.getByRole('link', 'LeBron James games vs ATL').tap();
    await expect(browser).toHaveURL('/?player_name=LeBron+James&opponent_tricode=ATL');
    await expect(screen.getByRole('cell', 'ATL')).toBeVisible();
    await expect(screen.getByRole('cell', '31')).toBeVisible();
  },
);

signedInTest(
  'a Position and a season average narrow the Backtest and read in the Target title',
  { tags: ['critical'] },
  async ({ app, screen, browser, api }) => {
    await app.open('/targets');
    await screen.getByRole('button', '+ New Target').tap();
    await screen.getByRole('button', 'Remove Qualifier 1').tap();
    await expect(screen.getByText('Add at least one Qualifier before saving.')).toBeVisible();

    // None selected is any position; Big alone is a Backtest of the two Bigs.
    await screen.getByRole('group', 'Position').getByRole('button', 'Big').tap();
    await expect(sampleCount(screen)).toHaveText('2 player-games');
    const limit = screen.getByRole('region', { name: /Lab · Backtest/ });
    await expect(limit).toContainText('1 player left out: no listed position.');

    await screen.getByRole('button', '+ and').tap();
    await screen.getByRole('button', 'a Qualifier').tap();
    await screen.getByLabel('Qualifier 1 diet base').selectOption({ value: 'season_average' });
    await screen.getByLabel('Qualifier 1 stat').selectOption({ value: '3PA' });
    await screen.getByLabel('Qualifier 1 threshold').fill('8');
    await expect(sampleCount(screen)).toHaveText('0 player-games');
    await screen.getByLabel('Qualifier 1 threshold').fill('0.3');
    await expect(sampleCount(screen)).toHaveText('2 player-games');

    await screen.getByRole('button', 'Save Target').tap();
    await expect(browser).toHaveURL('/targets/1');
    expect(api.sent('/api/user/targets', 'POST').at(-1)?.body).toMatchObject({
      opponent: 'ATL',
      qualifiers: [
        { base: 'position', groups: ['Big'] },
        { base: 'season_average', stat: '3PA', comparator: 'at_or_above', threshold: 0.3 },
      ],
    });
    await expect(screen.getByRole('heading', 'ATL vs Big, 3PA avg ≥ 0.3')).toBeVisible();
    const games = screen.getByRole('region', 'Backtest games');
    await expect(games.getByRole('listitem')).toHaveCount(2);
    await expect(
      games.getByRole('listitem').filter({ hasText: 'Giannis Antetokounmpo' }),
    ).toContainText('Big');
    await expect(games.getByRole('listitem').filter({ hasText: 'Ivica Zubac' })).toContainText(
      'Big',
    );
    await expect(games).not.toContainText('LeBron James');
    await expect(games).not.toContainText('Kawhi Leonard');

    // Two groups read as Wing/Big, and the Position still leads. Everyone
    // listed as a Wing or a Big who faced ATL is in, and nobody else.
    await screen.getByRole('group', 'Position').getByRole('button', 'Wing').tap();
    await screen.getByRole('button', 'Save changes').tap();
    await expect(screen.getByRole('heading', 'ATL vs Wing/Big, 3PA avg ≥ 0.3')).toBeVisible();
    await expect(games.getByRole('listitem')).toHaveCount(4);
    expect(await playerNames(games)).toEqual([
      'Giannis Antetokounmpo',
      'Ivica Zubac',
      'Jayson Tatum',
      'LeBron James',
    ]);
    await expect(games.getByRole('listitem').filter({ hasText: 'LeBron James' })).toContainText(
      'Wing',
    );
    expect(await overflowsHorizontally(browser)).toBe(false);
  },
);

signedInTest(
  'a season average reads at-or-below, per 36 and any Target stat, and leaves out an undersized season',
  { tags: ['critical'] },
  async ({ app, screen, browser }) => {
    await app.open('/targets');
    await screen.getByRole('button', '+ New Target').tap();
    await screen.getByRole('button', 'Remove Qualifier 1').tap();
    await screen.getByRole('group', 'Position').getByRole('button', 'Guard').tap();
    // Reaves, Harden and Lillard each faced ATL once.
    await expect(sampleCount(screen)).toHaveText('3 player-games');

    await screen.getByRole('button', '+ and').tap();
    await screen.getByRole('button', 'a Qualifier').tap();
    await screen.getByLabel('Qualifier 1 diet base').selectOption({ value: 'season_average' });
    // REB is a Target column the fixture's old stat list lacked: both games' 8 and 7 average 7.5.
    await screen.getByLabel('Qualifier 1 stat').selectOption({ value: 'REB' });
    await screen.getByLabel('Qualifier 1 threshold').fill('7');
    // Lillard has played 3 games, under the Diet thin rule, so an Average leaves him out.
    await expect(sampleCount(screen)).toHaveText('2 player-games');
    await screen.getByRole('button', 'At or above; switch to at or below').tap();
    await expect(sampleCount(screen)).toHaveText('0 player-games');
    await screen.getByRole('button', 'At or below; switch to at or above').tap();
    await expect(sampleCount(screen)).toHaveText('2 player-games');

    // Per 36 minutes is 15 attempts in 70 minutes: 7.71, where per game is 7.5.
    await screen.getByLabel('Qualifier 1 stat').selectOption({ value: '3PA/36' });
    await screen.getByLabel('Qualifier 1 threshold').fill('7.8');
    await expect(sampleCount(screen)).toHaveText('0 player-games');
    await screen.getByLabel('Qualifier 1 threshold').fill('7.7');
    await expect(sampleCount(screen)).toHaveText('2 player-games');

    await screen.getByRole('button', 'Save Target').tap();
    await expect(browser).toHaveURL('/targets/1');
    await expect(screen.getByRole('heading', 'ATL vs Guard, 3PA/36 avg ≥ 7.7')).toBeVisible();
    const games = screen.getByRole('region', 'Backtest games');
    expect(await playerNames(games)).toEqual(['Austin Reaves', 'James Harden']);
    await expect(games).not.toContainText('Damian Lillard');
  },
);

signedInTest(
  'defender and date Conditions narrow actual games and survive saving',
  { tags: ['critical'] },
  async ({ app, screen, browser }) => {
    await app.open('/targets');
    await composeAssists(screen);
    await screen.getByRole('button', 'Save Target').tap();
    await expect(sampleCount(screen)).toHaveText('4 player-games');
    await screen.getByRole('button', '+ and').tap();
    await screen.getByRole('button', 'a defender’s minutes').tap();
    await screen
      .getByLabel('Defender')
      .selectOption({ label: 'Clint Capela · 28.0 min · 3 games' });
    await expect(sampleCount(screen)).toHaveText('1 player-games');
    await expect(screen.getByRole('region', 'Backtest games')).toContainText('Jayson Tatum');
    await screen.getByRole('button', 'Save changes').tap();
    await expect(screen.getByRole('button', 'Save changes')).toHaveCount(0);
    await browser.reload();
    await expect(screen.getByLabel('Defender')).toHaveValue('203991');
    await expect(sampleCount(screen)).toHaveText('1 player-games');
    await screen.getByRole('button', '+ and').tap();
    await screen.getByRole('button', 'a date window').tap();
    await screen.getByLabel('From').fill('2025-01-11');
    await expect(sampleCount(screen)).toHaveText('0 player-games');
    await expect(screen.getByText('Nobody qualifying has faced ATL yet.')).toBeVisible();
    await screen.getByRole('button', 'Revert').tap();
    await expect(sampleCount(screen)).toHaveText('1 player-games');
    await screen.getByRole('button', '+ and').tap();
    await screen.getByRole('button', 'a date window').tap();
    await screen.getByLabel('Through').fill('2025-01-09');
    await expect(sampleCount(screen)).toHaveText('0 player-games');
    await screen.getByLabel('Through').fill('2025-01-10');
    await expect(sampleCount(screen)).toHaveText('1 player-games');
    await screen.getByRole('button', 'Save changes').tap();
    await expect(screen.getByRole('button', 'Save changes')).toHaveCount(0);
    await browser.reload();
    await expect(screen.getByLabel('Through')).toHaveValue('2025-01-10');
    await expect(sampleCount(screen)).toHaveText('1 player-games');
  },
);

signedInTest(
  'a strict player minutes floor filters appearances and saved grading survives reload',
  { tags: ['critical'] },
  async ({ app, screen, browser, api }) => {
    await app.open('/targets');
    await composeAssists(screen);
    await expect(sampleCount(screen)).toHaveText('4 player-games');
    const minutes = screen.getByRole('slider', 'Player game minutes');
    await minutes.fill('36');
    await expect(minutes).toHaveValue('36');
    await expect(sampleCount(screen)).toHaveText('0 player-games');
    await expect(
      screen.getByText('No qualifying appearances match these backtest conditions.'),
    ).toBeVisible();
    await minutes.press('ArrowLeft');
    await expect(sampleCount(screen)).toHaveText('4 player-games');
    await screen.getByRole('button', 'Save Target').tap();
    await expect(browser).toHaveURL('/targets/1');
    await expect(minutes).toHaveValue('35');
    await screen.getByRole('button', 'stats ▾').tap();
    await screen.getByRole('checkbox', 'PTS/36').check();
    await screen.getByRole('button', 'stats ▾').tap();
    await screen.getByRole('button', { name: /^PTS\/36 / }).tap();
    await expect
      .poll(() => api.sent('/api/user/targets/1', 'PATCH').at(-1)?.body)
      .toEqual({
        stat_preferences: { columns: ['AST', 'AST/36', 'PTS/36'], graded_by: 'PTS/36' },
      });
    await browser.reload();
    await expect(minutes).toHaveValue('35');
    await expect(sampleCount(screen)).toHaveText('4 player-games');
    await expect(screen.getByRole('list', { name: /graded by PTS\/36 margin/ })).toBeVisible();
    await screen.getByRole('link', '← All Targets').tap();
    const card = screen.getByRole('article', 'ATL vs At-rim assists ≥ 30%');
    await expect(card.getByRole('listitem', 'PTS/36')).toBeVisible();
    await expect(card).toContainText('Backtest · 2025-26 · excludes games ≤ 35 min');
  },
);

signedInTest(
  'saved Target fits identify players in a dated Slate',
  { tags: ['critical'] },
  async ({ app, screen, browser }) => {
    await app.open('/targets');
    await composeAssists(screen);
    await screen.getByRole('combobox', 'Opponent').selectOption({ value: 'BOS' });
    await screen.getByRole('button', 'Save Target').tap();
    await expect(screen.getByRole('heading', 'BOS vs At-rim assists ≥ 30%')).toBeVisible();
    let twoGames = true;
    await browser.route('**/api/games/slate?**', async (route) => {
      if (twoGames) {
        await route.fulfill({
          json: slatePayload('2026-01-15', [slateGame, historicalMatchupPayload.game]),
        });
      } else await route.fallback();
    });
    await app.open('/matchups?date=2026-01-15');
    await expect(screen.getByRole('heading', 'LAL @ BOS')).toBeVisible();
    const fits = screen.getByRole('article').filter({ hasText: 'At-rim assists' });
    await expect(fits.getByRole('row', { name: /LeBron James/ })).toContainText('31%');
    await expect(fits.getByRole('row', { name: /LeBron James/ })).toContainText('lg 14%');
    await expect(fits.getByRole('row', { name: /Austin Reaves/ })).toHaveText(
      'Austin Reaves LAL Guard THIN 35% lg 14% 20.1',
    );
    const otherGame = screen
      .getByRole('listitem')
      .filter({ has: screen.getByRole('heading', 'LAC @ MIL') })
      .last();
    await expect(otherGame).toHaveCount(1);
    await expect(otherGame.getByRole('article')).toHaveCount(0);
    await expect(fits).toHaveCount(1);
    expect(await overflowsHorizontally(browser)).toBe(false);
    twoGames = false;

    // The Slate asks for its own date: a MIL Target resolves only on 2026-03-29.
    await app.open('/targets');
    await screen.getByRole('button', '+ New Target').tap();
    await screen.getByRole('combobox', 'Opponent').selectOption({ value: 'MIL' });
    await screen.getByLabel('Qualifier 1 diet base').selectOption({ value: 'assist_locations' });
    await screen.getByLabel('Qualifier 1 slice').selectOption({ value: 'AtRimAssists' });
    await threshold(screen, 30);
    await screen.getByRole('button', 'Save Target').tap();
    await expect(screen.getByRole('heading', 'MIL vs At-rim assists ≥ 30%')).toBeVisible();
    await app.open('/matchups?date=2026-03-29');
    await expect(screen.getByRole('heading', 'LAC @ MIL')).toBeVisible();
    await expect(screen.getByRole('article').filter({ hasText: 'At-rim assists' })).toBeVisible();
  },
);

signedInTest(
  'opponent context can fail independently and recover without blocking a Target save',
  async ({ app, screen, browser }) => {
    await app.open('/targets');
    await composeAssists(screen);
    await screen.getByLabel('Qualifier 1 diet base').selectOption({ value: 'play_types' });
    await screen.getByLabel('Qualifier 1 slice').selectOption({ value: 'Spotup' });
    await expect(screen.getByLabel('ATL opponent context')).toContainText('#12/30');
    let failing = true;
    await browser.route('**/api/teams/stats?**', async (route) => {
      if (failing)
        await route.fulfill({
          status: 503,
          json: { error: { code: 'unavailable', message: 'Unavailable' } },
        });
      else await route.fallback();
    });
    await screen.getByRole('combobox', 'Opponent').selectOption({ value: 'BOS' });
    const context = screen.getByLabel('BOS opponent context');
    await expect(context).toContainText('Context unavailable');
    await expect(screen.getByRole('button', 'Save Target')).toBeEnabled();
    failing = false;
    await context.getByRole('button', 'Retry opponent context').tap();
    await expect(context).toContainText('#12/30');
    await screen.getByRole('button', 'Save Target').tap();
    await expect(browser).toHaveURL('/targets/1');
    await expect(screen.getByRole('heading', 'BOS vs Spot up ≥ 30%')).toBeVisible();
  },
);

signedInTest(
  'a failed Lab preview can be retried without losing the draft',
  async ({ app, screen, browser }) => {
    await app.open('/targets');
    await composeAssists(screen);
    await expect(sampleCount(screen)).toHaveText('4 player-games');
    let failing = true;
    await browser.route('**/api/user/targets/preview', async (route) => {
      if (failing) {
        await route.fulfill({
          status: 503,
          json: { error: { message: 'Backtest service unavailable.' } },
        });
      } else await route.fallback();
    });
    await screen.getByLabel('Qualifier 1 threshold percent').press('ArrowRight');
    const lab = screen.getByRole('region', { name: /Lab · Backtest/ });
    await expect(lab.getByRole('alert')).toContainText('Backtest service unavailable.');
    await expect(screen.getByLabel('Qualifier 1 threshold percent')).toHaveValue('31');
    await expect(screen.getByRole('button', 'Save Target')).toBeEnabled();
    failing = false;
    await lab.getByRole('button', 'Retry backtest').tap();
    await expect(sampleCount(screen)).toHaveText('3 player-games');
    await expect(lab.getByRole('status')).toHaveText('Backtest up to date.');
  },
);

signedInTest(
  'a failed Targets list is distinct from an empty account and reload recovers',
  async ({ app, screen, browser }) => {
    let failing = true;
    await browser.route('**/api/user/targets', async (route) => {
      if (failing)
        await route.fulfill({ status: 503, json: { error: { message: 'Targets unavailable.' } } });
      else await route.fallback();
    });
    await app.open('/targets');
    await expect(screen.getByRole('alert')).toContainText('Targets unavailable.');
    await expect(screen.getByRole('heading', 'No Targets yet.')).toHaveCount(0);
    failing = false;
    await browser.reload();
    await expect(screen.getByRole('heading', 'No Targets yet.')).toBeVisible();
    await expect(screen.getByRole('region', 'Sample Targets').getByRole('article')).toHaveCount(2);
  },
);

signedOutTest(
  'signed-out Targets preserve both collection and detail destinations',
  async ({ app, screen, browser, api }) => {
    await app.open('/targets');
    await expect(screen.getByRole('heading', 'Sign in to view your Targets')).toBeVisible();
    await app.open('/targets/7');
    await expect(screen.getByRole('heading', 'Sign in to view your Targets')).toBeVisible();
    await expect(browser).toHaveURL('/targets/7');
    expect(api.sent('/api/user/targets')).toHaveLength(0);
    expect(api.sent('/api/user/targets/7')).toHaveLength(0);
  },
);

signedInTest(
  'a missing Target explains its absence and returns to the collection',
  async ({ app, screen, browser }) => {
    await app.open('/targets/404');
    await expect(screen.getByRole('heading', 'That Target is gone.')).toBeVisible();
    await screen.getByRole('link', '← All Targets').tap();
    await expect(browser).toHaveURL('/targets');
    await expect(screen.getByRole('heading', 'No Targets yet.')).toBeVisible();
  },
);

signedInTest(
  'the agent copies a sample into a personal Target',
  { tags: ['agent'] },
  async ({ app, agent, screen, browser }) => {
    await app.open('/targets');
    await expect(screen.getByRole('heading', 'No Targets yet.')).toBeVisible();
    await agent.act(
      'add the sample {title} to my targets and save it without changing its criteria',
      {
        params: { title: 'ORL vs P&R ball handler ≥ 25%' },
      },
    );
    await expect(browser).toHaveURL('/targets/1');
    await expect(screen.getByRole('heading', 'ORL vs P&R ball handler ≥ 25%')).toBeVisible();
  },
);

// A backend serving 2026-27 before its cutover (crf04/statsplus#330) offers it
// in the Lab, but Backtests never read a season before its cutover.
signedInTest(
  'the Lab offers the listed Evidence seasons and refuses a 2026-27 Backtest plainly',
  async ({ app, screen, browser, api }) => {
    await api.override({
      '/api/games/seasons': {
        body: {
          seasons: ['2025-26'],
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
          ],
        },
      },
    });
    await app.open('/targets');
    await composeAssists(screen);
    await expect(sampleCount(screen)).toHaveText(/^4 player-games$/);
    const seasons = screen.getByRole('group', 'Evidence season');
    await expect(seasons.getByRole('button', '2025-26')).toHaveAttribute('aria-pressed', 'true');

    await seasons.getByRole('button', '2026-27').tap();
    await expect(browser).toHaveURL('/targets?season=2026-27');
    const lab = screen.getByRole('region', { name: /Lab · Backtest/ });
    await expect(lab.getByRole('alert')).toHaveText(
      "2026-27 isn't available yet. CourtAI still reads 2025-26 by default. Show 2025-26",
    );
    await expect(lab.getByRole('list', 'Backtest summary')).toHaveCount(0);
    expect(api.sent('/api/user/targets/preview', 'POST').at(-1)?.body).toMatchObject({
      season: '2026-27',
    });
    expect(await overflowsHorizontally(browser)).toBe(false);
    await app.screenshot('target-lab-2026-27-refused');

    await lab.getByRole('button', 'Show 2025-26').tap();
    await expect(browser).toHaveURL('/targets');
    await expect(sampleCount(screen)).toHaveText(/^4 player-games$/);
  },
);
