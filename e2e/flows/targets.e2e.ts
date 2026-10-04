import { expect } from 'e2e';
import type { Screen } from 'e2e';
import { overflowsHorizontally, signedInTest, signedOutTest } from './support/courtai.ts';

const threshold = async (screen: Screen, percent: number) => {
  const slider = screen.getByLabel('Qualifier 1 threshold percent');
  await slider.press('Home');
  for (let value = 0; value < percent; value += 1) await slider.press('ArrowRight');
};

const composeAssists = async (screen: Screen) => {
  await screen.getByRole('button', '+ New Target').tap();
  await screen.getByRole('combobox', 'Opponent').selectOption({ value: 'ATL' });
  await screen.getByLabel('Qualifier 1 diet base').selectOption({ value: 'assist_locations' });
  await screen.getByLabel('Qualifier 1 slice').selectOption({ value: 'AtRimAssists' });
  await threshold(screen, 30);
};

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
    await minutes.press('End');
    for (let value = 48; value > 36; value -= 1) await minutes.press('ArrowLeft');
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
    await expect(card).toContainText('Backtest · season to date · excludes games ≤ 35 min');
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
    await app.open('/matchups?date=2026-01-15');
    await expect(screen.getByRole('heading', 'LAL @ BOS')).toBeVisible();
    const fits = screen.getByRole('article').filter({ hasText: 'At-rim assists' });
    await expect(fits.getByRole('row', { name: /LeBron James/ })).toContainText('31%');
    await expect(fits.getByRole('row', { name: /LeBron James/ })).toContainText('lg 14%');
    await expect(fits.getByRole('row', { name: /Austin Reaves/ })).toHaveText(
      'Austin Reaves LAL THIN 35% lg 14% 20.1',
    );
    expect(await overflowsHorizontally(browser)).toBe(false);

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

signedInTest(
  'a Defense Sheet capture persists the row as a Target and rejects duplicates',
  {
    tags: ['critical'],
  },
  async ({ app, screen, browser, api }) => {
    await app.open('/matchups/0022500584');
    await expect(screen.getByRole('heading', 'BOS Defense Sheet')).toBeVisible();
    const capture = screen.getByRole('button', 'Save Restricted Area FGA as a Target');
    await capture.tap();
    const dialog = screen.getByRole('dialog');
    await expect(dialog.getByLabel('Qualifier 1 diet base')).toHaveValue('shot_zones');
    await expect(dialog.getByLabel('Qualifier 1 slice')).toHaveValue('Restricted Area');
    await expect(dialog.getByLabel('Qualifier 1 threshold percent')).toHaveValue('20');
    await dialog.getByRole('button', 'Cancel').tap();
    await expect(capture).toBeFocused();
    await capture.tap();
    await dialog.getByRole('button', 'Save Target').tap();
    await expect(browser).toHaveURL('/targets/1');
    await expect(screen.getByRole('heading', 'BOS vs Restricted area ≥ 20%')).toBeVisible();
    expect(api.sent('/api/user/targets', 'POST')[0].body).toEqual({
      opponent: 'BOS',
      note: '',
      qualifiers: [
        {
          base: 'shot_zones',
          slice_key: 'Restricted Area',
          comparator: 'at_or_above',
          threshold: 0.2,
        },
      ],
    });
    await app.open('/matchups/0022500584');
    await capture.tap();
    await dialog.getByRole('button', 'Save Target').tap();
    await expect(dialog.getByRole('alert')).toContainText('You already have that Target for BOS.');
    await expect(dialog.getByLabel('Qualifier 1 threshold percent')).toHaveValue('20');
    await dialog.getByRole('button', 'Cancel').tap();
    await screen.getByRole('link', 'Targets').tap();
    await expect(screen.getByRole('article', 'BOS vs Restricted area ≥ 20%')).toBeVisible();
    expect(await overflowsHorizontally(browser)).toBe(false);
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
