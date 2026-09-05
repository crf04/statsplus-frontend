import { expect, installApiContract, test } from '../fixtures/courtai';

const composeTarget = async (page, { opponent, slice, percent, note }) => {
  await page.getByLabel('Opponent').selectOption(opponent);
  await page.getByLabel('Qualifier 1 slice').selectOption(slice);
  await page.getByLabel('Qualifier 1 threshold percent').fill(percent);
  if (note) await page.getByLabel('Note · optional, never the title').fill(note);
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
