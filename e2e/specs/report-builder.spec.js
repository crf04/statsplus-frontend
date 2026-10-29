import { BLOCK_REPORT_ID, expect, test } from '../fixtures/courtai';

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
  await expect(dialog).toBeVisible();

  release();
  const refusal = dialog.getByRole('alert');
  await expect(refusal).toBeVisible();
  await expect(refusal).toHaveText('That didn’t go through. Try again.');
  await expect(dialog.getByRole('button', { name: 'Publish', exact: true })).toBeEnabled();
  expect(posts).toBe(1);
});

test('an author previews an injuries Card, inserts it and publishes through the card server', async ({
  authenticatedPage: page,
}) => {
  await page.goto('/reports/new');
  await page.getByRole('button', { name: 'Add heading' }).click();
  await page
    .getByRole('region', { name: 'Block 1: Heading' })
    .getByLabel('Heading', { exact: true })
    .fill('Tonight’s report');
  await page.getByRole('button', { name: 'Add card' }).click();
  const picker = page.getByRole('region', { name: 'Add a card' });
  await picker.getByLabel('Card', { exact: true }).selectOption('get_injuries');
  await picker.getByLabel('Date', { exact: true }).fill('2026-10-27');
  await picker.getByLabel('Team (optional)').selectOption('MEM');
  await picker.getByRole('button', { name: 'Preview card' }).click();
  await expect(
    picker.frameLocator('iframe[title="Report"]').getByText('CourtAI injuries card'),
  ).toBeVisible();
  await picker.getByRole('button', { name: 'Insert card' }).click();

  const block = page.getByRole('region', { name: 'Block 2: Card' });
  await expect(
    block.frameLocator('iframe[title="Report"]').getByText('CourtAI injuries card'),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Publish…' }).click();
  const dialog = page.getByRole('dialog', { name: 'Publish your report' });
  await dialog.getByLabel('Title', { exact: true }).fill('Memphis injuries');
  await dialog.getByLabel('Date', { exact: true }).fill('2026-10-27');
  const publish = page.waitForRequest(
    (request) => request.method() === 'POST' && new URL(request.url()).pathname === '/web/reports',
  );
  await dialog.getByRole('button', { name: 'Publish', exact: true }).click();

  expect((await publish).postDataJSON()).toEqual({
    report: {
      title: 'Memphis injuries',
      date: '2026-10-27',
      blocks: [
        { id: 'b1', type: 'heading', text: 'Tonight’s report' },
        { id: 'b2', type: 'card', card: 'c1' },
      ],
    },
    calls: [{ id: 'c1', tool: 'get_injuries', args: { date: '2026-10-27', team: 'MEM' } }],
    show_author: false,
    listed: false,
  });
  await expect(page).toHaveURL(new RegExp(`/reports/${BLOCK_REPORT_ID}$`));
});
