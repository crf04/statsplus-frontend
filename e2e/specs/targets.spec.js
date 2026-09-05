import { expect, installApiContract, test } from '../fixtures/courtai';

const composeTarget = async (page, { opponent, base, slice, percent, note }) => {
  await page.getByLabel('Opponent').selectOption(opponent);
  if (base) await page.getByLabel('Qualifier 1 diet base').selectOption(base);
  await page.getByLabel('Qualifier 1 slice').selectOption(slice);
  await page.getByLabel('Qualifier 1 threshold percent').fill(percent);
  if (note) await page.getByLabel('Note · optional, never the title').fill(note);
};

/*
 * A saved Target leaves a blank form behind. Composing the next one before
 * that reset lands would be typing into a draft about to be replaced, so this
 * waits for the blank form the reset produces.
 */
const saveTarget = async (page) => {
  await page.getByRole('button', { name: 'Save Target' }).click();
  await expect(page.getByLabel('Qualifier 1 threshold percent')).toHaveValue('');
};

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

  const okcCard = page.getByRole('link', { name: 'Open OKC vs Corner 3 ≥ 40%' });
  await expect(okcCard).toBeVisible();
  await expect(page.getByRole('heading', { name: '1 Target', exact: true })).toBeVisible();
  await expect(okcCard).toContainText('Switches everything and leaves the corner late.');

  // A saved Target leaves a blank form behind, so the same idea has to be
  // typed again to be refused as the duplicate it is.
  await expect(page.getByLabel('Qualifier 1 threshold percent')).toHaveValue('');
  await composeTarget(page, { opponent: 'OKC', slice: 'Corner 3', percent: '40' });
  await page.getByRole('button', { name: 'Save Target' }).click();
  await expect(page.getByRole('alert')).toContainText('You already have that Target for OKC.');
  await expect(page.getByRole('heading', { name: '1 Target', exact: true })).toBeVisible();

  // A second Target, so that opening one is a choice between two rather than
  // whatever the account happens to hold.
  await composeTarget(page, { opponent: 'MIA', slice: 'Restricted Area', percent: '22' });
  await page.getByRole('button', { name: 'Save Target' }).click();
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
  await page.getByRole('button', { name: 'Save Target' }).click();
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
  await expect(page.getByText('+13.0% vs league')).toBeVisible();
  await expect(page.getByText('+1.5σ')).toBeVisible();
  await expect(page.getByText('+9.0% vs league')).toBeVisible();
  await expect(page.getByRole('link', { name: 'LAL vs BOS' })).toBeVisible();
  await expect(page.getByRole('row', { name: /LeBron James/ })).toContainText('31%');
  await page.screenshot({ path: testInfo.outputPath('target-detail-live.png'), fullPage: true });

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
