import { expect, installApiContract, test } from '../fixtures/courtai';

test('@critical authenticated user creates, opens, edits, and deletes a Target', async ({
  authenticatedPage: page,
}, testInfo) => {
  await installApiContract(page);
  await page.goto('/targets');

  await expect(page.getByRole('link', { name: 'Targets' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '0 Targets' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'No Targets yet.' })).toBeVisible();

  // A blank form at the top: one opponent and the Qualifiers a player must meet.
  await page.getByLabel('Opponent').selectOption('OKC');
  await page.getByLabel('Qualifier 1 slice').selectOption('Corner 3');
  await page.getByLabel('Qualifier 1 threshold percent').fill('40');
  await page
    .getByLabel('Note · optional, never the title')
    .fill('Switches everything and leaves the corner late.');
  await expect(page.getByText('OKC vs Corner 3 ≥ 40%')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('targets-form.png'), fullPage: true });

  await page.getByRole('button', { name: 'Save Target' }).click();

  const card = page.getByRole('link', { name: 'Open OKC vs Corner 3 ≥ 40%' });
  await expect(card).toBeVisible();
  await expect(page.getByRole('heading', { name: '1 Target' })).toBeVisible();
  await expect(card).toContainText('Switches everything and leaves the corner late.');
  await page.screenshot({ path: testInfo.outputPath('targets-grid.png'), fullPage: true });

  // A saved Target leaves a blank form behind, so the same idea has to be
  // typed again to be refused as the duplicate it is.
  await expect(page.getByLabel('Qualifier 1 threshold percent')).toHaveValue('25');
  await page.getByLabel('Opponent').selectOption('OKC');
  await page.getByLabel('Qualifier 1 threshold percent').fill('40');
  await page.getByRole('button', { name: 'Save Target' }).click();
  await expect(page.getByRole('alert')).toContainText('You already have that Target for OKC.');
  await expect(page.getByRole('heading', { name: '1 Target' })).toBeVisible();

  await card.click();
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
  await expect(page.getByRole('heading', { name: 'No Targets yet.' })).toBeVisible();
});

test('the Targets page reads and works at a phone width', async ({ authenticatedPage: page }) => {
  await page.setViewportSize({ width: 393, height: 852 });
  await installApiContract(page);
  await page.goto('/targets');

  await page.getByLabel('Opponent').selectOption('BOS');
  await page.getByRole('button', { name: 'Save Target' }).click();
  await expect(page.getByRole('link', { name: /^Open BOS vs / })).toBeVisible();
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
