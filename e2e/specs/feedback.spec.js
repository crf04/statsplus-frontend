import { expect, test } from '../fixtures/courtai';

test('a signed-in user sends feedback with a real screenshot from the header', async ({
  authenticatedPage: page,
}) => {
  await page.goto('/privacy');
  await page.getByRole('button', { name: 'Feedback' }).click();
  const popover = page.getByRole('dialog', { name: 'Send feedback' });
  await expect(popover.getByRole('textbox', { name: 'Your feedback' })).toBeFocused();

  await popover.getByRole('textbox', { name: 'Your feedback' }).fill('The privacy page is clear');
  await popover.getByLabel('Include a screenshot of this page').check();
  const request = page.waitForRequest(
    (candidate) => candidate.url().endsWith('/api/user/feedback') && candidate.method() === 'POST',
  );
  await popover.getByRole('button', { name: 'Send' }).click();

  const body = (await request).postDataJSON();
  expect(body).toMatchObject({
    message: 'The privacy page is clear',
    reply_ok: true,
    page: '/privacy',
  });
  expect(body.screenshot).toMatch(/^data:image\/jpeg;base64,/);
  await expect(page.getByRole('status').filter({ hasText: 'Sent. Thanks' })).toHaveText(
    'Sent. Thanks — Chris reads every one.',
  );
  await expect(popover).toHaveCount(0);
});

test('a refused send keeps the draft in the popover', async ({ authenticatedPage: page }) => {
  await page.route('**/api/user/feedback', (route) =>
    route.fulfill({
      status: 503,
      json: { error: { code: 'feedback_unavailable', message: 'Delivery is not configured.' } },
    }),
  );
  await page.goto('/privacy');
  await page.getByRole('button', { name: 'Feedback' }).click();
  const popover = page.getByRole('dialog', { name: 'Send feedback' });
  await popover.getByRole('textbox', { name: 'Your feedback' }).fill('Keep this');
  await popover.getByRole('button', { name: 'Send' }).click();

  await expect(popover.getByRole('alert')).toHaveText('Couldn’t send. Try again.');
  await expect(popover.getByRole('textbox', { name: 'Your feedback' })).toHaveValue('Keep this');
});
