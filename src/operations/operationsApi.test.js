import {
  decodeMutationResult,
  decodeOperationsDiagnostics,
  decodeReconciliationResponse,
  OPERATOR_ACTIONS,
} from './operationsApi';

const diagnostics = {
  cycles: [
    { cycle_id: 'cycle-1', season: '2025-26', status: 'attention', cutoff: '2026-04-13T00:00:00Z' },
  ],
  streams: [
    {
      stream_key: 'player_game_logs',
      provider: 'pbp',
      owner: 'railway',
      enabled: true,
      available: true,
      activation_status: 'active',
      freshness_rule: 'cutoff_current',
      publication_id: 'publication-1',
      coverage_cutoff: '2026-04-13T00:00:00Z',
      fence: 2,
      freshness_status: 'fresh',
      age_seconds: 300,
    },
  ],
  collectors: [
    {
      identity_id: 'collector-1',
      environment: 'production',
      revoked: false,
      last_seen_at: '2026-04-13T00:05:00Z',
      release_version: 'collector-1.2.3',
      release_checksum: 'a'.repeat(64),
    },
  ],
  alerts: [{ alert_id: 'alert-1', severity: 'critical', code: 'cycle_attention', status: 'open' }],
  reconciliation: [
    {
      item_id: 'item-1',
      season: '2025-26',
      kind: 'identity',
      reason: 'identity_unresolved',
      status: 'open',
    },
  ],
  validation: [{ summary_id: 'summary-1', cycle_id: 'cycle-1', status: 'attention' }],
  usage: [
    {
      collector_id: 'collector-1',
      poll_count: 1,
      envelope_count: 2,
      byte_count: 128,
      concurrency_count: 1,
      limits: { poll_count: 100, envelope_count: 1000, byte_count: 52428800, concurrency_count: 1 },
      window_started_at: '2026-04-13T00:00:00Z',
      window_resets_at: '2026-04-14T00:00:00Z',
      retry_after_seconds: 86400,
      concurrency_retry_after_seconds: 30,
    },
  ],
  jobs: [
    {
      job_id: 'job-1',
      action: 'composition.retry',
      resource: 'composition-1',
      status: 'queued',
      created_at: '2026-04-13T00:05:00Z',
      completed_at: null,
      error_code: null,
    },
  ],
};

test('decodes the bounded diagnostics contract into safe UI fields', () => {
  expect(decodeOperationsDiagnostics(diagnostics)).toMatchObject({
    cycles: [{ cycleId: 'cycle-1', status: 'attention' }],
    streams: [{ streamKey: 'player_game_logs', enabled: true }],
    collectors: [{ identityId: 'collector-1', releaseVersion: 'collector-1.2.3' }],
    usage: [{ limits: { pollCount: 100 }, concurrencyRetryAfterSeconds: 30 }],
    jobs: [{ action: 'composition.retry', status: 'queued' }],
  });
});

test.each([
  [
    'unknown cycle state',
    () => ({ ...diagnostics, cycles: [{ ...diagnostics.cycles[0], status: 'running' }] }),
  ],
  [
    'negative usage',
    () => ({ ...diagnostics, usage: [{ ...diagnostics.usage[0], byte_count: -1 }] }),
  ],
  [
    'invalid checksum',
    () => ({
      ...diagnostics,
      collectors: [{ ...diagnostics.collectors[0], release_checksum: 'not-a-checksum' }],
    }),
  ],
  [
    'unknown freshness state',
    () => ({
      ...diagnostics,
      streams: [{ ...diagnostics.streams[0], freshness_status: 'delayed' }],
    }),
  ],
  [
    'inconsistent unavailable stream',
    () => ({
      ...diagnostics,
      streams: [{ ...diagnostics.streams[0], available: false, activation_status: 'active' }],
    }),
  ],
  [
    'count above reported limit',
    () => ({
      ...diagnostics,
      usage: [{ ...diagnostics.usage[0], poll_count: 101 }],
    }),
  ],
  [
    'malformed usage window timestamp',
    () => ({
      ...diagnostics,
      usage: [{ ...diagnostics.usage[0], window_resets_at: 'next-day' }],
    }),
  ],
  [
    'negative retry timing',
    () => ({
      ...diagnostics,
      usage: [{ ...diagnostics.usage[0], retry_after_seconds: -1 }],
    }),
  ],
  [
    'unsafe release version',
    () => ({
      ...diagnostics,
      collectors: [{ ...diagnostics.collectors[0], release_version: '../../credential' }],
    }),
  ],
  [
    'malformed timestamp',
    () => ({ ...diagnostics, cycles: [{ ...diagnostics.cycles[0], cutoff: 'tomorrow' }] }),
  ],
  [
    'secret field',
    () => ({
      ...diagnostics,
      collectors: [{ ...diagnostics.collectors[0], secret: 'never-returned' }],
    }),
  ],
])('rejects %s', (_label, makePayload) => {
  expect(() => decodeOperationsDiagnostics(makePayload())).toThrow(/invalid/i);
});

test('rejects unrecognized response fields instead of leaking them to the page', () => {
  expect(() => decodeOperationsDiagnostics({ ...diagnostics, raw: 'provider response' })).toThrow();
  expect(() =>
    decodeMutationResult('retryComposition', {
      job_id: 'job-1',
      composition_job_id: 'composition-1',
      status: 'queued',
      attempts: 1,
      payload: { player_id: 7 },
    }),
  ).toThrow();
});

test('decodes action-specific durable job responses', () => {
  expect(
    decodeMutationResult('retryComposition', {
      job_id: 'job-1',
      composition_job_id: 'composition-1',
      status: 'queued',
      attempts: 2,
    }),
  ).toEqual({
    jobId: 'job-1',
    compositionJobId: 'composition-1',
    status: 'queued',
    attempts: 2,
  });
});

test.each([
  [
    'unknown mutation status',
    'retryComposition',
    { job_id: 'job-1', composition_job_id: 'composition-1', status: 'paused', attempts: 1 },
  ],
  [
    'negative count',
    'retryComposition',
    { job_id: 'job-1', composition_job_id: 'composition-1', status: 'queued', attempts: -1 },
  ],
  [
    'unsafe count',
    'retryComposition',
    {
      job_id: 'job-1',
      composition_job_id: 'composition-1',
      status: 'queued',
      attempts: Number.MAX_SAFE_INTEGER + 1,
    },
  ],
  [
    'malformed identifier',
    'retryComposition',
    { job_id: 'job 1', composition_job_id: 'composition-1', status: 'queued', attempts: 1 },
  ],
  [
    'malformed season',
    'activateSeason',
    {
      job_id: 'job-1',
      season: '2025',
      status: 'active',
      activated_at: '2026-04-13T00:00:00Z',
    },
  ],
  [
    'malformed timestamp',
    'activateSeason',
    { job_id: 'job-1', season: '2025-26', status: 'active', activated_at: 'tomorrow' },
  ],
  [
    'wrong boolean type',
    'activateStream',
    { job_id: 'job-1', stream_key: 'games', enabled: 'true' },
  ],
  ['unknown action', 'wakeCollector', { job_id: 'job-1' }],
])('rejects %s responses', (_label, action, response) => {
  expect(() => decodeMutationResult(action, response)).toThrow(/invalid/i);
});

test('requires bounded reconciliation lists', () => {
  expect(decodeReconciliationResponse({ items: diagnostics.reconciliation }).items[0].itemId).toBe(
    'item-1',
  );
});

test.each([
  [
    'startCycle',
    {},
    { manifestId: 'manifest-1', reason: 'Start governed cycle' },
    '/api/admin/collection/cycles/start',
    { manifest_id: 'manifest-1', reason: 'Start governed cycle' },
  ],
  [
    'retryComposition',
    { jobId: 'composition-1' },
    { reason: 'Retry failed composition' },
    '/api/admin/collection/compositions/composition-1/retry',
    { reason: 'Retry failed composition' },
  ],
  [
    'scopedRepair',
    {},
    {
      streamKey: 'traditional_opponent',
      season: '2025-26',
      cutoff: '2026-04-13T00:00:00Z',
      reason: 'Repair governed slice',
    },
    '/api/admin/collection/repair',
    {
      stream_key: 'traditional_opponent',
      season: '2025-26',
      cutoff: '2026-04-13T00:00:00.000Z',
      reason: 'Repair governed slice',
    },
  ],
  [
    'activateStream',
    { streamKey: 'synergy:l15' },
    { reason: 'Enable governed stream' },
    '/api/admin/collection/streams/synergy%3Al15/activate',
    { reason: 'Enable governed stream' },
  ],
  [
    'rollbackStream',
    { streamKey: 'games' },
    { reason: 'Restore prior publication', expectedFence: 3 },
    '/api/admin/collection/streams/games/rollback',
    { reason: 'Restore prior publication', expected_fence: 3 },
  ],
  [
    'revokeCollector',
    { identityId: 'collector-1' },
    { reason: 'Revoke compromised identity' },
    '/api/admin/collection/collectors/collector-1/revoke',
    { reason: 'Revoke compromised identity' },
  ],
  [
    'rotateCollector',
    { identityId: 'collector-1' },
    { reason: 'Rotate scheduled identity', overlapSeconds: 3600 },
    '/api/admin/collection/collectors/collector-1/rotate',
    { reason: 'Rotate scheduled identity', overlap_seconds: 3600 },
  ],
])('centralizes the exact %s path and request body', (name, pathArgs, bodyArgs, path, body) => {
  expect(OPERATOR_ACTIONS[name].path(pathArgs)).toBe(path);
  expect(OPERATOR_ACTIONS[name].body(bodyArgs)).toEqual(body);
});
