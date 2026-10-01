/*
 * Parity with the filter-panel design reference (crf04/statsplus#99).
 *
 * The baselines in ./filter-panel-parity.spec.js-snapshots were generated from
 * the prototype's verdict J (tag prototype/filter-panel-j). The real build
 * passes when it reproduces them on the same data, with no baseline updates.
 *
 *   Real build (default):    npx playwright test filter-panel-parity --project=chromium
 *   Against the prototype:   PARITY_TARGET=prototype E2E_BASE_URL=<deployment> npx playwright test ...
 *
 * Contract the real build must keep for this file to apply: the panel root
 * carries data-testid="filter-panel", and the accessible names used below.
 */
import { expect, test } from '@playwright/test';
import { E2E_AUTH_STORAGE_KEY } from '../fixtures/courtai';
import { installParityApi, PARITY_PATH } from '../filterPanelParity/fixture';

const PROTOTYPE = process.env.PARITY_TARGET === 'prototype';
const VARIANT = process.env.PARITY_VARIANT || 'J';

const open = async (page, { width, height }, path = PARITY_PATH) => {
  await page.setViewportSize({ width, height });
  await page.addInitScript((key) => window.localStorage.setItem(key, 'true'), E2E_AUTH_STORAGE_KEY);
  await installParityApi(page);
  await page.goto(PROTOTYPE ? `${path}#proto=filters&v=${VARIANT}` : path);
  const panel = page.getByTestId('filter-panel');
  await expect(panel).toBeVisible();
  await expect(panel.getByText(/of 72 games match/i)).toBeVisible();
  // The prototype's variant switcher is not part of the design.
  await page.addStyleTag({ content: '.proto-switcher { display: none !important; }' });
  await page.evaluate(() => document.fonts.ready);
  return panel;
};

const search = (page) => new URL(page.url()).searchParams;

const DESKTOP = {
  1280: { width: 1280, height: 900 },
  1440: { width: 1440, height: 1000 },
  1920: { width: 1920, height: 1100 },
};
const PHONE = { width: 390, height: 844 };
const SHOT = { maxDiffPixels: 50, animations: 'disabled' };

test.describe('filter panel matches the design reference', () => {
  for (const width of [1280, 1440, 1920]) {
    test(`panel at ${width}`, async ({ page }) => {
      const panel = await open(page, DESKTOP[width]);
      await expect(panel).toHaveScreenshot(`panel-${width}-default.png`, SHOT);
    });
  }

  test('panel with an editor open', async ({ page }) => {
    const panel = await open(page, DESKTOP[1440]);
    await panel.getByRole('button', { name: '+ Opp. defense' }).click();
    await expect(panel).toHaveScreenshot('panel-1440-editor.png', SHOT);
  });

  test('panel with the opponent list expanded', async ({ page }) => {
    const panel = await open(page, DESKTOP[1920]);
    await panel.getByRole('button', { name: '+ 14 more' }).click();
    await expect(panel.getByRole('button', { name: 'Show fewer' })).toBeVisible();
    await expect(panel).toHaveScreenshot('panel-1920-opponent-expanded.png', SHOT);
  });

  test('panel with saved sets expanded', async ({ page }) => {
    const panel = await open(page, DESKTOP[1920]);
    await panel.getByRole('button', { name: '+ 5 more' }).click();
    await expect(panel.getByRole('button', { name: /JJ 25\+ PTS nights/ })).toBeVisible();
    await expect(panel).toHaveScreenshot('panel-1920-saved-expanded.png', SHOT);
  });

  test('panel on a phone', async ({ page }) => {
    const panel = await open(page, PHONE);
    await expect(panel).toHaveScreenshot('panel-390-default.png', SHOT);
    const overflow = await panel.evaluate((el) => el.scrollWidth - el.clientWidth);
    expect(overflow).toBe(0);
  });
});

test.describe('filter panel behaves like the design reference', () => {
  test('the Filter Set reads as rows; removing one and applying rewrites the URL', async ({
    page,
  }) => {
    const panel = await open(page, DESKTOP[1440]);
    await expect(
      panel.getByRole('button', { name: /without\s*Trae Young off court/i }),
    ).toBeVisible();
    await expect(panel.getByText(/10 of 72 games match/i)).toBeVisible();

    await panel.getByRole('button', { name: 'Remove last' }).click();
    await panel.getByRole('button', { name: 'Apply 1 change' }).click();
    await expect.poll(() => search(page).get('game_filter')).toBeNull();
    await expect(panel.getByText(/63 of 72 games match/i)).toBeVisible();
  });

  test('adding Last N from its quick pick applies it', async ({ page }) => {
    const panel = await open(page, DESKTOP[1440]);
    await panel.getByRole('button', { name: 'Remove last' }).click();
    await panel.getByRole('button', { name: '+ Last N' }).click();
    await panel.getByRole('button', { name: '5', exact: true }).click();
    await panel.getByRole('button', { name: 'Done' }).click();
    await panel.getByRole('button', { name: /^Apply \d+ change/ }).click();
    await expect.poll(() => search(page).get('game_filter')).toBe('5');
    await expect(panel.getByText(/5 of 72 games match/i)).toBeVisible();
  });

  test('Own stat line offers its stats without waiting for a click elsewhere', async ({ page }) => {
    const panel = await open(page, DESKTOP[1440]);
    await panel.getByRole('button', { name: '+ Own stat line' }).click();
    await expect(
      panel.getByRole('combobox', { name: 'Stat' }).locator('option', { hasText: 'Points (PTS)' }),
    ).toHaveCount(1);
  });

  test("the next opponent's + adds a tier that the request carries", async ({ page }) => {
    const panel = await open(page, DESKTOP[1920]);
    await expect(panel.getByText(/Next: @ CHA · Oct 22/i)).toBeVisible();
    await expect(panel.getByText('1st fewest')).toBeVisible();
    await panel
      .getByRole('button', { name: 'Add teams ranked 23–30 in Free Throws Allowed' })
      .click();
    await expect(
      panel.getByRole('button', { name: /versus\s*Free Throws Allowed \(ranks 23–30\)/i }),
    ).toBeVisible();
    await panel.getByRole('button', { name: 'Apply 1 change' }).click();
    await expect.poll(() => search(page).getAll('teams_against[]')).toEqual(['OPP_FTA']);
    expect(search(page).getAll('rank_filter[]')).toEqual(['23,30']);
  });

  test('a Saved Filter Set opens its URL', async ({ page }) => {
    const panel = await open(page, DESKTOP[1920]);
    await panel.getByRole('button', { name: /JJ last 10 at home/ }).click();
    await expect.poll(() => search(page).get('location_filter')).toBe('Home');
    expect(search(page).get('game_filter')).toBe('10');
    expect(search(page).getAll('players_off[]')).toEqual([]);
  });
});
