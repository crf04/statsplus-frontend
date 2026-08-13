import { apiClient, getApiUrl } from '../config';

/*
 * The collection control plane is intentionally a small, safe-field API. Do
 * not pass its response through to React. The decoder below is the boundary
 * that prevents credentials, payloads, player facts, and exception details
 * from becoming operator UI data if a backend response changes unexpectedly.
 */

const CYCLE_STATUSES = new Set([
  'collecting',
  'complete',
  'no_game',
  'attention',
  'failed',
  'superseded',
]);
const JOB_STATUSES = new Set(['queued', 'running', 'succeeded', 'failed']);
const ALERT_SEVERITIES = new Set(['warning', 'critical']);
const ALERT_STATUSES = new Set(['open', 'resolved']);
const VALIDATION_STATUSES = new Set(['passed', 'failed', 'attention']);
const RECONCILIATION_STATUSES = new Set(['open', 'resolved']);
const STREAM_ACTIVATION_STATUSES = new Set(['active', 'inactive', 'unavailable']);
const STREAM_FRESHNESS_STATUSES = new Set(['fresh', 'stale', 'missing', 'unavailable']);
const MAX_DIAGNOSTIC_INTEGER = 2_147_483_647;
const KNOWN_JOB_ACTIONS = new Set([
  'season.activate',
  'publication.rollback',
  'stream.activate',
  'composition.retry',
  'cycle.start',
  'scoped_repair.start',
  'cycle.finish',
  'cycle.not_applicable',
  'bootstrap.start',
  'collector.revoke',
  'collector.rotate',
  'reconciliation.resolve',
]);
const FORBIDDEN_KEY =
  /(?:secret|credential|token|password|payload|raw|player|wake|database|exception|traceback)/i;

const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

const invalid = (detail = 'The operations API returned an invalid response.') => {
  const error = new Error(detail);
  error.code = 'invalid_operations_response';
  return error;
};

const fail = (detail) => {
  throw invalid(detail);
};

const assertRecord = (value, detail) => {
  if (!isRecord(value)) fail(detail);
  return value;
};

const assertKeys = (value, allowed, required, detail) => {
  assertRecord(value, detail);
  const allowedSet = new Set(allowed);
  const keys = Object.keys(value);
  if (keys.some((key) => FORBIDDEN_KEY.test(key) || !allowedSet.has(key))) fail(detail);
  if (required.some((key) => !Object.hasOwn(value, key))) fail(detail);
};

const requireString = (value, detail, { pattern } = {}) => {
  if (typeof value !== 'string' || value.trim() === '') fail(detail);
  if (pattern && !pattern.test(value)) fail(detail);
  return value;
};

const requireBoolean = (value, detail) => {
  if (typeof value !== 'boolean') fail(detail);
  return value;
};

const requireInteger = (value, detail, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) => {
  if (!Number.isInteger(value) || value < min || value > max) fail(detail);
  return value;
};

const decodeTimestamp = (value, detail, { nullable = false } = {}) => {
  if (nullable && value === null) return null;
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
  )
    fail(detail);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) fail(detail);
  return date.toISOString();
};

const decodeIdentifier = (value, detail = 'The operations API returned an invalid identifier.') =>
  requireString(value, detail, { pattern: /^[A-Za-z0-9._:/-]{1,160}$/ });

const decodeSeason = (value) =>
  requireString(value, 'The operations API returned an invalid season.', {
    pattern: /^\d{4}-\d{2}$/,
  });

const decodeCode = (value, detail) =>
  requireString(value, detail, { pattern: /^[a-z0-9][a-z0-9_.:-]{0,63}$/ });

const decodeNullableIdentifier = (value, detail) =>
  value === null ? null : decodeIdentifier(value, detail);

const decodeNullableInteger = (value, detail) =>
  value === null ? null : requireInteger(value, detail, { max: MAX_DIAGNOSTIC_INTEGER });

const decodeCycle = (value) => {
  assertKeys(
    value,
    ['cycle_id', 'season', 'status', 'cutoff'],
    ['cycle_id', 'season', 'status', 'cutoff'],
    'The operations API returned an invalid collection cycle.',
  );
  if (!CYCLE_STATUSES.has(value.status))
    fail('The operations API returned an invalid cycle status.');
  return {
    cycleId: decodeIdentifier(
      value.cycle_id,
      'The operations API returned an invalid cycle identifier.',
    ),
    season: decodeSeason(value.season),
    status: value.status,
    cutoff: decodeTimestamp(value.cutoff, 'The collection cycle cutoff is invalid.'),
  };
};

const decodeStream = (value) => {
  assertKeys(
    value,
    [
      'stream_key',
      'provider',
      'owner',
      'enabled',
      'available',
      'activation_status',
      'freshness_rule',
      'publication_id',
      'coverage_cutoff',
      'fence',
      'freshness_status',
      'age_seconds',
    ],
    [
      'stream_key',
      'provider',
      'owner',
      'enabled',
      'available',
      'activation_status',
      'freshness_rule',
      'publication_id',
      'coverage_cutoff',
      'fence',
      'freshness_status',
      'age_seconds',
    ],
    'The operations API returned an invalid publication stream.',
  );
  if (!STREAM_ACTIVATION_STATUSES.has(value.activation_status))
    fail('The publication activation status is invalid.');
  if (!STREAM_FRESHNESS_STATUSES.has(value.freshness_status))
    fail('The publication freshness status is invalid.');
  const decoded = {
    streamKey: decodeIdentifier(value.stream_key, 'The publication stream identifier is invalid.'),
    provider: decodeIdentifier(value.provider, 'The publication provider is invalid.'),
    owner: decodeIdentifier(value.owner, 'The publication owner is invalid.'),
    enabled: requireBoolean(value.enabled, 'The publication enabled flag is invalid.'),
    available: requireBoolean(value.available, 'The publication availability flag is invalid.'),
    activationStatus: value.activation_status,
    freshnessRule: decodeCode(value.freshness_rule, 'The stream freshness rule is invalid.'),
    publicationId: decodeNullableIdentifier(
      value.publication_id,
      'The publication identifier is invalid.',
    ),
    coverageCutoff:
      value.coverage_cutoff === null
        ? null
        : decodeTimestamp(value.coverage_cutoff, 'The publication coverage cutoff is invalid.'),
    fence: decodeNullableInteger(value.fence, 'The publication fence is invalid.'),
    freshnessStatus: value.freshness_status,
    ageSeconds: decodeNullableInteger(value.age_seconds, 'The publication age is invalid.'),
  };
  if (
    (!decoded.available &&
      (decoded.enabled ||
        decoded.activationStatus !== 'unavailable' ||
        decoded.freshnessStatus !== 'unavailable' ||
        decoded.publicationId !== null ||
        decoded.coverageCutoff !== null ||
        decoded.fence !== null ||
        decoded.ageSeconds !== null)) ||
    (decoded.available &&
      (decoded.activationStatus !== (decoded.enabled ? 'active' : 'inactive') ||
        decoded.freshnessStatus === 'unavailable')) ||
    (decoded.freshnessStatus === 'missing' &&
      (decoded.publicationId !== null ||
        decoded.coverageCutoff !== null ||
        decoded.ageSeconds !== null)) ||
    (['fresh', 'stale'].includes(decoded.freshnessStatus) &&
      (decoded.publicationId === null ||
        decoded.coverageCutoff === null ||
        decoded.fence === null ||
        decoded.ageSeconds === null))
  )
    fail('The publication diagnostic state is invalid or inconsistent.');
  return decoded;
};

const decodeCollector = (value) => {
  assertKeys(
    value,
    [
      'identity_id',
      'environment',
      'revoked',
      'last_seen_at',
      'release_version',
      'release_checksum',
    ],
    [
      'identity_id',
      'environment',
      'revoked',
      'last_seen_at',
      'release_version',
      'release_checksum',
    ],
    'The operations API returned an invalid collector.',
  );
  if ((value.release_version === null) !== (value.release_checksum === null))
    fail('The collector release evidence is incomplete.');
  return {
    identityId: decodeIdentifier(value.identity_id, 'The collector identity is invalid.'),
    environment: decodeIdentifier(value.environment, 'The collector environment is invalid.'),
    revoked: requireBoolean(value.revoked, 'The collector revoked flag is invalid.'),
    lastSeenAt: decodeTimestamp(
      value.last_seen_at,
      'The collector last-seen timestamp is invalid.',
      { nullable: true },
    ),
    releaseVersion:
      value.release_version === null
        ? null
        : requireString(value.release_version, 'The collector release version is invalid.', {
            pattern: /^[A-Za-z0-9][A-Za-z0-9._+-]{0,63}$/,
          }),
    releaseChecksum:
      value.release_checksum === null
        ? null
        : requireString(value.release_checksum, 'The collector release checksum is invalid.', {
            pattern: /^[0-9a-f]{64}$/,
          }),
  };
};

const decodeAlert = (value) => {
  assertKeys(
    value,
    ['alert_id', 'severity', 'code', 'status'],
    ['alert_id', 'severity', 'code', 'status'],
    'The operations API returned an invalid alert.',
  );
  if (!ALERT_SEVERITIES.has(value.severity) || !ALERT_STATUSES.has(value.status))
    fail('The operations API returned an invalid alert state.');
  return {
    alertId: decodeIdentifier(value.alert_id, 'The alert identifier is invalid.'),
    severity: value.severity,
    code: decodeCode(value.code, 'The alert code is invalid.'),
    status: value.status,
  };
};

const decodeReconciliation = (value) => {
  assertKeys(
    value,
    ['item_id', 'season', 'kind', 'reason', 'status'],
    ['item_id', 'season', 'kind', 'reason', 'status'],
    'The operations API returned an invalid reconciliation item.',
  );
  if (!RECONCILIATION_STATUSES.has(value.status)) fail('The reconciliation status is invalid.');
  return {
    itemId: decodeIdentifier(value.item_id, 'The reconciliation identifier is invalid.'),
    season: decodeSeason(value.season),
    kind: decodeCode(value.kind, 'The reconciliation kind is invalid.'),
    reason: decodeCode(value.reason, 'The reconciliation reason is invalid.'),
    status: value.status,
  };
};

const decodeValidation = (value) => {
  assertKeys(
    value,
    ['summary_id', 'cycle_id', 'status'],
    ['summary_id', 'cycle_id', 'status'],
    'The operations API returned an invalid validation summary.',
  );
  if (!VALIDATION_STATUSES.has(value.status)) fail('The validation status is invalid.');
  return {
    summaryId: decodeIdentifier(value.summary_id, 'The validation summary identifier is invalid.'),
    cycleId: decodeIdentifier(value.cycle_id, 'The validation cycle identifier is invalid.'),
    status: value.status,
  };
};

const decodeUsage = (value) => {
  assertKeys(
    value,
    [
      'collector_id',
      'poll_count',
      'envelope_count',
      'byte_count',
      'concurrency_count',
      'limits',
      'window_started_at',
      'window_resets_at',
      'retry_after_seconds',
      'concurrency_retry_after_seconds',
    ],
    [
      'collector_id',
      'poll_count',
      'envelope_count',
      'byte_count',
      'concurrency_count',
      'limits',
      'window_started_at',
      'window_resets_at',
      'retry_after_seconds',
      'concurrency_retry_after_seconds',
    ],
    'The operations API returned invalid collector usage.',
  );
  assertKeys(
    value.limits,
    ['poll_count', 'envelope_count', 'byte_count', 'concurrency_count'],
    ['poll_count', 'envelope_count', 'byte_count', 'concurrency_count'],
    'The collector usage limits are invalid.',
  );
  const decodeBoundedCount = (count, detail, { min = 0 } = {}) =>
    requireInteger(count, detail, { min, max: MAX_DIAGNOSTIC_INTEGER });
  const limits = {
    pollCount: decodeBoundedCount(value.limits.poll_count, 'The poll limit is invalid.', {
      min: 1,
    }),
    envelopeCount: decodeBoundedCount(
      value.limits.envelope_count,
      'The envelope limit is invalid.',
      {
        min: 1,
      },
    ),
    byteCount: decodeBoundedCount(value.limits.byte_count, 'The byte limit is invalid.', {
      min: 1,
    }),
    concurrencyCount: decodeBoundedCount(
      value.limits.concurrency_count,
      'The concurrency limit is invalid.',
      { min: 1 },
    ),
  };
  const decoded = {
    collectorId: decodeIdentifier(value.collector_id, 'The usage collector identifier is invalid.'),
    pollCount: decodeBoundedCount(value.poll_count, 'The poll count is invalid.'),
    envelopeCount: decodeBoundedCount(value.envelope_count, 'The envelope count is invalid.'),
    byteCount: decodeBoundedCount(value.byte_count, 'The byte count is invalid.'),
    concurrencyCount: decodeBoundedCount(
      value.concurrency_count,
      'The concurrency count is invalid.',
    ),
    limits,
    windowStartedAt: decodeTimestamp(value.window_started_at, 'The usage window start is invalid.'),
    windowResetsAt: decodeTimestamp(value.window_resets_at, 'The usage window reset is invalid.'),
    retryAfterSeconds: decodeBoundedCount(
      value.retry_after_seconds,
      'The usage retry timing is invalid.',
    ),
    concurrencyRetryAfterSeconds: decodeBoundedCount(
      value.concurrency_retry_after_seconds,
      'The concurrency retry timing is invalid.',
    ),
  };
  if (
    decoded.pollCount > limits.pollCount ||
    decoded.envelopeCount > limits.envelopeCount ||
    decoded.byteCount > limits.byteCount ||
    decoded.concurrencyCount > limits.concurrencyCount ||
    new Date(decoded.windowResetsAt) <= new Date(decoded.windowStartedAt) ||
    (decoded.concurrencyCount === 0 && decoded.concurrencyRetryAfterSeconds !== 0)
  )
    fail('The collector usage diagnostic state is invalid or inconsistent.');
  return decoded;
};

const decodeJob = (value) => {
  assertKeys(
    value,
    ['job_id', 'action', 'resource', 'status', 'created_at', 'completed_at', 'error_code'],
    ['job_id', 'action', 'resource', 'status', 'created_at', 'completed_at', 'error_code'],
    'The operations API returned an invalid operator job.',
  );
  if (!KNOWN_JOB_ACTIONS.has(value.action))
    fail('The operations API returned an invalid operator action.');
  if (!JOB_STATUSES.has(value.status)) fail('The operations API returned an invalid job status.');
  const decoded = {
    jobId: decodeIdentifier(value.job_id, 'The operator job identifier is invalid.'),
    action: value.action,
    resource: decodeIdentifier(value.resource, 'The operator job resource is invalid.'),
    status: value.status,
    createdAt: decodeTimestamp(value.created_at, 'The operator job creation timestamp is invalid.'),
    completedAt: decodeTimestamp(
      value.completed_at,
      'The operator job completion timestamp is invalid.',
      { nullable: true },
    ),
    errorCode:
      value.error_code === null || value.error_code === undefined
        ? null
        : decodeCode(value.error_code, 'The operator job error code is invalid.'),
  };
  if (['queued', 'running'].includes(decoded.status) && decoded.completedAt !== null)
    fail('A pending operator job cannot have a completion timestamp.');
  if (['succeeded', 'failed'].includes(decoded.status) && decoded.completedAt === null)
    fail('A completed operator job must have a completion timestamp.');
  if (decoded.status !== 'failed' && decoded.errorCode !== null)
    fail('Only failed operator jobs may include an error code.');
  return decoded;
};

const decodeList = (value, decoder, label) => {
  if (!Array.isArray(value) || value.length > 100)
    fail(`The operations API returned an invalid ${label} list.`);
  return value.map(decoder);
};

/** Decode the backend's bounded operator diagnostics response. */
export const decodeOperationsDiagnostics = (payload) => {
  assertKeys(
    payload,
    ['cycles', 'streams', 'collectors', 'alerts', 'reconciliation', 'validation', 'usage', 'jobs'],
    ['cycles', 'streams', 'collectors', 'alerts', 'reconciliation', 'validation', 'usage', 'jobs'],
    'The operations diagnostics response is invalid.',
  );
  return {
    cycles: decodeList(payload.cycles, decodeCycle, 'cycle'),
    streams: decodeList(payload.streams, decodeStream, 'stream'),
    collectors: decodeList(payload.collectors, decodeCollector, 'collector'),
    alerts: decodeList(payload.alerts, decodeAlert, 'alert'),
    reconciliation: decodeList(payload.reconciliation, decodeReconciliation, 'reconciliation'),
    validation: decodeList(payload.validation, decodeValidation, 'validation'),
    usage: decodeList(payload.usage, decodeUsage, 'usage'),
    jobs: decodeList(payload.jobs, decodeJob, 'job'),
  };
};

export const decodeReconciliationResponse = (payload) => {
  assertKeys(payload, ['items'], ['items'], 'The reconciliation response is invalid.');
  return { items: decodeList(payload.items, decodeReconciliation, 'reconciliation') };
};

export const getOperationsErrorMessage = (
  error,
  fallback = 'The operations request failed. Please try again.',
) => {
  const responseError = error?.response?.data?.error;
  return (
    (typeof responseError === 'string' ? responseError : responseError?.message) ||
    error?.response?.data?.message ||
    error?.message ||
    fallback
  );
};

const requireReason = (reason) => {
  if (typeof reason !== 'string' || reason.trim().length < 3)
    throw new Error('A human-readable reason is required for operator actions.');
  return reason.trim();
};

const responseField = {
  id: (value, key) => decodeIdentifier(value, `The operator ${key} is invalid.`),
  season: (value) => decodeSeason(value),
  timestamp: (value, key) => decodeTimestamp(value, `The operator ${key} is invalid.`),
  boolean: (value, key) => requireBoolean(value, `The operator ${key} is invalid.`),
  count: (value, key) =>
    requireInteger(value, `The operator ${key} is invalid.`, { max: 1_000_000 }),
  status: (allowed) => (value) => {
    if (!allowed.has(value)) fail('The operator mutation response has an invalid status.');
    return value;
  },
};

const mutationStatus = {
  season: new Set(['active', 'inactive']),
  publication: new Set(['candidate', 'active', 'rollback', 'superseded']),
  composition: new Set(['queued', 'running', 'succeeded', 'failed']),
  bootstrap: new Set(['pending', 'succeeded', 'failed', 'expired']),
  reconciliation: new Set(['open', 'resolved']),
};

const descriptor = (path, body, fields) => Object.freeze({ path, body, fields });

/**
 * One contract table drives paths, request bodies, and strict response decoding.
 * Fixture tests import this table so adding an action cannot silently drift.
 */
export const OPERATOR_ACTIONS = Object.freeze({
  activateSeason: descriptor(
    ({ season }) => `/api/admin/collection/seasons/${encodeURIComponent(decodeSeason(season))}`,
    ({ reason }) => ({ reason: requireReason(reason) }),
    {
      job_id: responseField.id,
      season: responseField.season,
      status: responseField.status(mutationStatus.season),
      activated_at: responseField.timestamp,
    },
  ),
  rollbackStream: descriptor(
    ({ streamKey }) =>
      `/api/admin/collection/streams/${encodeURIComponent(decodeIdentifier(streamKey))}/rollback`,
    ({ reason, expectedFence }) => ({
      reason: requireReason(reason),
      ...(expectedFence === null || expectedFence === undefined
        ? {}
        : {
            expected_fence: requireInteger(expectedFence, 'The expected fence is invalid.', {
              max: 1_000_000_000,
            }),
          }),
    }),
    {
      job_id: responseField.id,
      publication_id: responseField.id,
      stream_key: responseField.id,
      status: responseField.status(mutationStatus.publication),
    },
  ),
  activateStream: descriptor(
    ({ streamKey }) =>
      `/api/admin/collection/streams/${encodeURIComponent(decodeIdentifier(streamKey))}/activate`,
    ({ reason }) => ({ reason: requireReason(reason) }),
    {
      job_id: responseField.id,
      stream_key: responseField.id,
      enabled: responseField.boolean,
    },
  ),
  retryComposition: descriptor(
    ({ jobId }) =>
      `/api/admin/collection/compositions/${encodeURIComponent(decodeIdentifier(jobId))}/retry`,
    ({ reason }) => ({ reason: requireReason(reason) }),
    {
      job_id: responseField.id,
      composition_job_id: responseField.id,
      status: responseField.status(mutationStatus.composition),
      attempts: responseField.count,
    },
  ),
  startCycle: descriptor(
    () => '/api/admin/collection/cycles/start',
    ({ manifestId, reason }) => ({
      manifest_id: decodeIdentifier(manifestId, 'The manifest identifier is invalid.'),
      reason: requireReason(reason),
    }),
    {
      job_id: responseField.id,
      cycle_id: responseField.id,
      status: responseField.status(CYCLE_STATUSES),
    },
  ),
  scopedRepair: descriptor(
    () => '/api/admin/collection/repair',
    ({ streamKey, season, cutoff, reason }) => ({
      stream_key: decodeIdentifier(streamKey, 'The stream identifier is invalid.'),
      season: decodeSeason(season),
      cutoff: decodeTimestamp(cutoff, 'The repair cutoff is invalid.'),
      reason: requireReason(reason),
    }),
    {
      job_id: responseField.id,
      composition_job_id: responseField.id,
      status: responseField.status(mutationStatus.composition),
    },
  ),
  finishCycle: descriptor(
    ({ cycleId }) =>
      `/api/admin/collection/cycles/${encodeURIComponent(decodeIdentifier(cycleId))}/finish`,
    ({ status, reason }) => {
      if (!CYCLE_STATUSES.has(status)) throw new Error('The cycle status is invalid.');
      return { status, reason: requireReason(reason) };
    },
    {
      job_id: responseField.id,
      cycle_id: responseField.id,
      status: responseField.status(CYCLE_STATUSES),
    },
  ),
  governNotApplicable: descriptor(
    ({ cycleId }) =>
      `/api/admin/collection/cycles/${encodeURIComponent(decodeIdentifier(cycleId))}/not-applicable`,
    ({ streamKey, reason }) => ({
      stream_key: decodeIdentifier(streamKey, 'The stream identifier is invalid.'),
      reason: requireReason(reason),
    }),
    {
      job_id: responseField.id,
      cycle_id: responseField.id,
      stream_key: responseField.id,
      status: responseField.status(new Set(['governed'])),
    },
  ),
  bootstrap: descriptor(
    () => '/api/admin/collection/bootstrap',
    ({ season, catalogType, cutoff, reason }) => ({
      season: decodeSeason(season),
      catalog_type: decodeCode(catalogType, 'The catalog type is invalid.'),
      cutoff: decodeTimestamp(cutoff, 'The bootstrap cutoff is invalid.'),
      reason: requireReason(reason),
    }),
    {
      job_id: responseField.id,
      request_id: responseField.id,
      status: responseField.status(mutationStatus.bootstrap),
    },
  ),
  revokeCollector: descriptor(
    ({ identityId }) =>
      `/api/admin/collection/collectors/${encodeURIComponent(decodeIdentifier(identityId))}/revoke`,
    ({ reason }) => ({ reason: requireReason(reason) }),
    {
      job_id: responseField.id,
      identity_id: responseField.id,
      status: responseField.status(new Set(['revoked'])),
    },
  ),
  rotateCollector: descriptor(
    ({ identityId }) =>
      `/api/admin/collection/collectors/${encodeURIComponent(decodeIdentifier(identityId))}/rotate`,
    ({ reason, overlapSeconds }) => ({
      reason: requireReason(reason),
      ...(overlapSeconds === null || overlapSeconds === undefined
        ? {}
        : {
            overlap_seconds: requireInteger(overlapSeconds, 'The overlap duration is invalid.', {
              max: 86_400,
            }),
          }),
    }),
    {
      job_id: responseField.id,
      identity_id: responseField.id,
      status: responseField.status(new Set(['rotated'])),
    },
  ),
  resolveReconciliation: descriptor(
    ({ itemId }) =>
      `/api/admin/collection/reconciliation/${encodeURIComponent(decodeIdentifier(itemId))}/resolve`,
    ({ reason }) => ({ reason: requireReason(reason) }),
    {
      job_id: responseField.id,
      item_id: responseField.id,
      status: responseField.status(mutationStatus.reconciliation),
    },
  ),
});

export const decodeMutationResult = (actionName, payload) => {
  const action = OPERATOR_ACTIONS[actionName];
  if (!action) fail('The operator mutation action is invalid.');
  const fieldNames = Object.keys(action.fields);
  assertKeys(
    payload,
    fieldNames,
    fieldNames,
    'The operator mutation response has an invalid shape.',
  );
  return Object.fromEntries(
    fieldNames.map((fieldName) => [
      fieldName === 'job_id'
        ? 'jobId'
        : fieldName.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase()),
      action.fields[fieldName](payload[fieldName], fieldName),
    ]),
  );
};

const postMutation = async (name, pathArgs, bodyArgs, { signal } = {}) => {
  const action = OPERATOR_ACTIONS[name];
  if (!action) throw new Error(`Unknown operations mutation: ${name}`);
  const response = await apiClient.post(getApiUrl(action.path(pathArgs)), action.body(bodyArgs), {
    signal,
  });
  return decodeMutationResult(name, response.data);
};

export const operationsApi = {
  async getDiagnostics({ signal } = {}) {
    const response = await apiClient.get(getApiUrl('/api/admin/collection/diagnostics'), {
      signal,
    });
    return decodeOperationsDiagnostics(response.data);
  },

  async getReconciliation({ signal } = {}) {
    const response = await apiClient.get(getApiUrl('/api/admin/collection/reconciliation'), {
      signal,
    });
    return decodeReconciliationResponse(response.data);
  },

  activateSeason: (season, reason, options) =>
    postMutation('activateSeason', { season }, { reason }, options),
  rollbackStream: (streamKey, reason, expectedFence, options) =>
    postMutation('rollbackStream', { streamKey }, { reason, expectedFence }, options),
  activateStream: (streamKey, reason, options) =>
    postMutation('activateStream', { streamKey }, { reason }, options),
  retryComposition: (jobId, reason, options) =>
    postMutation('retryComposition', { jobId }, { reason }, options),
  startCycle: (manifestId, reason, options) =>
    postMutation('startCycle', {}, { manifestId, reason }, options),
  scopedRepair: (streamKey, season, cutoff, reason, options) =>
    postMutation('scopedRepair', {}, { streamKey, season, cutoff, reason }, options),
  finishCycle: (cycleId, status, reason, options) =>
    postMutation('finishCycle', { cycleId }, { status, reason }, options),
  governNotApplicable: (cycleId, streamKey, reason, options) =>
    postMutation('governNotApplicable', { cycleId }, { streamKey, reason }, options),
  bootstrap: (season, catalogType, cutoff, reason, options) =>
    postMutation('bootstrap', {}, { season, catalogType, cutoff, reason }, options),
  revokeCollector: (identityId, reason, options) =>
    postMutation('revokeCollector', { identityId }, { reason }, options),
  rotateCollector: (identityId, reason, overlapSeconds, options) =>
    postMutation('rotateCollector', { identityId }, { reason, overlapSeconds }, options),
  resolveReconciliation: (itemId, reason, options) =>
    postMutation('resolveReconciliation', { itemId }, { reason }, options),
};

// Keep the API seam easy to discover for feature components and tests while
// retaining one implementation and one decoder.
export const decodeDiagnostics = decodeOperationsDiagnostics;
export const fetchOperationsDiagnostics = (options) => operationsApi.getDiagnostics(options);
export const fetchCollectionDiagnostics = fetchOperationsDiagnostics;

export { CYCLE_STATUSES, JOB_STATUSES };
