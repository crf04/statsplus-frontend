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
const STREAM_STATUSES = new Set([
  'active',
  'inactive',
  'fresh',
  'stale',
  'degraded',
  'unavailable',
  'superseded',
]);
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
const SAFE_COUNT_KEYS = new Set([
  'complete',
  'checked_streams',
  'passed_streams',
  'failed_streams',
  'missing_streams',
  'governed_not_applicable',
  'team_count',
  'base_count',
  'observation_count',
  'publication_count',
]);
const FORBIDDEN_KEY =
  /(?:secret|credential|token|password|payload|raw|player|wake|database|exception|traceback)/i;
const MUTATION_SAFE_KEYS = new Set([
  'job_id',
  'season',
  'status',
  'activated_at',
  'publication_id',
  'stream_key',
  'enabled',
  'composition_job_id',
  'attempts',
  'cycle_id',
  'request_id',
  'identity_id',
  'item_id',
]);

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

const optionalString = (value, detail, options) =>
  value === undefined || value === null ? null : requireString(value, detail, options);

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
  if (typeof value !== 'string' || !value.includes('T')) fail(detail);
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

const decodeChecksum = (value, detail) =>
  requireString(value, detail, { pattern: /^[a-f0-9]{64}$/ });

const decodeStringList = (value, detail, { max = 64 } = {}) => {
  if (!Array.isArray(value) || value.length > max) fail(detail);
  return value.map((item) => requireString(item, detail, { pattern: /^[A-Za-z0-9._:/-]{1,160}$/ }));
};

const decodeSchemaVersions = (value) => {
  if (!Array.isArray(value) || value.length > 8) fail('The stream schema versions are invalid.');
  return value.map((version) => {
    if (Number.isInteger(version) && version > 0 && version <= 1000) return version;
    if (typeof version === 'string' && /^\d+$/.test(version)) {
      const parsed = Number(version);
      if (parsed > 0 && parsed <= 1000) return parsed;
    }
    fail('The stream schema versions are invalid.');
  });
};

const decodeSafeCounts = (value) => {
  if (!isRecord(value)) fail('The operations API returned invalid validation counts.');
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => {
      if (!SAFE_COUNT_KEYS.has(key)) fail('The operations API returned invalid validation counts.');
      if (typeof item === 'boolean') return [key, item];
      if (Array.isArray(item))
        return [key, decodeStringList(item, 'The validation count list is invalid.')];
      return [
        key,
        requireInteger(item, 'The operations API returned an invalid validation count.', {
          max: 100_000_000,
        }),
      ];
    }),
  );
};

const decodeCycle = (value) => {
  assertKeys(
    value,
    [
      'cycle_id',
      'season',
      'status',
      'cutoff',
      'manifest_id',
      'completed_game_count',
      'completed_at',
      'superseded_at',
      'attention_reason',
    ],
    ['cycle_id', 'season', 'status', 'cutoff'],
    'The operations API returned an invalid collection cycle.',
  );
  if (!CYCLE_STATUSES.has(value.status))
    fail('The operations API returned an invalid cycle status.');
  const completedAt =
    value.completed_at === undefined
      ? null
      : decodeTimestamp(
          value.completed_at,
          'The collection cycle completion timestamp is invalid.',
          {
            nullable: true,
          },
        );
  const supersededAt =
    value.superseded_at === undefined
      ? null
      : decodeTimestamp(
          value.superseded_at,
          'The collection cycle supersession timestamp is invalid.',
          {
            nullable: true,
          },
        );
  return {
    cycleId: decodeIdentifier(
      value.cycle_id,
      'The operations API returned an invalid cycle identifier.',
    ),
    season: decodeSeason(value.season),
    status: value.status,
    cutoff: decodeTimestamp(value.cutoff, 'The collection cycle cutoff is invalid.'),
    manifestId:
      value.manifest_id === undefined || value.manifest_id === null
        ? null
        : decodeIdentifier(value.manifest_id, 'The collection manifest identifier is invalid.'),
    completedGameCount:
      value.completed_game_count === undefined
        ? null
        : requireInteger(value.completed_game_count, 'The completed game count is invalid.', {
            max: 10_000,
          }),
    completedAt,
    supersededAt,
    attentionReason:
      value.attention_reason === undefined || value.attention_reason === null
        ? null
        : decodeCode(value.attention_reason, 'The collection attention reason is invalid.'),
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
      'freshness_rule',
      'freshness_status',
      'status',
      'retrieved_at',
      'last_published_at',
      'cutoff',
      'active_publication_id',
      'publication_version',
      'checksum',
      'schema_versions',
      'supported_windows',
      'completeness_rule',
      'publication_strategy',
      'unavailable_reason',
      'fence',
    ],
    ['stream_key', 'provider', 'owner', 'enabled', 'freshness_rule'],
    'The operations API returned an invalid publication stream.',
  );
  const status = value.freshness_status || value.status || null;
  if (status !== null && !STREAM_STATUSES.has(status))
    fail('The operations API returned an invalid stream status.');
  const timestamp = (key, label) =>
    value[key] === undefined ? null : decodeTimestamp(value[key], label, { nullable: true });
  return {
    streamKey: decodeIdentifier(value.stream_key, 'The publication stream identifier is invalid.'),
    provider: decodeIdentifier(value.provider, 'The publication provider is invalid.'),
    owner: decodeIdentifier(value.owner, 'The publication owner is invalid.'),
    enabled: requireBoolean(value.enabled, 'The publication enabled flag is invalid.'),
    freshnessRule: decodeCode(value.freshness_rule, 'The stream freshness rule is invalid.'),
    freshnessStatus: status,
    retrievedAt: timestamp('retrieved_at', 'The stream retrieval timestamp is invalid.'),
    lastPublishedAt: timestamp('last_published_at', 'The stream publication timestamp is invalid.'),
    cutoff: timestamp('cutoff', 'The stream cutoff is invalid.'),
    activePublicationId:
      value.active_publication_id === undefined || value.active_publication_id === null
        ? null
        : decodeIdentifier(
            value.active_publication_id,
            'The active publication identifier is invalid.',
          ),
    publicationVersion:
      value.publication_version === undefined
        ? null
        : requireInteger(value.publication_version, 'The publication version is invalid.', {
            min: 1,
            max: 1_000_000,
          }),
    checksum:
      value.checksum === undefined || value.checksum === null
        ? null
        : decodeChecksum(value.checksum, 'The publication checksum is invalid.'),
    schemaVersions:
      value.schema_versions === undefined ? [] : decodeSchemaVersions(value.schema_versions),
    supportedWindows:
      value.supported_windows === undefined
        ? []
        : decodeStringList(value.supported_windows, 'The stream windows are invalid.', { max: 8 }),
    completenessRule:
      value.completeness_rule === undefined
        ? null
        : decodeCode(value.completeness_rule, 'The stream completeness rule is invalid.'),
    publicationStrategy:
      value.publication_strategy === undefined
        ? null
        : decodeCode(value.publication_strategy, 'The publication strategy is invalid.'),
    unavailableReason:
      value.unavailable_reason === undefined || value.unavailable_reason === null
        ? null
        : decodeCode(value.unavailable_reason, 'The stream unavailable reason is invalid.'),
    fence:
      value.fence === undefined
        ? null
        : requireInteger(value.fence, 'The stream fence is invalid.', { max: 1_000_000_000 }),
  };
};

const decodeCollector = (value) => {
  assertKeys(
    value,
    [
      'identity_id',
      'label',
      'environment',
      'owner',
      'revoked',
      'last_seen_at',
      'release_version',
      'version',
      'providers',
      'surfaces',
      'scopes',
      'status',
    ],
    ['identity_id', 'environment', 'revoked', 'last_seen_at'],
    'The operations API returned an invalid collector.',
  );
  if (
    value.status !== undefined &&
    !STREAM_STATUSES.has(value.status) &&
    !['offline', 'revoked'].includes(value.status)
  ) {
    fail('The operations API returned an invalid collector status.');
  }
  return {
    identityId: decodeIdentifier(value.identity_id, 'The collector identity is invalid.'),
    label: optionalString(value.label, 'The collector label is invalid.'),
    environment: decodeIdentifier(value.environment, 'The collector environment is invalid.'),
    owner:
      value.owner === undefined
        ? null
        : decodeIdentifier(value.owner, 'The collector owner is invalid.'),
    revoked: requireBoolean(value.revoked, 'The collector revoked flag is invalid.'),
    lastSeenAt: decodeTimestamp(
      value.last_seen_at,
      'The collector last-seen timestamp is invalid.',
      { nullable: true },
    ),
    releaseVersion:
      value.release_version === undefined
        ? value.version === undefined
          ? null
          : requireString(value.version, 'The collector release version is invalid.')
        : requireString(value.release_version, 'The collector release version is invalid.'),
    providers:
      value.providers === undefined
        ? []
        : decodeStringList(value.providers, 'The collector providers are invalid.'),
    surfaces:
      value.surfaces === undefined
        ? []
        : decodeStringList(value.surfaces, 'The collector surfaces are invalid.'),
    scopes:
      value.scopes === undefined
        ? []
        : decodeStringList(value.scopes, 'The collector scopes are invalid.'),
    status: value.status || (value.revoked ? 'revoked' : null),
  };
};

const decodeAlert = (value) => {
  assertKeys(
    value,
    ['alert_id', 'cycle_id', 'severity', 'code', 'status', 'created_at', 'resolved_at'],
    ['alert_id', 'severity', 'code', 'status'],
    'The operations API returned an invalid alert.',
  );
  if (!ALERT_SEVERITIES.has(value.severity) || !ALERT_STATUSES.has(value.status))
    fail('The operations API returned an invalid alert state.');
  return {
    alertId: decodeIdentifier(value.alert_id, 'The alert identifier is invalid.'),
    cycleId:
      value.cycle_id === undefined || value.cycle_id === null
        ? null
        : decodeIdentifier(value.cycle_id, 'The alert cycle identifier is invalid.'),
    severity: value.severity,
    code: decodeCode(value.code, 'The alert code is invalid.'),
    status: value.status,
    createdAt:
      value.created_at === undefined
        ? null
        : decodeTimestamp(value.created_at, 'The alert timestamp is invalid.'),
    resolvedAt:
      value.resolved_at === undefined
        ? null
        : decodeTimestamp(value.resolved_at, 'The alert resolution timestamp is invalid.', {
            nullable: true,
          }),
  };
};

const decodeReconciliation = (value) => {
  assertKeys(
    value,
    ['item_id', 'season', 'kind', 'reason', 'status', 'created_at', 'resolved_at'],
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
    createdAt:
      value.created_at === undefined
        ? null
        : decodeTimestamp(value.created_at, 'The reconciliation timestamp is invalid.'),
    resolvedAt:
      value.resolved_at === undefined
        ? null
        : decodeTimestamp(
            value.resolved_at,
            'The reconciliation resolution timestamp is invalid.',
            { nullable: true },
          ),
  };
};

const decodeValidation = (value) => {
  assertKeys(
    value,
    ['summary_id', 'cycle_id', 'status', 'counts', 'created_at'],
    ['summary_id', 'cycle_id', 'status'],
    'The operations API returned an invalid validation summary.',
  );
  if (!VALIDATION_STATUSES.has(value.status)) fail('The validation status is invalid.');
  return {
    summaryId: decodeIdentifier(value.summary_id, 'The validation summary identifier is invalid.'),
    cycleId: decodeIdentifier(value.cycle_id, 'The validation cycle identifier is invalid.'),
    status: value.status,
    counts: value.counts === undefined ? {} : decodeSafeCounts(value.counts),
    createdAt:
      value.created_at === undefined
        ? null
        : decodeTimestamp(value.created_at, 'The validation timestamp is invalid.'),
  };
};

const decodeUsage = (value) => {
  assertKeys(
    value,
    ['collector_id', 'window_started_at', 'poll_count', 'envelope_count', 'byte_count', 'limits'],
    ['collector_id', 'poll_count', 'envelope_count', 'byte_count'],
    'The operations API returned invalid collector usage.',
  );
  const pollCount = requireInteger(value.poll_count, 'The poll count is invalid.', { max: 100 });
  const envelopeCount = requireInteger(value.envelope_count, 'The envelope count is invalid.', {
    max: 1_000,
  });
  const byteCount = requireInteger(value.byte_count, 'The byte count is invalid.', {
    max: 50 * 1024 * 1024,
  });
  let limits = null;
  if (value.limits !== undefined) {
    assertKeys(
      value.limits,
      ['max_polls', 'max_envelopes', 'max_bytes'],
      [],
      'The usage limits are invalid.',
    );
    limits = {
      maxPolls: requireInteger(value.limits.max_polls, 'The maximum poll count is invalid.', {
        min: 1,
        max: 100_000,
      }),
      maxEnvelopes: requireInteger(
        value.limits.max_envelopes,
        'The maximum envelope count is invalid.',
        { min: 1, max: 1_000_000 },
      ),
      maxBytes: requireInteger(value.limits.max_bytes, 'The maximum byte count is invalid.', {
        min: 1,
        max: 5 * 1024 * 1024 * 1024,
      }),
    };
  }
  return {
    collectorId: decodeIdentifier(value.collector_id, 'The usage collector identifier is invalid.'),
    windowStartedAt:
      value.window_started_at === undefined
        ? null
        : decodeTimestamp(value.window_started_at, 'The usage window timestamp is invalid.'),
    pollCount,
    envelopeCount,
    byteCount,
    limits,
  };
};

const decodeJob = (value) => {
  assertKeys(
    value,
    [
      'job_id',
      'action',
      'resource',
      'status',
      'created_at',
      'updated_at',
      'completed_at',
      'error_code',
    ],
    ['job_id', 'action', 'resource', 'status', 'created_at', 'completed_at', 'error_code'],
    'The operations API returned an invalid operator job.',
  );
  if (!KNOWN_JOB_ACTIONS.has(value.action))
    fail('The operations API returned an invalid operator action.');
  if (!JOB_STATUSES.has(value.status)) fail('The operations API returned an invalid job status.');
  return {
    jobId: decodeIdentifier(value.job_id, 'The operator job identifier is invalid.'),
    action: value.action,
    resource: decodeIdentifier(value.resource, 'The operator job resource is invalid.'),
    status: value.status,
    createdAt: decodeTimestamp(value.created_at, 'The operator job creation timestamp is invalid.'),
    updatedAt:
      value.updated_at === undefined
        ? null
        : decodeTimestamp(value.updated_at, 'The operator job update timestamp is invalid.'),
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
    [
      'cycles',
      'streams',
      'collectors',
      'alerts',
      'reconciliation',
      'validation',
      'usage',
      'jobs',
      'generated_at',
    ],
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
    generatedAt:
      payload.generated_at === undefined
        ? null
        : decodeTimestamp(payload.generated_at, 'The diagnostics timestamp is invalid.'),
  };
};

export const decodeReconciliationResponse = (payload) => {
  assertKeys(payload, ['items'], ['items'], 'The reconciliation response is invalid.');
  return { items: decodeList(payload.items, decodeReconciliation, 'reconciliation') };
};

export const decodeMutationResult = (payload) => {
  assertRecord(payload, 'The operator mutation response is invalid.');
  if (FORBIDDEN_KEY.test(Object.keys(payload).join(' ')))
    fail('The operator mutation response contains forbidden fields.');
  if (!Object.hasOwn(payload, 'job_id'))
    fail('The operator mutation response has no durable job identifier.');
  if (Object.keys(payload).some((key) => !MUTATION_SAFE_KEYS.has(key)))
    fail('The operator mutation response contains an unknown field.');
  const result = {
    jobId: decodeIdentifier(payload.job_id, 'The durable job identifier is invalid.'),
  };
  for (const [key, value] of Object.entries(payload)) {
    if (key === 'job_id') continue;
    if (typeof value === 'string') result[key] = value;
    else if (typeof value === 'boolean') result[key] = value;
    else if (Number.isInteger(value) && value >= 0) result[key] = value;
    else fail('The operator mutation response contains an invalid field.');
  }
  return result;
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

const mutationPaths = {
  activateSeason: (args) => `/api/admin/collection/seasons/${encodeURIComponent(args.season)}`,
  rollbackStream: (args) =>
    `/api/admin/collection/streams/${encodeURIComponent(args.streamKey)}/rollback`,
  activateStream: (args) =>
    `/api/admin/collection/streams/${encodeURIComponent(args.streamKey)}/activate`,
  retryComposition: (args) =>
    `/api/admin/collection/compositions/${encodeURIComponent(args.jobId)}/retry`,
  startCycle: () => '/api/admin/collection/cycles/start',
  scopedRepair: () => '/api/admin/collection/repair',
  finishCycle: (args) => `/api/admin/collection/cycles/${encodeURIComponent(args.cycleId)}/finish`,
  governNotApplicable: (args) =>
    `/api/admin/collection/cycles/${encodeURIComponent(args.cycleId)}/not-applicable`,
  bootstrap: () => '/api/admin/collection/bootstrap',
  revokeCollector: (args) =>
    `/api/admin/collection/collectors/${encodeURIComponent(args.identityId)}/revoke`,
  rotateCollector: (args) =>
    `/api/admin/collection/collectors/${encodeURIComponent(args.identityId)}/rotate`,
  resolveReconciliation: (args) =>
    `/api/admin/collection/reconciliation/${encodeURIComponent(args.itemId)}/resolve`,
};

const postMutation = async (name, args, body, { signal } = {}) => {
  const pathBuilder = mutationPaths[name];
  if (!pathBuilder) throw new Error(`Unknown operations mutation: ${name}`);
  const response = await apiClient.post(getApiUrl(pathBuilder(args)), body, { signal });
  return decodeMutationResult(response.data);
};

const requireReason = (reason) => {
  if (typeof reason !== 'string' || reason.trim().length < 3)
    throw new Error('A human-readable reason is required for operator actions.');
  return reason.trim();
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
    postMutation('activateSeason', { season }, { reason: requireReason(reason) }, options),
  rollbackStream: (streamKey, reason, expectedFence, options) =>
    postMutation(
      'rollbackStream',
      { streamKey },
      {
        reason: requireReason(reason),
        ...(expectedFence === null || expectedFence === undefined
          ? {}
          : { expected_fence: expectedFence }),
      },
      options,
    ),
  activateStream: (streamKey, reason, options) =>
    postMutation('activateStream', { streamKey }, { reason: requireReason(reason) }, options),
  retryComposition: (jobId, reason, options) =>
    postMutation('retryComposition', { jobId }, { reason: requireReason(reason) }, options),
  startCycle: (manifestId, reason, options) =>
    postMutation(
      'startCycle',
      {},
      { manifest_id: manifestId, reason: requireReason(reason) },
      options,
    ),
  scopedRepair: (streamKey, season, cutoff, reason, options) =>
    postMutation(
      'scopedRepair',
      {},
      { stream_key: streamKey, season, cutoff, reason: requireReason(reason) },
      options,
    ),
  finishCycle: (cycleId, status, reason, options) =>
    postMutation('finishCycle', { cycleId }, { status, reason: requireReason(reason) }, options),
  governNotApplicable: (cycleId, streamKey, reason, options) =>
    postMutation(
      'governNotApplicable',
      { cycleId },
      { stream_key: streamKey, reason: requireReason(reason) },
      options,
    ),
  bootstrap: (season, catalogType, cutoff, reason, options) =>
    postMutation(
      'bootstrap',
      {},
      { season, catalog_type: catalogType, cutoff, reason: requireReason(reason) },
      options,
    ),
  revokeCollector: (identityId, reason, options) =>
    postMutation('revokeCollector', { identityId }, { reason: requireReason(reason) }, options),
  rotateCollector: (identityId, reason, overlapSeconds, options) =>
    postMutation(
      'rotateCollector',
      { identityId },
      {
        reason: requireReason(reason),
        ...(overlapSeconds ? { overlap_seconds: overlapSeconds } : {}),
      },
      options,
    ),
  resolveReconciliation: (itemId, reason, options) =>
    postMutation('resolveReconciliation', { itemId }, { reason: requireReason(reason) }, options),
};

// Keep the API seam easy to discover for feature components and tests while
// retaining one implementation and one decoder.
export const decodeDiagnostics = decodeOperationsDiagnostics;
export const fetchOperationsDiagnostics = (options) => operationsApi.getDiagnostics(options);
export const fetchCollectionDiagnostics = fetchOperationsDiagnostics;

export { CYCLE_STATUSES, JOB_STATUSES, STREAM_STATUSES };
