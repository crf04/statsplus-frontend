import { expect, installApiContract, test } from '../fixtures/courtai';

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
  await expect(
    page.getByText('Attention Required: this cycle requires operator review.'),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Publication streams' })).toBeVisible();
  await expect(page.getByText('collector-e2e-1', { exact: true }).first()).toBeVisible();
  await expect(
    page.getByText('Current freshness is not reported by diagnostics.').first(),
  ).toBeVisible();
  await expect(
    page.getByText('Unsupported provider window; this stream cannot be activated.'),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Activate synergy:l15' })).toHaveCount(0);

  await page.getByRole('button', { name: 'Repair traditional_opponent' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Confirm action' })).toBeDisabled();
  await page.getByLabel('Season').fill('2025-26');
  await page.getByLabel('Cutoff (ISO timestamp)').fill('2026-04-13T00:00:00Z');
  await page.getByLabel('Reason (required)').fill('Reconcile the stale governed slice');
  const repairRequestPromise = page.waitForRequest(
    (request) =>
      request.method() === 'POST' && request.url().endsWith('/api/admin/collection/repair'),
  );
  await page.getByRole('button', { name: 'Confirm action' }).click();
  const repairRequest = await repairRequestPromise;
  expect(repairRequest.headers().authorization).toBe('Bearer courtai-e2e-token');
  expect(repairRequest.postDataJSON()).toEqual({
    stream_key: 'traditional_opponent',
    season: '2025-26',
    cutoff: '2026-04-13T00:00:00.000Z',
    reason: 'Reconcile the stale governed slice',
  });

  await expect(page.getByRole('status')).toContainText('queued');
  await expect(page.getByText('Durable job')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Operator jobs' })).toBeVisible();
});

test('@critical admin confirms activation and rollback with exact audited contracts', async ({
  adminPage: page,
}) => {
  await page.goto('/operations');

  await page.getByRole('button', { name: 'Activate play_types' }).click();
  await page.getByLabel('Reason (required)').fill('Enable governed provider stream');
  const activateRequestPromise = page.waitForRequest((request) =>
    request.url().endsWith('/api/admin/collection/streams/play_types/activate'),
  );
  await page.getByRole('button', { name: 'Confirm action' }).click();
  const activateRequest = await activateRequestPromise;
  expect(activateRequest.headers().authorization).toBe('Bearer courtai-e2e-token');
  expect(activateRequest.postDataJSON()).toEqual({ reason: 'Enable governed provider stream' });
  await expect(page.getByRole('status')).toContainText('queued');

  await page.getByRole('button', { name: 'Rollback traditional_opponent' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Confirm action' })).toBeDisabled();
  await page.getByLabel('Reason (required)').fill('Rollback to the last known publication');
  await expect(page.getByRole('button', { name: 'Confirm action' })).toBeEnabled();
  const rollbackRequestPromise = page.waitForRequest((request) =>
    request.url().endsWith('/api/admin/collection/streams/traditional_opponent/rollback'),
  );
  await page.getByRole('button', { name: 'Confirm action' }).click();
  const rollbackRequest = await rollbackRequestPromise;
  expect(rollbackRequest.headers().authorization).toBe('Bearer courtai-e2e-token');
  expect(rollbackRequest.postDataJSON()).toEqual({
    reason: 'Rollback to the last known publication',
  });
});

test('@critical failed composition retry is confirmed once and creates durable work', async ({
  adminPage: page,
}) => {
  await page.goto('/operations');
  await page.getByRole('button', { name: 'Retry' }).click();
  await page.getByLabel('Reason (required)').fill('Retry after provider recovery');
  const retryRequests = [];
  page.on('request', (request) => {
    if (request.url().endsWith('/api/admin/collection/compositions/composition-e2e-1/retry')) {
      retryRequests.push(request);
    }
  });
  const retryRequestPromise = page.waitForRequest((request) =>
    request.url().endsWith('/api/admin/collection/compositions/composition-e2e-1/retry'),
  );
  const confirm = page.getByRole('button', { name: 'Confirm action' });
  await confirm.dblclick();
  const retryRequest = await retryRequestPromise;
  expect(retryRequest.headers().authorization).toBe('Bearer courtai-e2e-token');
  expect(retryRequest.postDataJSON()).toEqual({ reason: 'Retry after provider recovery' });
  await expect(page.getByRole('status')).toContainText('queued');
  await expect(page.getByText('composition-e2e-1').first()).toBeVisible();
  expect(retryRequests).toHaveLength(1);
});

test('operator failure remains accessible and the confirmed action can be retried', async ({
  adminPage: page,
}) => {
  await page.unroute('**/api/**');
  let attempts = 0;
  await installApiContract(page, {
    '/api/admin/collection/compositions/composition-e2e-1/retry': () => {
      attempts += 1;
      return attempts === 1
        ? { status: 503, body: { error: { message: 'Provider is temporarily unavailable.' } } }
        : {
            status: 202,
            body: {
              job_id: 'job-e2e-retry',
              composition_job_id: 'composition-e2e-1',
              status: 'queued',
              attempts: 2,
            },
          };
    },
  });
  await page.goto('/operations');
  await page.getByRole('button', { name: 'Retry' }).click();
  await page.getByLabel('Reason (required)').fill('Retry after provider recovery');
  await page.getByRole('button', { name: 'Confirm action' }).click();
  await expect(page.getByText('Provider is temporarily unavailable.')).toHaveAttribute(
    'role',
    'alert',
  );
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Confirm action' }).click();
  await expect(page.getByRole('status')).toContainText('queued');
  expect(attempts).toBe(2);
});

test('operator fixture rejects undocumented paths, missing auth, and malformed bodies', async ({
  adminPage: page,
}) => {
  await page.goto('/operations');
  const results = await page.evaluate(async () => {
    const send = (path, body, authorization = 'Bearer courtai-e2e-token') =>
      fetch(path, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authorization ? { authorization } : {}),
        },
        body: JSON.stringify(body),
      }).then((response) => response.status);
    return Promise.all([
      send('/api/admin/collection/repair-all', { reason: 'not documented' }),
      send('/api/admin/collection/repair', { reason: 'missing required fields' }),
      send(
        '/api/admin/collection/repair',
        {
          stream_key: 'traditional_opponent',
          season: '2025-26',
          cutoff: '2026-04-13T00:00:00Z',
          reason: 'valid body without auth',
        },
        '',
      ),
    ]);
  });
  expect(results).toEqual([501, 400, 401]);
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
