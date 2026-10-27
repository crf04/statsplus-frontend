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

const failSavedFilterSetsLoad = async (page) => {
  await page.route('**/api/user/saved-filter-sets', (route) =>
    route.fulfill({
      status: 503,
      headers: {
        'x-request-id': '3f9a12bc-7e1d-4c1d-8e21-aaaaaaaaaaaa',
        'access-control-allow-origin': '*',
        'access-control-expose-headers': 'x-request-id',
      },
      json: { error: { code: 'unavailable', message: 'Saved sets are unavailable.' } },
    }),
  );
  await page.goto('/privacy');
  await page.getByRole('button', { name: /CourtAI Test User/ }).click();
  await page.getByRole('button', { name: 'Saved Filter Sets' }).click();
  const modal = page.getByRole('dialog', { name: 'Saved Filter Sets' });
  await modal.getByRole('button', { name: 'Report this' }).click();
  return modal;
};

test('Report this from a failed Saved Filter Sets load takes typing inside the modal', async ({
  authenticatedPage: page,
}) => {
  const modal = await failSavedFilterSetsLoad(page);

  const box = page.getByRole('textbox', { name: 'Your feedback' });
  await expect(box).toBeFocused();
  await page.keyboard.type('It would not load');
  await expect(box).toHaveValue('It would not load');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Send feedback' })).toHaveCount(0);
  await expect(modal).toBeVisible();
  await expect(modal.getByRole('button', { name: 'Report this' })).toBeFocused();
});

test('closing the popover from inside the modal returns focus to Report this', async ({
  authenticatedPage: page,
}) => {
  const modal = await failSavedFilterSetsLoad(page);
  await page.getByRole('button', { name: 'Close feedback' }).click();
  await expect(page.getByRole('dialog', { name: 'Send feedback' })).toHaveCount(0);
  await expect(modal.getByRole('button', { name: 'Report this' })).toBeFocused();
});

test('a send from inside the modal returns focus to Report this and confirms in the modal', async ({
  authenticatedPage: page,
}) => {
  const modal = await failSavedFilterSetsLoad(page);
  await page.getByRole('textbox', { name: 'Your feedback' }).fill('It would not load');
  await page.getByRole('button', { name: 'Send' }).click();

  await expect(page.getByRole('dialog', { name: 'Send feedback' })).toHaveCount(0);
  await expect(modal.getByRole('button', { name: 'Report this' })).toBeFocused();
  await expect(modal.getByRole('status')).toHaveText('Sent. Thanks — Chris reads every one.');
});

test('the popover sits below the phone header and scrolls on a short screen', async ({
  authenticatedPage: page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/privacy');
  await page.getByRole('button', { name: 'Feedback' }).click();
  const popover = page.getByRole('dialog', { name: 'Send feedback' });
  const header = await page.locator('.app-header').boundingBox();
  const opened = await popover.boundingBox();
  expect(opened.y).toBeGreaterThanOrEqual(header.y + header.height);
  expect(opened.x).toBeGreaterThanOrEqual(0);
  expect(opened.x + opened.width).toBeLessThanOrEqual(390);

  // On its side, the phone cannot show it all, so Send is reached by scrolling it.
  await page.setViewportSize({ width: 844, height: 390 });
  const landscape = await popover.boundingBox();
  expect(landscape.y + landscape.height).toBeLessThanOrEqual(390);
  const send = popover.getByRole('button', { name: 'Send' });
  await send.scrollIntoViewIfNeeded();
  await expect(send).toBeInViewport({ ratio: 1 });
});
