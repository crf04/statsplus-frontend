import { expect, test } from '../fixtures/courtai';

test('@critical signed-out visitors cannot load Operations diagnostics', async ({ page }) => {
  await page.goto('/operations');
  await expect(
    page.getByRole('heading', { name: 'Sign in to access Operations Console' }),
  ).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'Sign in to access Operations' }).getByRole('button', {
      name: 'Sign in with Google',
    }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Collection cycles' })).not.toBeVisible();
});

test('@critical admin can inspect collection health and confirm an audited repair', async ({
  adminPage: page,
}) => {
  await page.goto('/operations');

  await expect(page.getByRole('heading', { name: 'Operations Console' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Collection cycles' })).toBeVisible();
  await expect(page.getByText('Attention Required: Cycle Window Expired.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Publication streams' })).toBeVisible();
  await expect(page.getByText('Residential NBA collector')).toBeVisible();

  await page.getByRole('button', { name: 'Repair traditional_opponent' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Confirm action' })).toBeDisabled();
  await page.getByLabel('Season').fill('2025-26');
  await page.getByLabel('Cutoff (ISO timestamp)').fill('2026-04-13T00:00:00Z');
  await page.getByLabel('Reason (required)').fill('Reconcile the stale governed slice');
  await page.getByRole('button', { name: 'Confirm action' }).click();

  await expect(page.getByRole('status')).toContainText('queued');
  await expect(page.getByText('Durable job')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Operator jobs' })).toBeVisible();
});

test('@critical admin must confirm rollback and cannot submit a blank reason', async ({
  adminPage: page,
}) => {
  await page.goto('/operations');
  await page.getByRole('button', { name: 'Rollback traditional_opponent' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Confirm action' })).toBeDisabled();
  await page.getByLabel('Expected fence').fill('3');
  await page.getByLabel('Reason (required)').fill('Rollback to the last known publication');
  await expect(page.getByRole('button', { name: 'Confirm action' })).toBeEnabled();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
});

test('@critical ordinary authenticated users see no Operations navigation and are denied direct access', async ({
  authenticatedPage: page,
}) => {
  await page.goto('/operations');
  await expect(
    page.getByRole('heading', { name: 'Administrator permission required' }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'Operations' })).not.toBeVisible();
});
