import { expect } from 'e2e';
import type { Screen } from 'e2e';
import { operationsPayload } from '../fixtures/courtai.js';
import {
  adminTest,
  overflowsHorizontally,
  signedInTest,
  signedOutTest,
} from './support/courtai.ts';

signedOutTest(
  'signed-out visitors cannot read Operations diagnostics',
  async ({ app, screen, api }) => {
    await app.open('/operations');
    await expect(screen.getByRole('heading', 'Sign in to access Operations Console')).toBeVisible();
    expect(api.sent('/api/admin/collection/diagnostics')).toHaveLength(0);
  },
);

signedInTest(
  'ordinary readers cannot open Operations through either route',
  async ({ app, screen, api }) => {
    for (const path of ['/operations', '/admin/operations']) {
      await app.open(path);
      await expect(screen.getByRole('heading', 'Administrator permission required')).toBeVisible();
      await expect(screen.getByRole('link', 'Operations')).toHaveCount(0);
    }
    expect(api.sent('/api/admin/collection/diagnostics')).toHaveLength(0);
  },
);

adminTest(
  'admins inspect health through the legacy alias and return to Matchups',
  { tags: ['critical'] },
  async ({ app, screen, browser }) => {
    await app.open('/admin/operations');
    await expect(screen.getByRole('heading', 'Operations Console')).toBeVisible();
    await expect(
      screen.getByText('Attention Required: this cycle requires operator review.'),
    ).toBeVisible();
    await expect(screen.getByText('collector-e2e-1').first()).toBeVisible();
    await expect(
      screen.getByText('Unsupported provider window; this stream cannot be activated.'),
    ).toBeVisible();
    await expect(screen.getByRole('button', 'Activate synergy:l15')).toHaveCount(0);
    await expect(screen.getByRole('heading', 'Collector usage')).toBeVisible();
    await expect(screen.getByText(/Version mismatch/)).toBeVisible();
    await screen.getByRole('button', 'Refresh').tap();
    await expect(screen.getByRole('heading', 'Publication streams')).toBeVisible();
    expect(await overflowsHorizontally(browser)).toBe(false);
    await screen.getByRole('link', 'Back to Matchups').tap();
    await expect(browser).toHaveURL('/matchups');
    await expect(screen.getByLabel('Slate date')).toBeVisible();
  },
);

const reason = 'Verify bounded operator recovery';
const actions: {
  name: string;
  button: string;
  section?: string;
  path: string;
  body: Record<string, unknown>;
  fields?: (screen: Screen) => Promise<void>;
  job: string;
}[] = [
  {
    name: 'repair',
    button: 'Repair traditional_opponent',
    path: '/repair',
    body: {
      stream_key: 'traditional_opponent',
      season: '2025-26',
      cutoff: '2026-04-13T00:00:00.000Z',
      reason,
    },
    fields: async (screen) => {
      await screen.getByLabel('Season').fill('2025-26');
      await screen.getByLabel('Cutoff (ISO timestamp)').fill('2026-04-13T00:00:00Z');
    },
    job: 'Schedule scoped repair',
  },
  {
    name: 'activation',
    button: 'Activate play_types',
    path: '/streams/play_types/activate',
    body: { reason },
    job: 'Activate stream',
  },
  {
    name: 'rollback',
    button: 'Rollback traditional_opponent',
    path: '/streams/traditional_opponent/rollback',
    body: { reason, expected_fence: 3 },
    job: 'Rollback publication',
  },
  {
    name: 'composition retry',
    button: 'Retry',
    path: '/compositions/composition-e2e-1/retry',
    body: { reason },
    job: 'Retry composition',
  },
  {
    name: 'start cycle',
    button: 'Start cycle',
    path: '/cycles/start',
    body: { manifest_id: 'manifest-e2e-1', reason },
    fields: async (screen) => {
      await screen.getByLabel('Manifest ID').fill('manifest-e2e-1');
    },
    job: 'Start cycle',
  },
  {
    name: 'finish cycle',
    button: 'Finish cycle',
    path: '/cycles/cycle-e2e-1/finish',
    body: { status: 'no_game', reason },
    fields: async (screen) => {
      await screen.getByLabel('Terminal status').selectOption({ value: 'no_game' });
    },
    job: 'Finish cycle',
  },
  {
    name: 'rotate collector',
    button: 'Rotate',
    section: 'Collectors',
    path: '/collectors/collector-e2e-1/rotate',
    body: { reason },
    job: 'Rotate Collector',
  },
  {
    name: 'revoke collector',
    button: 'Revoke',
    section: 'Collectors',
    path: '/collectors/collector-e2e-1/revoke',
    body: { reason },
    job: 'Revoke Collector',
  },
  {
    name: 'resolve reconciliation',
    button: 'Resolve',
    path: '/reconciliation/reconciliation-e2e-1/resolve',
    body: { reason },
    job: 'Resolve reconciliation item',
  },
];

for (const action of actions) {
  adminTest(
    `an admin confirms ${action.name} and sees its durable job`,
    { tags: ['critical'] },
    async ({ app, screen, api }) => {
      await app.open('/operations');
      const scope = action.section ? screen.getByRole('region', action.section) : screen;
      await scope.getByRole('button', action.button).first().tap();
      const dialog = screen.getByRole('dialog');
      await expect(dialog).toBeVisible();
      await expect(dialog.getByRole('button', 'Confirm action')).toBeDisabled();
      await dialog.getByRole('button', 'Cancel').tap();
      expect(api.sent(`/api/admin/collection${action.path}`, 'POST')).toHaveLength(0);
      await scope.getByRole('button', action.button).first().tap();
      if (action.fields) await action.fields(dialog);
      await dialog.getByLabel('Reason (required)').fill(reason);
      await dialog.getByRole('button', 'Confirm action').tap();
      await expect(screen.getByRole('status')).toContainText('Durable job job-e2e-4');
      await expect(
        screen.getByRole('region', 'Operator jobs').getByText(action.job).first(),
      ).toBeVisible();
      await expect(screen.getByRole('region', 'Operator jobs').getByText('Queued')).toBeVisible();
      const requests = api.sent(`/api/admin/collection${action.path}`, 'POST');
      expect(requests).toHaveLength(1);
      expect(requests[0].body).toEqual(action.body);
      expect(requests[0].authorization).toBe('Bearer courtai-e2e-token');
    },
  );
}

adminTest(
  'an operator action failure retains its reason and can be retried',
  async ({ app, screen, browser, api }) => {
    let fail = true;
    await browser.route(
      '**/api/admin/collection/compositions/composition-e2e-1/retry',
      async (route) => {
        if (fail)
          await route.fulfill({
            status: 503,
            json: { error: { message: 'Provider is temporarily unavailable.' } },
          });
        else await route.fallback();
      },
    );
    await app.open('/operations');
    await screen.getByRole('button', 'Retry').tap();
    const dialog = screen.getByRole('dialog');
    await dialog.getByLabel('Reason (required)').fill(reason);
    await dialog.getByRole('button', 'Confirm action').tap();
    await expect(dialog.getByRole('alert')).toHaveText('Provider is temporarily unavailable.');
    await expect(dialog.getByLabel('Reason (required)')).toHaveValue(reason);
    fail = false;
    await dialog.getByRole('button', 'Confirm action').tap();
    await expect(screen.getByRole('status')).toContainText('Durable job job-e2e-4');
    await expect(screen.getByRole('region', 'Operator jobs').getByText('Queued')).toBeVisible();
    expect(
      api.sent('/api/admin/collection/compositions/composition-e2e-1/retry', 'POST'),
    ).toHaveLength(1);
  },
);

adminTest(
  'diagnostics distinguish initial failure, recovery and stale evidence',
  async ({ app, screen, browser }) => {
    let fail = true;
    await browser.route('**/api/admin/collection/diagnostics', async (route) => {
      if (fail)
        await route.fulfill({
          status: 503,
          json: { error: { message: 'Diagnostics service unavailable.' } },
        });
      else await route.fallback();
    });
    await app.open('/operations');
    await expect(screen.getByRole('heading', 'Diagnostics unavailable')).toBeVisible();
    await expect(screen.getByRole('alert')).toContainText('Diagnostics service unavailable.');
    fail = false;
    await screen.getByRole('button', 'Retry diagnostics').tap();
    await expect(screen.getByRole('heading', 'Collection cycles')).toBeVisible();
    await expect(screen.getByText('collector-e2e-1').first()).toBeVisible();
    fail = true;
    await screen.getByRole('button', 'Refresh').tap();
    await expect(screen.getByText('Showing last known diagnostics.')).toBeVisible();
    await expect(screen.getByText('collector-e2e-1').first()).toBeVisible();
  },
);

adminTest(
  'an empty Operations publication names the missing evidence in every section',
  async ({ app, screen, browser }) => {
    await browser.route('**/api/admin/collection/diagnostics', async (route) => {
      await route.fulfill({
        json: {
          ...operationsPayload,
          cycles: [],
          streams: [],
          collectors: [],
          alerts: [],
          reconciliation: [],
          validation: [],
          usage: [],
          jobs: [],
        },
      });
    });
    await app.open('/operations');
    await expect(screen.getByRole('heading', 'Operations Console')).toBeVisible();
    for (const text of [
      'No collection cycles have been recorded.',
      'No publication streams are registered.',
      'No Collector identities are registered.',
      'No open or historical alerts are recorded.',
      'No reconciliation items are recorded.',
      'No validation summaries are recorded.',
      'No usage windows are recorded.',
      'No durable operator jobs are recorded.',
    ])
      await expect(screen.getByText(text)).toBeVisible();
  },
);

adminTest(
  'the agent queues an audited repair',
  { tags: ['agent'] },
  async ({ app, agent, screen }) => {
    await app.open('/operations');
    await expect(screen.getByRole('heading', 'Operations Console')).toBeVisible();
    await agent.act(
      'repair the traditional_opponent stream for season {season} at cutoff {cutoff}; confirm with reason {reason}',
      {
        params: { season: '2025-26', cutoff: '2026-04-13T00:00:00Z', reason },
      },
    );
    await expect(screen.getByRole('status')).toContainText('Durable job job-e2e-4');
    await expect(
      screen.getByRole('region', 'Operator jobs').getByText('Schedule scoped repair'),
    ).toBeVisible();
  },
);
