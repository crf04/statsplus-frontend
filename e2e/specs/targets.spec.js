import { expect, installApiContract, test } from '../fixtures/courtai';

const composeTarget = async (page, { opponent, base, slice, percent, note }) => {
  await page.getByLabel('Opponent').selectOption(opponent);
  if (base) await page.getByLabel('Qualifier 1 diet base').selectOption(base);
  await page.getByLabel('Qualifier 1 slice').selectOption(slice);
  await page.getByLabel('Qualifier 1 threshold percent').fill(percent);
  if (note) await page.getByLabel('Note · optional, never the title').fill(note);
};

/*
 * Saving opens the new Target on its own page, so composing the next one means
 * going back to the grid and its blank form.
 */
const saveTarget = async (page) => {
  await page.getByRole('button', { name: 'Save Target' }).click();
  await expect(page).toHaveURL(/\/targets\/\d+$/);
  await page.getByRole('link', { name: '← All Targets' }).click();
  await expect(page.getByLabel('Qualifier 1 threshold percent')).toHaveValue('');
};

const summaryItem = (scope, label) =>
  scope.getByRole('list', { name: 'Backtest summary' }).getByRole('listitem', { name: label });

test('@critical authenticated user creates, opens, edits, and deletes a Target', async ({
  authenticatedPage: page,
}, testInfo) => {
  await installApiContract(page);
  await page.goto('/targets');

  await expect(page.getByRole('link', { name: 'Targets' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '0 Targets', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'No Targets yet.' })).toBeVisible();

  // Nothing is saveable until a threshold has been composed.
  await expect(page.getByRole('button', { name: 'Save Target' })).toBeDisabled();

  await composeTarget(page, {
    opponent: 'OKC',
    slice: 'Corner 3',
    percent: '40',
    note: 'Switches everything and leaves the corner late.',
  });
  await expect(page.getByText('OKC vs Corner 3 ≥ 40%')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('targets-form.png'), fullPage: true });
  await page.getByRole('button', { name: 'Save Target' }).click();

  // The saved draft is the record, and opens on its own page.
  await expect(page).toHaveURL(/\/targets\/\d+$/);
  await expect(page.getByRole('heading', { name: 'OKC vs Corner 3 ≥ 40%' })).toBeVisible();
  await page.getByRole('link', { name: '← All Targets' }).click();
  const okcCard = page.getByRole('link', { name: 'Open OKC vs Corner 3 ≥ 40%' });
  await expect(okcCard).toBeVisible();
  await expect(page.getByRole('heading', { name: '1 Target', exact: true })).toBeVisible();
  await expect(okcCard).toContainText('Switches everything and leaves the corner late.');

  // The grid has a blank form, so the same idea has to be typed again to be
  // refused as the duplicate it is.
  await expect(page.getByLabel('Qualifier 1 threshold percent')).toHaveValue('');
  await composeTarget(page, { opponent: 'OKC', slice: 'Corner 3', percent: '40' });
  await page.getByRole('button', { name: 'Save Target' }).click();
  await expect(page.getByRole('alert')).toContainText('You already have that Target for OKC.');
  await expect(page.getByRole('heading', { name: '1 Target', exact: true })).toBeVisible();

  // A second Target, so that opening one is a choice between two rather than
  // whatever the account happens to hold.
  await composeTarget(page, { opponent: 'MIA', slice: 'Restricted Area', percent: '22' });
  await saveTarget(page);
  await expect(page.getByRole('heading', { name: '2 Targets', exact: true })).toBeVisible();
  const cards = page.getByRole('link', { name: /^Open / });
  await expect(cards).toHaveCount(2);
  await expect(cards.first()).toHaveAccessibleName('Open MIA vs Restricted area ≥ 22%');
  await page.screenshot({ path: testInfo.outputPath('targets-grid.png'), fullPage: true });

  await okcCard.click();
  await expect(page).toHaveURL(/\/targets\/\d+$/);
  await expect(page.getByRole('heading', { name: 'OKC vs Corner 3 ≥ 40%' })).toBeVisible();
  await expect(page.getByText('Shot zones')).toBeVisible();
  await expect(page.getByText('Target · set')).toBeVisible();

  // Editing the Qualifiers re-derives the title; the note never touches it.
  await page.getByRole('button', { name: 'Edit' }).click();
  await page.getByRole('button', { name: 'At or below' }).click();
  await page.getByLabel('Qualifier 1 threshold percent').fill('18');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('heading', { name: 'OKC vs Corner 3 ≤ 18%' })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('target-detail.png'), fullPage: true });

  await page.getByRole('link', { name: '← All Targets' }).click();
  await expect(page.getByRole('link', { name: 'Open OKC vs Corner 3 ≤ 18%' })).toBeVisible();

  await page.getByRole('link', { name: 'Open OKC vs Corner 3 ≤ 18%' }).click();
  await page.getByRole('button', { name: 'Delete' }).click();
  await page.getByRole('button', { name: 'Yes, delete' }).click();

  await expect(page).toHaveURL('/targets');
  await expect(page.getByRole('heading', { name: '1 Target', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open MIA vs Restricted area ≥ 22%' })).toBeVisible();
});

test('the Targets page reads and works at a phone width', async ({ authenticatedPage: page }) => {
  await page.setViewportSize({ width: 393, height: 852 });
  await installApiContract(page);
  await page.goto('/targets');

  await composeTarget(page, { opponent: 'BOS', slice: 'Mid-Range', percent: '30' });
  // The Lab reads beneath the form at this width too, without widening it.
  await expect(page.getByText(/fit tonight vs BOS/)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await saveTarget(page);
  await expect(page.getByRole('link', { name: 'Open BOS vs Mid-range ≥ 30%' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

test('signed-out Targets keeps the shared shell and does not redirect', async ({ page }) => {
  await installApiContract(page);
  await page.goto('/targets');

  await expect(page).toHaveURL('/targets');
  await expect(page.getByRole('navigation', { name: 'Primary' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Sign in to view your Targets' })).toBeVisible();

  await page.goto('/targets/7');
  await expect(page).toHaveURL('/targets/7');
  await expect(page.getByRole('heading', { name: 'Sign in to view your Targets' })).toBeVisible();
});

test('a Target that no longer exists says so rather than showing a blank one', async ({
  authenticatedPage: page,
}) => {
  await installApiContract(page);
  await page.goto('/targets/404');

  await expect(page.getByRole('heading', { name: 'That Target is gone.' })).toBeVisible();
  await page.getByRole('link', { name: '← All Targets' }).click();
  await expect(page).toHaveURL('/targets');
});

/*
 * The Slate owns today: a Target with a game on the viewed date shows its fits
 * under the game row they came from, and the Target's own page shows the
 * readings that make those fits interesting.
 */
test('@critical a saved Target reads live under its game and on its own page', async ({
  authenticatedPage: page,
}, testInfo) => {
  await installApiContract(page);
  await page.goto('/targets');

  // LAL plays BOS on the fixture's slate, so a Target on BOS filters LAL.
  await composeTarget(page, {
    opponent: 'BOS',
    base: 'assist_locations',
    slice: 'AtRimAssists',
    percent: '30',
    note: 'Nobody picks up the roller.',
  });
  await saveTarget(page);
  await expect(page.getByRole('link', { name: /^Open BOS vs At-rim assists/ })).toBeVisible();

  // A second Target on the same game that nobody fits, and one whose opponent
  // is not playing at all.
  await composeTarget(page, { opponent: 'BOS', slice: 'Mid-Range', percent: '30' });
  await saveTarget(page);
  await composeTarget(page, { opponent: 'OKC', slice: 'Corner 3', percent: '40' });
  await saveTarget(page);
  await expect(page.getByRole('heading', { name: '3 Targets', exact: true })).toBeVisible();
  // Each card says what today makes of its Target before it is opened.
  await expect(
    page.getByRole('link', { name: /^Open BOS vs At-rim assists/ }).getByText('2 fit today'),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: /^Open OKC vs Corner 3/ }).getByText('no game today'),
  ).toBeVisible();

  await page.goto('/matchups?date=2026-01-15');

  // Only the two Targets with a game today are active; the idle one is not.
  await expect(page.getByText('2 Targets active')).toBeVisible();
  const row = page
    .getByRole('listitem')
    .filter({ has: page.getByRole('heading', { name: 'LAL @ BOS' }) });
  const fits = row.getByRole('article').filter({ hasText: 'At-rim assists' });
  await expect(fits.getByText('BOS')).toBeVisible();
  await expect(fits.getByText('≥ 30%')).toBeVisible();
  await expect(fits.getByText('2 fit')).toBeVisible();
  await expect(fits.getByRole('row', { name: /LeBron James/ })).toContainText('31%');
  await expect(fits.getByRole('row', { name: /LeBron James/ })).toContainText('lg 14%');
  await expect(fits.getByRole('row', { name: /LeBron James/ })).toContainText('25.4');
  // A thin diet is flagged, not dropped: the Matchup lists him too.
  await expect(fits.getByRole('row', { name: /Austin Reaves/ })).toContainText('thin');
  await expect(row.getByText('No LAL player meets every Qualifier today.')).toBeVisible();
  await expect(page.getByText('OKC')).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('slate-targets.png'), fullPage: true });

  await page.getByRole('link', { name: 'All Targets →' }).click();
  await expect(page).toHaveURL('/targets');

  await page.getByRole('link', { name: /^Open BOS vs At-rim assists/ }).click();
  // The opponent's live readings on the slice, in both windows.
  await expect(page.getByText('AtRimAssists', { exact: true }).first()).toBeVisible();
  // The allowed figure leads each reading, with its window beside it.
  const season = page.locator('.target-reading', { hasText: 'Season' });
  await expect(season).toContainText('12.0');
  await expect(season).toContainText('+13.0% vs league');
  await expect(season).toContainText('+1.5σ');
  const last15 = page.locator('.target-reading', { hasText: 'L15' });
  await expect(last15).toContainText('11.0');
  await expect(last15).toContainText('+9.0% vs league');
  // The game reads the way the Slate row reads it.
  await expect(page.getByRole('link', { name: 'LAL @ BOS' })).toBeVisible();
  await expect(page.getByRole('row', { name: /LeBron James/ })).toContainText('31%');
  await page.screenshot({ path: testInfo.outputPath('target-detail-live.png'), fullPage: true });

  // Nobody in the league has faced BOS this season, which is stated rather
  // than left as an empty table.
  await page.getByRole('button', { name: 'Expand backtest' }).click();
  await expect(page.getByText('Nobody qualifying has faced BOS yet.')).toBeVisible();

  // An idle Target still manages, and says which day it has no game on.
  await page.getByRole('link', { name: '← All Targets' }).click();
  await page.getByRole('link', { name: /^Open OKC vs Corner 3/ }).click();
  await expect(page.getByText(/OKC has no game on Thursday, January 15, 2026\./)).toBeVisible();
  await expect(page.getByText('vs league')).toHaveCount(0);
});

test('a Target on a completed game resolves against its game-log participants', async ({
  authenticatedPage: page,
}) => {
  await installApiContract(page);
  await page.goto('/targets');

  // LAC played MIL on the completed date, so a Target on MIL filters LAC.
  await composeTarget(page, { opponent: 'MIL', slice: 'Restricted Area', percent: '25' });
  await saveTarget(page);

  await page.goto('/matchups?date=2026-03-29');

  const row = page
    .getByRole('listitem')
    .filter({ has: page.getByRole('heading', { name: 'LAC @ MIL' }) });
  await expect(row.getByRole('row', { name: /Kawhi Leonard/ })).toContainText('28%');
  await expect(page.getByText('1 Target active')).toBeVisible();

  // No Player Pool exists for a completed game, so the fits are the game's
  // own participants and the block says so.
  await expect(row.getByText('from game logs')).toBeVisible();

  // The Target's own page reads today, where MIL is not playing.
  await page.getByRole('link', { name: 'All Targets →' }).click();
  await page.getByRole('link', { name: /^Open MIL vs Restricted area/ }).click();
  await expect(page.getByText(/MIL has no game on Thursday, January 15, 2026\./)).toBeVisible();
});

test('the fits under a Slate row read at a phone width', async ({ authenticatedPage: page }) => {
  await page.setViewportSize({ width: 393, height: 852 });
  await installApiContract(page);
  await page.goto('/targets');

  await composeTarget(page, {
    opponent: 'BOS',
    base: 'assist_locations',
    slice: 'AtRimAssists',
    percent: '30',
  });
  await saveTarget(page);

  await page.goto('/matchups?date=2026-01-15');

  await expect(page.getByRole('row', { name: /LeBron James/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

/*
 * The backtest is the season behind the idea. It is a league-wide game-log
 * scan rather than a day-scoped read, so it costs something to ask for and is
 * never asked for until a reader opens it — and it reads the same games the
 * Log Workspace serves, which is what makes a row worth following.
 */
test('@critical a backtest is read on demand and hands off into the Log Workspace', async ({
  authenticatedPage: page,
}, testInfo) => {
  await installApiContract(page);
  const backtestRequests = [];
  const gameLogRequests = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.pathname.endsWith('/backtest')) backtestRequests.push(url);
    if (url.pathname === '/api/games/game_logs') gameLogRequests.push(url);
  });
  await page.goto('/targets');

  // ATL is on every player's season in the contract and plays on no slate, so
  // this Target is idle today and has a backtest all the same.
  await composeTarget(page, {
    opponent: 'ATL',
    base: 'assist_locations',
    slice: 'AtRimAssists',
    percent: '30',
  });
  await saveTarget(page);
  await page.getByRole('link', { name: /^Open ATL vs At-rim assists/ }).click();

  await expect(page.getByText(/ATL has no game on/)).toBeVisible();
  expect(backtestRequests).toHaveLength(0);

  await page.getByRole('button', { name: 'Expand backtest' }).click();
  const backtest = page.getByRole('table', { name: /^Backtest for ATL vs At-rim assists/ });
  await expect(backtest).toBeVisible();
  expect(backtestRequests).toHaveLength(1);
  await expect(page.getByText('Backtest · season to date · vs ATL')).toBeVisible();
  await expect(page.getByText(/box-score proxies/)).toBeVisible();

  // League-wide and ordered by season scoring, so the first row is not the
  // player the day's Matchup happens to lead with.
  const rows = backtest.getByRole('row');
  await expect(rows.nth(1)).toContainText('Jayson Tatum');
  // Each game against ATL in the markets the Qualifier's slice maps to, read
  // against that player's own season average.
  const tatum = backtest.getByRole('row', { name: /Jayson Tatum/ });
  await expect(tatum).toContainText('BOS · At-rim assists 33%');
  await expect(tatum).toContainText('season 8.5 AST · 39.5 PA · 16.0 RA · 47.0 PRA');
  await expect(tatum).toContainText('2025-01-10');
  await expect(tatum).toContainText('42.0');
  await expect(tatum).toContainText('+2.5');
  // A thin Diet is excluded from the longer view, though the Matchup and the
  // day's fits still list him.
  await expect(backtest.getByRole('row', { name: /Austin Reaves/ })).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('target-backtest.png'), fullPage: true });

  // Following a row opens exactly the games that row is about.
  await backtest.getByRole('link', { name: 'LeBron James games vs ATL' }).click();
  await expect(page).toHaveURL('/?player_name=LeBron+James&opponent_tricode=ATL');
  await expect(page.getByRole('heading', { name: 'Game Logs', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Remove ATL opponent' })).toBeVisible();
  await expect.poll(() => gameLogRequests.length).toBeGreaterThan(0);
  expect(gameLogRequests.at(-1).searchParams.get('opponent_tricode')).toBe('ATL');
  expect(gameLogRequests.at(-1).searchParams.get('player_name')).toBe('LeBron James');
  await expect(page.getByRole('cell', { name: 'ATL', exact: true })).toBeVisible();
});

/*
 * The Lab: composing a Target while watching its Backtest. The draft is read
 * once it holds still, a nudged threshold moves the strip, tonight is one line
 * that comes and goes with the opponent's game, and the saved Target's own
 * page reads the same summary the Lab did — nothing was stored until Save.
 */
test('@critical the Lab reads a draft live, and the saved Target reads the same', async ({
  authenticatedPage: page,
}, testInfo) => {
  await installApiContract(page);
  const previewRequests = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/api/user/targets/preview')
      previewRequests.push(request.postDataJSON());
  });
  await page.goto('/targets');

  // A blank draft is not sent anywhere.
  await expect(page.getByText('Complete the Qualifiers to see the Backtest.')).toBeVisible();
  expect(previewRequests).toHaveLength(0);

  // ATL is on every player's season and plays on no slate: a backtest with
  // rows and no tonight. Four players with a Diet worth leaning on clear 30%
  // of at-rim assists, each with one game against ATL.
  await composeTarget(page, {
    opponent: 'ATL',
    base: 'assist_locations',
    slice: 'AtRimAssists',
    percent: '30',
  });
  const strip = page.getByRole('list', { name: 'Backtest summary' });
  await expect(summaryItem(page, 'Players')).toHaveText(/4$/);
  await expect(summaryItem(page, 'Games')).toHaveText(/4$/);
  await expect(page.getByText(/box-score proxies/)).toBeVisible();
  await expect(page.getByText(/fit tonight/)).toHaveCount(0);
  const table = page.getByRole('table', { name: 'Backtest for ATL vs At-rim assists ≥ 30%' });
  await expect(table.getByRole('row', { name: /Kawhi Leonard/ })).toBeVisible();
  // Composing was several edits and one read, made once the draft held still.
  expect(previewRequests).toHaveLength(1);
  expect(previewRequests[0].qualifiers[0].threshold).toBe(0.3);

  // One nudge up drops the player sitting exactly on 30%, and the strip says so.
  await page.getByRole('button', { name: 'Qualifier 1 threshold up 1%' }).click();
  await expect(page.getByLabel('Qualifier 1 threshold percent')).toHaveValue('31');
  await expect(summaryItem(page, 'Players')).toHaveText(/3$/);
  await expect(
    page.getByRole('table', { name: 'Backtest for ATL vs At-rim assists ≥ 31%' }),
  ).toBeVisible();
  await expect(page.getByRole('row', { name: /Kawhi Leonard/ })).toHaveCount(0);
  await expect.poll(() => previewRequests.length).toBe(2);
  expect(previewRequests[1].qualifiers[0].threshold).toBe(0.31);
  await page.screenshot({ path: testInfo.outputPath('targets-lab.png'), fullPage: true });

  // BOS plays tonight and nobody has faced them yet: tonight, a summary of
  // nothing, and no table.
  await page.getByLabel('Opponent').selectOption('BOS');
  await expect(page.getByText('2 fit tonight vs BOS')).toBeVisible();
  await expect(page.getByText('Nobody qualifying has faced BOS yet.')).toBeVisible();
  await expect(summaryItem(page, 'Players')).toHaveText(/0$/);
  await expect(summaryItem(page, 'AST')).toContainText('—');
  await expect(page.getByRole('table')).toHaveCount(0);

  await page.getByLabel('Opponent').selectOption('ATL');
  await expect(summaryItem(page, 'Players')).toHaveText(/3$/);
  await expect(page.getByText(/fit tonight/)).toHaveCount(0);
  const labSummary = await strip.textContent();

  // Save, and the Target's own page reads the summary the Lab did.
  await page.getByRole('button', { name: 'Save Target' }).click();
  await expect(page).toHaveURL(/\/targets\/\d+$/);
  await expect(page.getByRole('heading', { name: 'ATL vs At-rim assists ≥ 31%' })).toBeVisible();
  await page.getByRole('button', { name: 'Expand backtest' }).click();
  await expect(page.getByRole('list', { name: 'Backtest summary' })).toHaveText(labSummary);
  await expect(page.getByRole('row', { name: /Kawhi Leonard/ })).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('target-detail-summary.png'), fullPage: true });
});
