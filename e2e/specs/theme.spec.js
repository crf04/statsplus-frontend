import { E2E_AUTH_STORAGE_KEY, expect, installApiContract, test } from '../fixtures/courtai';

// Every value html[data-theme] takes while the page loads, from before the
// page's own scripts run.
const recordThemes = () => {
  window.ctThemes = [];
  new MutationObserver((records) =>
    records
      .filter(({ target }) => target === document.documentElement)
      .forEach(({ target }) => window.ctThemes.push(target.getAttribute('data-theme'))),
  ).observe(document, { subtree: true, attributes: true, attributeFilter: ['data-theme'] });
};
const themesSeen = (page) => page.evaluate(() => window.ctThemes);
const ground = (page) =>
  page.evaluate(() => getComputedStyle(document.querySelector('.app-header')).backgroundColor);

test.beforeEach(async ({ page }) => {
  await page.addInitScript((key) => window.localStorage.setItem(key, 'true'), E2E_AUTH_STORAGE_KEY);
  await installApiContract(page);
});

test.describe('on a light device', () => {
  test.use({ colorScheme: 'light' });

  test('System follows the device as it switches, without a reload', async ({ page }) => {
    await page.goto('/privacy');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await expect(page.getByRole('button', { name: 'Appearance: System (Light)' })).toBeVisible();
    expect(await ground(page)).toBe('rgba(243, 244, 246, 0.94)');
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#f3f4f6');

    await page.emulateMedia({ colorScheme: 'dark' });
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(page.getByRole('button', { name: 'Appearance: System (Dark)' })).toBeVisible();
    expect(await ground(page)).toBe('rgba(13, 11, 7, 0.94)');
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#0d0b07');
  });

  test('a chosen Dark opens dark from the first paint on reload, before the app runs', async ({
    page,
  }) => {
    await page.goto('/privacy');
    await page.getByRole('button', { name: 'Appearance: System (Light)' }).click();
    await page.getByRole('menuitemradio', { name: 'Dark' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    await page.addInitScript(recordThemes);
    // Hold the app's module so the page is read with only index.html run.
    let release;
    const held = new Promise((resolve) => {
      release = resolve;
    });
    await page.route('**/src/index.js*', async (route) => {
      await held;
      await route.continue();
    });
    const reloaded = page.reload();
    await expect.poll(() => themesSeen(page).catch(() => null)).toEqual(['dark']);
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#0d0b07');
    release();
    await reloaded;
    await expect(page.getByRole('button', { name: 'Appearance: Dark' })).toBeVisible();
    expect(await themesSeen(page)).toEqual(['dark']);
  });
});

test.describe('on a phone', () => {
  test.use({ colorScheme: 'dark', viewport: { width: 390, height: 844 }, hasTouch: true });

  test('the menu opens by tap inside the screen and the header keeps its height', async ({
    page,
  }) => {
    await page.goto('/privacy');
    const header = page.locator('.app-header');
    const toggle = page.getByRole('button', { name: 'Appearance: System (Dark)' });
    const before = await header.boundingBox();
    const box = await toggle.boundingBox();
    // The touch target reaches 44px around the 32px button.
    for (const [dx, dy] of [
      [-21, 0],
      [21, 0],
      [0, -21],
      [0, 21],
    ]) {
      const hit = await page.evaluate(
        ([x, y]) => document.elementFromPoint(x, y)?.closest('.theme-menu-toggle') !== null,
        [box.x + box.width / 2 + dx, box.y + box.height / 2 + dy],
      );
      expect(hit, `${dx},${dy} reaches the button`).toBe(true);
    }

    await toggle.tap();
    const menu = page.getByRole('menu');
    await expect(menu).toBeVisible();
    const menuBox = await menu.boundingBox();
    expect(menuBox.x).toBeGreaterThanOrEqual(0);
    expect(menuBox.x + menuBox.width).toBeLessThanOrEqual(390);
    await page.getByRole('menuitemradio', { name: 'Light' }).tap();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    expect(await header.boundingBox()).toEqual(before);
  });
});
