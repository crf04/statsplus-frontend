import { expect, test } from '../fixtures/courtai';

test('the publish dialog stays open through fast Escapes and shows a failed publish', async ({
  authenticatedPage: page,
}) => {
  let release;
  const held = new Promise((resolve) => {
    release = resolve;
  });
  let posts = 0;
  await page.route('**/api/user/reports', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    posts += 1;
    await held;
    return route.fulfill({ status: 500, json: { error: { code: 'internal_error' } } });
  });

  await page.goto('/reports/new');
  await page.getByRole('button', { name: 'Add paragraph' }).click();
  await page
    .getByRole('region', { name: 'Block 1: Paragraph' })
    .getByLabel('Text', { exact: true })
    .fill('Bane takes the shots.');
  await page.getByRole('button', { name: 'Publish…' }).click();
  const dialog = page.getByRole('dialog', { name: 'Publish your report' });
  await dialog.getByLabel('Title', { exact: true }).fill('Held publish');
  await dialog.getByRole('button', { name: 'Publish', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'Publishing…' })).toBeDisabled();

  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  await expect(dialog).toBeVisible();

  release();
  await expect(dialog.getByRole('alert')).toHaveText('That didn’t go through. Try again.');
  await expect(dialog.getByRole('button', { name: 'Publish', exact: true })).toBeEnabled();
  expect(posts).toBe(1);
});
