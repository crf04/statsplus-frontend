import { expect, installApiContract, test } from '../fixtures/courtai';
import { setTargetThreshold } from '../fixtures/targetControls';

const card = (page, title) => page.getByRole('article', { name: title });
const composeTarget = async (page, { opponent, base = 'shot_zones', slice, percent, note }) => {
  if (!(await page.getByLabel('Opponent').isVisible()))
    await page.getByRole('button', { name: '+ New Target' }).click();
  await page.getByLabel('Opponent').selectOption(opponent);
  await page.getByLabel('Qualifier 1 diet base').selectOption(base);
  await page.getByLabel('Qualifier 1 slice').selectOption(slice);
  await setTargetThreshold(page, percent);
  if (note) await page.getByLabel('Note · optional, never the title').fill(note);
};
const saveTarget = async (page) => {
  await page.getByRole('button', { name: 'Save Target' }).click();
  await expect(page).toHaveURL(/\/targets\/\d+$/);
  await page.getByRole('link', { name: '← All Targets' }).click();
};
const openTarget = async (page, title) =>
  card(page, title).getByRole('link', { name: /Edit/ }).click();
const summaryItem = (scope, label) =>
  scope.getByRole('list', { name: 'Backtest summary' }).getByRole('listitem', { name: label });

test('@critical authenticated user creates, opens, edits, and deletes a Target', async ({
  authenticatedPage: page,
}) => {
  await installApiContract(page);
  await page.goto('/targets');
  await expect(page.getByRole('heading', { name: 'No Targets yet.' })).toBeVisible();
  await expect(page.getByRole('slider')).toHaveCount(0);
  await page.getByRole('button', { name: '+ New Target' }).click();
  await expect(page.getByRole('button', { name: 'Save Target' })).toBeDisabled();
  await composeTarget(page, {
    opponent: 'OKC',
    slice: 'Corner 3',
    percent: '40',
    note: 'Leaves the corner late.',
  });
  await expect(page.getByText('league 10%')).toBeVisible();
  const track = await page.getByRole('slider').boundingBox();
  const value = await page.getByText('40%', { exact: true }).boundingBox();
  expect(track.height).toBeLessThanOrEqual(8);
  expect(value.y + value.height).toBeLessThan(track.y);
  await saveTarget(page);
  await expect(card(page, 'OKC vs Corner 3 ≥ 40%')).toContainText('Leaves the corner late.');
  await expect(page.getByText('No Targets active today')).toBeVisible();
  await composeTarget(page, { opponent: 'OKC', slice: 'Corner 3', percent: '40' });
  await page.getByRole('button', { name: 'Save Target' }).click();
  await expect(page.getByRole('alert')).toContainText('You already have that Target for OKC.');
  await composeTarget(page, { opponent: 'MIA', slice: 'Restricted Area', percent: '22' });
  await saveTarget(page);
  await expect(page.getByRole('article')).toHaveCount(2);
  await openTarget(page, 'OKC vs Corner 3 ≥ 40%');
  await expect(page.getByRole('button', { name: 'Save changes' })).toHaveCount(0);
  await page.getByRole('slider').press('ArrowRight');
  await expect(page.getByRole('slider')).toHaveValue('41');
  await page.getByRole('button', { name: 'Revert' }).click();
  await expect(page.getByRole('slider')).toHaveValue('40');
  await page.getByRole('button', { name: 'At or above; switch to at or below' }).click();
  await setTargetThreshold(page, 18);
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('heading', { name: 'OKC vs Corner 3 ≤ 18%' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save changes' })).toHaveCount(0);
  await page.getByRole('link', { name: '← All Targets' }).click();
  await openTarget(page, 'OKC vs Corner 3 ≤ 18%');
  await page.getByRole('button', { name: 'Delete' }).click();
  await page.getByRole('button', { name: 'Keep it' }).click();
  await expect(page.getByRole('slider')).toBeVisible();
  await page.getByRole('button', { name: 'Delete' }).click();
  await page.getByRole('button', { name: 'Yes, delete' }).click();
  await expect(page).toHaveURL('/targets');
  await expect(card(page, 'MIA vs Restricted area ≥ 22%')).toBeVisible();
  await expect(page.getByRole('article')).toHaveCount(1);
});

test('list and workbench fit a phone width', async ({ authenticatedPage: page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installApiContract(page);
  await page.goto('/targets');
  await composeTarget(page, {
    opponent: 'ATL',
    base: 'assist_locations',
    slice: 'AtRimAssists',
    percent: 30,
  });
  await expect(summaryItem(page, 'Games')).toHaveText(/^4games$/);
  await saveTarget(page);
  await expect(card(page, 'ATL vs At-rim assists ≥ 30%')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await openTarget(page, 'ATL vs At-rim assists ≥ 30%');
  await expect(page.getByRole('region', { name: 'Backtest games' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

test('signed-out Targets keep explicit states', async ({ page }) => {
  await installApiContract(page);
  await page.goto('/targets');
  await expect(page.getByRole('heading', { name: 'Sign in to view your Targets' })).toBeVisible();
  await page.goto('/targets/7');
  await expect(page.getByRole('heading', { name: 'Sign in to view your Targets' })).toBeVisible();
  await expect(page).toHaveURL('/targets/7');
  await expect(page.getByRole('navigation', { name: 'Primary' })).toBeVisible();
});
test('missing Targets keep an explicit state', async ({ authenticatedPage: page }) => {
  await installApiContract(page);
  await page.goto('/targets/404');
  await expect(page.getByRole('heading', { name: 'That Target is gone.' })).toBeVisible();
  await page.getByRole('link', { name: '← All Targets' }).click();
  await expect(page).toHaveURL('/targets');
});

test('@critical saved Targets show fits on the list and under the Slate game', async ({
  authenticatedPage: page,
}) => {
  await installApiContract(page);
  await page.goto('/targets');
  await composeTarget(page, {
    opponent: 'BOS',
    base: 'assist_locations',
    slice: 'AtRimAssists',
    percent: 30,
  });
  await saveTarget(page);
  await composeTarget(page, { opponent: 'BOS', slice: 'Mid-Range', percent: 30 });
  await saveTarget(page);
  await composeTarget(page, { opponent: 'OKC', slice: 'Corner 3', percent: 40 });
  await saveTarget(page);
  await expect(page.getByText('2 Targets active today')).toBeVisible();
  const bos = card(page, 'BOS vs At-rim assists ≥ 30%');
  await expect(bos.getByText(/LeBron James/)).toBeVisible();
  await expect(bos.getByRole('link', { name: /LAL @ BOS/ })).toHaveAttribute(
    'href',
    '/matchups/0022500584',
  );
  await expect(card(page, 'OKC vs Corner 3 ≥ 40%')).toContainText('no game today');
  await page.goto('/matchups?date=2026-01-15');
  await expect(page.getByText('2 Targets active')).toBeVisible();
  const row = page
    .getByRole('listitem')
    .filter({ has: page.getByRole('heading', { name: 'LAL @ BOS' }) });
  const fits = row.getByRole('article').filter({ hasText: 'At-rim assists' });
  await expect(fits.getByRole('row', { name: /LeBron James/ })).toContainText('31%');
  await expect(fits.getByRole('row', { name: /LeBron James/ })).toContainText('lg 14%');
  await expect(fits.getByRole('row', { name: /Austin Reaves/ })).toContainText('thin');
  await expect(row.getByText('No LAL player meets every Qualifier today.')).toBeVisible();
});

test('completed-game Targets use canonical game-log participants on the Slate', async ({
  authenticatedPage: page,
}) => {
  await installApiContract(page);
  await page.goto('/targets');
  await composeTarget(page, { opponent: 'MIL', slice: 'Restricted Area', percent: 25 });
  await saveTarget(page);
  await page.goto('/matchups?date=2026-03-29');
  const row = page
    .getByRole('listitem')
    .filter({ has: page.getByRole('heading', { name: 'LAC @ MIL' }) });
  await expect(row.getByRole('row', { name: /Kawhi Leonard/ })).toContainText('28%');
  await expect(row.getByText('from game logs')).toBeVisible();
});

test('@critical the Lab reads on change and the workbench preserves its evidence and log handoff', async ({
  authenticatedPage: page,
}) => {
  await installApiContract(page);
  await page.goto('/targets');
  await page.getByRole('button', { name: '+ New Target' }).click();
  await expect(page.getByText('Complete the Qualifiers to see the Backtest.')).toBeVisible();
  await composeTarget(page, {
    opponent: 'ATL',
    base: 'assist_locations',
    slice: 'AtRimAssists',
    percent: 30,
  });
  await expect(summaryItem(page, 'Games')).toHaveText(/^4games$/);
  await page.getByRole('slider').press('ArrowRight');
  await expect(summaryItem(page, 'Games')).toHaveText(/^3games$/);
  const summary = await page.getByRole('list', { name: 'Backtest summary' }).textContent();
  await page.getByRole('button', { name: 'Save Target' }).click();
  await expect(page).toHaveURL(/\/targets\/\d+$/);
  await expect(page.getByRole('list', { name: 'Backtest summary' })).toHaveText(summary);
  const games = page.getByRole('region', { name: 'Backtest games' });
  await expect(games.getByRole('listitem')).toHaveCount(3);
  await expect(games).not.toContainText('Austin Reaves');
  await page.getByRole('button', { name: /^PA / }).click();
  await expect(page.getByRole('list', { name: /graded by PA margin/ })).toBeVisible();
  await games.getByRole('link', { name: 'LeBron James games vs ATL' }).click();
  await expect(page).toHaveURL('/?player_name=LeBron+James&opponent_tricode=ATL');
  await expect(page.getByRole('button', { name: 'Remove ATL opponent' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'ATL', exact: true })).toBeVisible();
});

test('Slate fits remain readable on a phone', async ({ authenticatedPage: page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installApiContract(page);
  await page.goto('/targets');
  await composeTarget(page, {
    opponent: 'BOS',
    base: 'assist_locations',
    slice: 'AtRimAssists',
    percent: 30,
  });
  await saveTarget(page);
  await page.goto('/matchups?date=2026-01-15');
  await expect(page.getByRole('row', { name: /LeBron James/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

test('@critical a defender Condition narrows the Lab, persists, and appears on the list', async ({
  authenticatedPage: page,
}) => {
  await installApiContract(page);
  await page.goto('/targets');
  await composeTarget(page, {
    opponent: 'ATL',
    base: 'assist_locations',
    slice: 'AtRimAssists',
    percent: 30,
  });
  await page.getByRole('button', { name: 'Save Target' }).click();
  await expect(page).toHaveURL(/\/targets\/\d+$/);
  await expect(summaryItem(page, 'Games')).toHaveText(/^4games$/);
  await page.getByRole('button', { name: '+ and' }).click();
  await page.getByRole('button', { name: 'a defender’s minutes' }).click();
  await page
    .getByLabel('Defender', { exact: true })
    .selectOption({ label: 'Clint Capela · 28.0 min · 3 games' });
  await expect(summaryItem(page, 'Games')).toHaveText(/^1games$/);
  await expect(page.getByText(/1 of 4 opponent games kept/)).toBeVisible();
  await expect(page.getByRole('region', { name: 'Backtest games' })).toContainText('Jayson Tatum');
  await page.getByRole('button', { name: 'stats ▾' }).click();
  await page.getByRole('checkbox', { name: 'PTS/36', exact: true }).check();
  const savedLens = page.waitForResponse(
    (response) =>
      response.request().method() === 'PATCH' &&
      response.request().postDataJSON()?.stat_preferences?.graded_by === 'PTS/36',
  );
  await page.getByRole('button', { name: /^PTS\/36 / }).click();
  await savedLens;
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('button', { name: 'Save changes' })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('list', { name: /graded by PTS\/36/ })).toBeVisible();
  await expect(page.getByLabel('Defender', { exact: true })).toHaveValue('203991');
  await expect(summaryItem(page, 'Games')).toHaveText(/^1games$/);
  const cardRead = page.waitForResponse(
    (response) =>
      response.request().method() === 'GET' &&
      /\/targets\/\d+\/backtest$/.test(new URL(response.url()).pathname),
  );
  await page.getByRole('link', { name: '← All Targets' }).click();
  expect((await cardRead).status()).toBe(200);
  const savedCard = card(page, 'ATL vs At-rim assists ≥ 30%');
  await expect(summaryItem(savedCard, 'Games')).toHaveText(/^1games$/);
  await expect(
    savedCard.getByRole('list', { name: /1 games, oldest to newest, graded by PTS\/36 margin/ }),
  ).toBeVisible();
  await expect(card(page, 'ATL vs At-rim assists ≥ 30%')).toContainText(
    'Clint Capela under 10 min',
  );
  await openTarget(page, 'ATL vs At-rim assists ≥ 30%');
  await page.getByRole('button', { name: '+ and' }).click();
  await page.getByRole('button', { name: 'a date window' }).click();
  await page.getByLabel('From', { exact: true }).fill('2025-01-11');
  await expect(summaryItem(page, 'Games')).toHaveText(/^0games$/);
  await expect(page.getByText(/0 of 4 opponent games kept/)).toBeVisible();
});

test('Slate fits honor a defender who is out and an inclusive date window', async ({
  authenticatedPage: page,
}) => {
  await installApiContract(page);
  await page.goto('/targets');
  await composeTarget(page, {
    opponent: 'BOS',
    base: 'assist_locations',
    slice: 'AtRimAssists',
    percent: 30,
  });
  await page.getByRole('button', { name: '+ and' }).click();
  await page.getByRole('button', { name: 'a defender’s minutes' }).click();
  await page.getByLabel('Defender', { exact: true }).selectOption('204001');
  await expect(page.getByText('2 fit tonight vs BOS')).toBeVisible();
  await page.getByRole('button', { name: '+ and' }).click();
  await page.getByRole('button', { name: 'a date window' }).click();
  await page.getByLabel('From', { exact: true }).fill('2026-01-15');
  await page.getByLabel('Through', { exact: true }).fill('2026-01-15');
  await expect(page.getByText('2 fit tonight vs BOS')).toBeVisible();
  await page.getByRole('button', { name: 'Under; switch to at least' }).click();
  await expect(page.getByText('0 fit tonight vs BOS')).toBeVisible();
  await saveTarget(page);
  await page.goto('/matchups?date=2026-01-15');
  await expect(page.getByText('No LAL player meets every Qualifier today.')).toBeVisible();
});

test('@critical a Target remembers PTS/36 across reload and its collection card', async ({
  authenticatedPage: page,
}) => {
  await installApiContract(page);
  await page.goto('/targets');
  await composeTarget(page, { opponent: 'ATL', slice: 'Restricted Area', percent: 30 });
  await page.getByRole('button', { name: 'Save Target' }).click();
  await expect(page).toHaveURL(/\/targets\/\d+$/);
  await page.getByRole('button', { name: 'stats ▾' }).click();
  await page.getByRole('checkbox', { name: 'PTS/36', exact: true }).check();
  const saved = page.waitForResponse(
    (response) =>
      response.request().method() === 'PATCH' &&
      response.url().includes('/api/user/targets/') &&
      response.request().postDataJSON().stat_preferences?.graded_by === 'PTS/36',
  );
  await page.getByRole('button', { name: /^PTS\/36 / }).click();
  await saved;
  await expect(page.getByRole('button', { name: 'Save changes' })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('list', { name: /graded by PTS\/36/ })).toBeVisible();
  await page.getByRole('link', { name: '← All Targets' }).click();
  await expect(page.getByRole('list', { name: /graded by PTS\/36/ })).toBeVisible();
  await expect(
    page.getByRole('article').getByRole('listitem', { name: 'PTS/36', exact: true }),
  ).toBeVisible();
});
