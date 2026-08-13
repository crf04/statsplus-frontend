import {
  decodeMutationResult,
  decodeOperationsDiagnostics,
  decodeReconciliationResponse,
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
      freshness_rule: 'cutoff_current',
    },
  ],
  collectors: [
    {
      identity_id: 'collector-1',
      environment: 'production',
      revoked: false,
      last_seen_at: '2026-04-13T00:05:00Z',
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
  usage: [{ collector_id: 'collector-1', poll_count: 1, envelope_count: 2, byte_count: 128 }],
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
    collectors: [{ identityId: 'collector-1', lastSeenAt: '2026-04-13T00:05:00.000Z' }],
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
      streams: [{ ...diagnostics.streams[0], checksum: 'not-a-checksum' }],
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
  expect(() => decodeMutationResult({ job_id: 'job-1', payload: { player_id: 7 } })).toThrow();
  expect(() => decodeMutationResult({ job_id: 'job-1', unexpected: 'field' })).toThrow();
});

test('requires durable job responses and bounded reconciliation lists', () => {
  expect(decodeMutationResult({ job_id: 'job-1', status: 'queued' })).toEqual({
    jobId: 'job-1',
    status: 'queued',
  });
  expect(() => decodeMutationResult({ status: 'queued' })).toThrow();
  expect(decodeReconciliationResponse({ items: diagnostics.reconciliation }).items[0].itemId).toBe(
    'item-1',
  );
});
