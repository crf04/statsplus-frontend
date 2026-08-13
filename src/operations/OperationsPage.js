import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getOperationsErrorMessage, operationsApi } from './operationsApi';
import './OperationsPage.css';

const formatDate = (value) => {
  if (!value) return 'Not recorded';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
};

const humanize = (value) =>
  value
    ? value.replace(/[_.:-]/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
    : 'Not recorded';

const statusClass = (status) => `operations-status operations-status-${status || 'unknown'}`;

const actionLabels = {
  'season.activate': 'Activate season',
  'publication.rollback': 'Rollback publication',
  'stream.activate': 'Activate stream',
  'composition.retry': 'Retry composition',
  'cycle.start': 'Start cycle',
  'scoped_repair.start': 'Schedule scoped repair',
  'cycle.finish': 'Finish cycle',
  'cycle.not_applicable': 'Govern stream as not applicable',
  'bootstrap.start': 'Start catalog bootstrap',
  'collector.revoke': 'Revoke Collector',
  'collector.rotate': 'Rotate Collector',
  'reconciliation.resolve': 'Resolve reconciliation item',
};

const useDiagnostics = (enabled) => {
  const [state, setState] = useState({
    status: enabled ? 'loading' : 'idle',
    data: null,
    error: null,
  });

  const refresh = useCallback(
    async ({ signal } = {}) => {
      if (!enabled) return null;
      setState((previous) => ({ ...previous, status: 'loading', error: null }));
      try {
        const data = await operationsApi.getDiagnostics({ signal });
        setState({ status: 'ready', data, error: null });
        return data;
      } catch (error) {
        if (
          error?.code === 'ERR_CANCELED' ||
          error?.name === 'CanceledError' ||
          error?.name === 'AbortError'
        ) {
          return null;
        }
        setState((previous) => ({
          status: previous.data ? 'ready' : 'error',
          data: previous.data,
          error: getOperationsErrorMessage(error, 'Operations diagnostics could not be loaded.'),
        }));
        return null;
      }
    },
    [enabled],
  );

  useEffect(() => {
    if (!enabled) return undefined;
    const controller = new AbortController();
    refresh({ signal: controller.signal });
    return () => controller.abort();
  }, [enabled, refresh]);

  return { ...state, refresh };
};

function EmptyState({ children }) {
  return <p className="operations-empty">{children}</p>;
}

function Metric({ label, value, detail }) {
  return (
    <div className="operations-metric">
      <span className="operations-metric-label">{label}</span>
      <strong>{value}</strong>
      {detail && <span>{detail}</span>}
    </div>
  );
}

function MutationDialog({
  pending,
  reason,
  setReason,
  formValues,
  setFormValues,
  onCancel,
  onConfirm,
  state,
}) {
  if (!pending) return null;
  const setField = (name, value) => setFormValues((previous) => ({ ...previous, [name]: value }));
  const hasReason = reason.trim().length >= 3;
  const hasRequiredFields = (pending.fields || []).every((field) => {
    if (!field.required) return true;
    const value =
      formValues[field.name] ?? (field.type === 'select' ? field.options?.[0]?.value : undefined);
    return typeof value === 'string'
      ? value.trim().length > 0
      : value !== undefined && value !== null;
  });
  return (
    <div className="operations-dialog-backdrop">
      <section
        className="operations-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="operations-confirm-title"
      >
        <p className="eyebrow">Operator confirmation</p>
        <h2 id="operations-confirm-title">{pending.label}</h2>
        <p>{pending.description}</p>
        {pending.fields?.map((field) => (
          <label key={field.name} className="operations-field">
            <span>{field.label}</span>
            {field.type === 'select' ? (
              <select
                value={formValues[field.name] || field.options[0].value}
                onChange={(event) => setField(field.name, event.target.value)}
                disabled={state.status === 'running'}
              >
                {field.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type={field.type || 'text'}
                value={formValues[field.name] || ''}
                onChange={(event) => setField(field.name, event.target.value)}
                placeholder={field.placeholder}
                required={field.required}
                disabled={state.status === 'running'}
              />
            )}
          </label>
        ))}
        <label className="operations-field" htmlFor="operations-reason">
          <span>Reason (required)</span>
          <textarea
            id="operations-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={3}
            minLength={3}
            placeholder="Describe why this audited action is needed."
            disabled={state.status === 'running'}
          />
        </label>
        <p className="operations-dialog-note">This creates a durable, audited operator job.</p>
        {state.status === 'error' && (
          <p className="operations-inline-error" role="alert">
            {state.message}
          </p>
        )}
        <div className="operations-dialog-actions">
          <button
            type="button"
            className="operations-button operations-button-muted"
            onClick={onCancel}
            disabled={state.status === 'running'}
          >
            Cancel
          </button>
          <button
            type="button"
            className="operations-button"
            onClick={onConfirm}
            disabled={!hasReason || !hasRequiredFields || state.status === 'running'}
          >
            {state.status === 'running' ? 'Submitting…' : 'Confirm action'}
          </button>
        </div>
      </section>
    </div>
  );
}

function CycleSection({ cycles, beginAction, disabled }) {
  return (
    <section className="operations-section" aria-labelledby="operations-cycles-heading">
      <div className="operations-section-heading">
        <div>
          <p className="eyebrow">Immutable cutoff attempts</p>
          <h2 id="operations-cycles-heading">Collection cycles</h2>
        </div>
        <button
          type="button"
          className="operations-button"
          onClick={() =>
            beginAction({
              label: 'Start collection cycle',
              description: 'Start work for an existing immutable manifest.',
              fields: [
                {
                  name: 'manifestId',
                  label: 'Manifest ID',
                  required: true,
                  placeholder: 'manifest identifier',
                },
              ],
              execute: (reason, values) =>
                operationsApi.startCycle(values.manifestId.trim(), reason),
            })
          }
          disabled={disabled}
        >
          Start cycle
        </button>
      </div>
      {cycles.length === 0 ? (
        <EmptyState>No collection cycles have been recorded.</EmptyState>
      ) : (
        <div className="operations-card-grid">
          {cycles.map((cycle) => (
            <article className="operations-card" key={cycle.cycleId}>
              <div className="operations-card-heading">
                <h3>{cycle.season}</h3>
                <span className={statusClass(cycle.status)}>{humanize(cycle.status)}</span>
              </div>
              <dl className="operations-details">
                <div>
                  <dt>Cycle</dt>
                  <dd>{cycle.cycleId}</dd>
                </div>
                <div>
                  <dt>Cutoff</dt>
                  <dd>{formatDate(cycle.cutoff)}</dd>
                </div>
              </dl>
              {cycle.status === 'attention' && (
                <p className="operations-attention" role="alert">
                  Attention Required: this cycle requires operator review.
                </p>
              )}
              {cycle.status === 'superseded' && (
                <p className="operations-muted">
                  This cutoff is superseded; it remains visible for audit.
                </p>
              )}
              {['collecting', 'attention'].includes(cycle.status) && (
                <button
                  type="button"
                  className="operations-button operations-button-muted"
                  disabled={disabled}
                  onClick={() =>
                    beginAction({
                      label: `Finish cycle ${cycle.cycleId}`,
                      description: 'Record the governed terminal state for this immutable cycle.',
                      fields: [
                        {
                          name: 'status',
                          label: 'Terminal status',
                          type: 'select',
                          options: [
                            { value: 'complete', label: 'Complete' },
                            { value: 'no_game', label: 'No game' },
                            { value: 'failed', label: 'Failed' },
                          ],
                        },
                      ],
                      execute: (reason, values) =>
                        operationsApi.finishCycle(
                          cycle.cycleId,
                          values.status || 'complete',
                          reason,
                        ),
                    })
                  }
                >
                  Finish cycle
                </button>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function StreamsSection({ streams, beginAction, disabled }) {
  return (
    <section className="operations-section" aria-labelledby="operations-streams-heading">
      <div className="operations-section-heading">
        <div>
          <p className="eyebrow">Publication registry</p>
          <h2 id="operations-streams-heading">Publication streams</h2>
        </div>
      </div>
      {streams.length === 0 ? (
        <EmptyState>No publication streams are registered.</EmptyState>
      ) : (
        <div className="operations-table-wrap">
          <table className="operations-table">
            <caption className="visually-hidden">
              Publication stream status and safe provenance fields
            </caption>
            <thead>
              <tr>
                <th scope="col">Stream</th>
                <th scope="col">Provider / owner</th>
                <th scope="col">Freshness</th>
                <th scope="col">Activation</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {streams.map((stream) => (
                <tr key={stream.streamKey}>
                  <th scope="row">
                    <span>{stream.streamKey}</span>
                    <small>{stream.freshnessRule}</small>
                  </th>
                  <td>
                    {stream.provider}
                    <br />
                    <small>{stream.owner}</small>
                  </td>
                  <td>
                    <span className="status-neutral">Unavailable</span>
                    <small>
                      {stream.freshnessRule === 'unavailable'
                        ? 'Unsupported provider window; this stream cannot be activated.'
                        : 'Current freshness is not reported by diagnostics.'}
                    </small>
                  </td>
                  <td>{stream.enabled ? 'Enabled' : 'Inactive'}</td>
                  <td className="operations-actions">
                    {!stream.enabled && stream.freshnessRule !== 'unavailable' && (
                      <button
                        type="button"
                        className="operations-button operations-button-small"
                        disabled={disabled}
                        onClick={() =>
                          beginAction({
                            label: `Activate ${stream.streamKey}`,
                            description:
                              'Enable this registered publication stream for future governed cycles.',
                            execute: (reason) =>
                              operationsApi.activateStream(stream.streamKey, reason),
                          })
                        }
                        aria-label={`Activate ${stream.streamKey}`}
                      >
                        Activate
                      </button>
                    )}
                    {stream.enabled && (
                      <button
                        type="button"
                        className="operations-button operations-button-small operations-button-muted"
                        disabled={disabled}
                        onClick={() =>
                          beginAction({
                            label: `Rollback ${stream.streamKey}`,
                            description:
                              'Move this stream back to its previous governed publication, if the fence still matches.',
                            execute: (reason) =>
                              operationsApi.rollbackStream(stream.streamKey, reason, null),
                          })
                        }
                        aria-label={`Rollback ${stream.streamKey}`}
                      >
                        Rollback
                      </button>
                    )}
                    {stream.enabled && (
                      <button
                        type="button"
                        className="operations-button operations-button-small operations-button-muted"
                        disabled={disabled}
                        onClick={() =>
                          beginAction({
                            label: `Repair ${stream.streamKey}`,
                            description: 'Schedule a bounded repair for this stream and cutoff.',
                            fields: [
                              {
                                name: 'season',
                                label: 'Season',
                                required: true,
                                placeholder: '2025-26',
                              },
                              {
                                name: 'cutoff',
                                label: 'Cutoff (ISO timestamp)',
                                required: true,
                                placeholder: '2026-04-13T00:00:00Z',
                              },
                            ],
                            execute: (reason, values) =>
                              operationsApi.scopedRepair(
                                stream.streamKey,
                                values.season.trim(),
                                values.cutoff.trim(),
                                reason,
                              ),
                          })
                        }
                        aria-label={`Repair ${stream.streamKey}`}
                      >
                        Repair
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function CollectorsSection({ collectors, beginAction, disabled }) {
  return (
    <section className="operations-section" aria-labelledby="operations-collectors-heading">
      <div className="operations-section-heading">
        <div>
          <p className="eyebrow">Machine health</p>
          <h2 id="operations-collectors-heading">Collectors</h2>
        </div>
      </div>
      {collectors.length === 0 ? (
        <EmptyState>No Collector identities are registered.</EmptyState>
      ) : (
        <div className="operations-card-grid">
          {collectors.map((collector) => (
            <article className="operations-card" key={collector.identityId}>
              <div className="operations-card-heading">
                <h3>{collector.identityId}</h3>
                <span className={statusClass(collector.revoked ? 'revoked' : 'active')}>
                  {collector.revoked ? 'Revoked' : 'Active'}
                </span>
              </div>
              <dl className="operations-details">
                <div>
                  <dt>Identity</dt>
                  <dd>{collector.identityId}</dd>
                </div>
                <div>
                  <dt>Environment</dt>
                  <dd>{collector.environment}</dd>
                </div>
                <div>
                  <dt>Last seen</dt>
                  <dd>{formatDate(collector.lastSeenAt)}</dd>
                </div>
                <div>
                  <dt>Release</dt>
                  <dd>Not reported by diagnostics</dd>
                </div>
              </dl>
              {collector.lastSeenAt === null && (
                <p className="operations-attention">
                  Offline: no last-seen heartbeat has been recorded.
                </p>
              )}
              <div className="operations-actions">
                {!collector.revoked && (
                  <>
                    <button
                      type="button"
                      className="operations-button operations-button-small operations-button-muted"
                      disabled={disabled}
                      onClick={() =>
                        beginAction({
                          label: `Rotate ${collector.identityId}`,
                          description:
                            'Rotate the machine identity with a bounded overlap window. The replacement secret is never shown in this console.',
                          execute: (reason) =>
                            operationsApi.rotateCollector(collector.identityId, reason),
                        })
                      }
                    >
                      Rotate
                    </button>
                    <button
                      type="button"
                      className="operations-button operations-button-small operations-button-danger"
                      disabled={disabled}
                      onClick={() =>
                        beginAction({
                          label: `Revoke ${collector.identityId}`,
                          description:
                            'Revoke this machine identity. Recovery occurs through the private operator network.',
                          execute: (reason) =>
                            operationsApi.revokeCollector(collector.identityId, reason),
                        })
                      }
                    >
                      Revoke
                    </button>
                  </>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function AlertsSection({ alerts }) {
  return (
    <section className="operations-section" aria-labelledby="operations-alerts-heading">
      <div className="operations-section-heading">
        <div>
          <p className="eyebrow">Bounded signals</p>
          <h2 id="operations-alerts-heading">Alerts</h2>
        </div>
      </div>
      {alerts.length === 0 ? (
        <EmptyState>No open or historical alerts are recorded.</EmptyState>
      ) : (
        <div className="operations-list">
          {alerts.map((alert) => (
            <article className="operations-list-row" key={alert.alertId}>
              <span className={statusClass(alert.severity)}>{humanize(alert.severity)}</span>
              <div>
                <strong>{humanize(alert.code)}</strong>
                <small>Collection control plane</small>
              </div>
              <span className={statusClass(alert.status)}>{humanize(alert.status)}</span>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function ReconciliationSection({ items, beginAction, disabled }) {
  return (
    <section className="operations-section" aria-labelledby="operations-reconciliation-heading">
      <div className="operations-section-heading">
        <div>
          <p className="eyebrow">Bounded follow-up</p>
          <h2 id="operations-reconciliation-heading">Reconciliation</h2>
        </div>
      </div>
      {items.length === 0 ? (
        <EmptyState>No reconciliation items are recorded.</EmptyState>
      ) : (
        <div className="operations-list">
          {items.map((item) => (
            <article className="operations-list-row" key={item.itemId}>
              <div>
                <strong>{humanize(item.kind)}</strong>
                <small>
                  {item.season} · {humanize(item.reason)}
                </small>
              </div>
              <span className={statusClass(item.status)}>{humanize(item.status)}</span>
              {item.status === 'open' && (
                <button
                  type="button"
                  className="operations-button operations-button-small"
                  disabled={disabled}
                  onClick={() =>
                    beginAction({
                      label: `Resolve reconciliation ${item.itemId}`,
                      description:
                        'Mark this bounded reconciliation item resolved after the underlying repair is complete.',
                      execute: (reason) => operationsApi.resolveReconciliation(item.itemId, reason),
                    })
                  }
                >
                  Resolve
                </button>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function ValidationSection({ validation }) {
  return (
    <section className="operations-section" aria-labelledby="operations-validation-heading">
      <div className="operations-section-heading">
        <div>
          <p className="eyebrow">Evidence gates</p>
          <h2 id="operations-validation-heading">Validation summaries</h2>
        </div>
      </div>
      {validation.length === 0 ? (
        <EmptyState>No validation summaries are recorded.</EmptyState>
      ) : (
        <div className="operations-list">
          {validation.map((summary) => (
            <article className="operations-list-row" key={summary.summaryId}>
              <div>
                <strong>Cycle {summary.cycleId}</strong>
                <small>Counts and check time are not reported.</small>
              </div>
              <span className={statusClass(summary.status)}>{humanize(summary.status)}</span>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function UsageSection({ usage }) {
  return (
    <section className="operations-section" aria-labelledby="operations-usage-heading">
      <div className="operations-section-heading">
        <div>
          <p className="eyebrow">Rate-limit window</p>
          <h2 id="operations-usage-heading">Collector usage</h2>
        </div>
      </div>
      {usage.length === 0 ? (
        <EmptyState>No usage windows are recorded.</EmptyState>
      ) : (
        <div className="operations-card-grid operations-card-grid-compact">
          {usage.map((entry) => (
            <article className="operations-card" key={entry.collectorId}>
              <h3>{entry.collectorId}</h3>
              <div className="operations-metric-row">
                <Metric label="Polls" value={entry.pollCount} detail="Limit not reported" />
                <Metric label="Envelopes" value={entry.envelopeCount} detail="Limit not reported" />
                <Metric
                  label="Bytes"
                  value={entry.byteCount.toLocaleString()}
                  detail="Limit not reported"
                />
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function JobsSection({ jobs, beginAction, disabled }) {
  return (
    <section className="operations-section" aria-labelledby="operations-jobs-heading">
      <div className="operations-section-heading">
        <div>
          <p className="eyebrow">Durable work</p>
          <h2 id="operations-jobs-heading">Operator jobs</h2>
        </div>
      </div>
      {jobs.length === 0 ? (
        <EmptyState>No durable operator jobs are recorded.</EmptyState>
      ) : (
        <div className="operations-list">
          {jobs.map((job) => (
            <article className="operations-list-row" key={job.jobId}>
              <div>
                <strong>{actionLabels[job.action] || humanize(job.action)}</strong>
                <small>
                  {job.resource} · Created {formatDate(job.createdAt)}
                </small>
              </div>
              <span className={statusClass(job.status)}>{humanize(job.status)}</span>
              {job.errorCode && (
                <span className="operations-inline-error">{humanize(job.errorCode)}</span>
              )}
              {job.action === 'composition.retry' && job.status === 'failed' && (
                <button
                  type="button"
                  className="operations-button operations-button-small"
                  disabled={disabled}
                  onClick={() =>
                    beginAction({
                      label: `Retry composition ${job.resource}`,
                      description: 'Queue a new attempt behind the durable composition fence.',
                      execute: (reason) => operationsApi.retryComposition(job.resource, reason),
                    })
                  }
                >
                  Retry
                </button>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export default function OperationsPage() {
  const { isAdmin } = useAuth();
  const diagnostics = useDiagnostics(isAdmin);
  const [pendingAction, setPendingAction] = useState(null);
  const [reason, setReason] = useState('');
  const [formValues, setFormValues] = useState({});
  const [mutation, setMutation] = useState({ status: 'idle', message: null, jobId: null });

  const beginAction = (action) => {
    setPendingAction(action);
    setReason('');
    setFormValues({});
    setMutation({ status: 'idle', message: null, jobId: null });
  };

  const cancelAction = () => {
    if (mutation.status === 'running') return;
    setPendingAction(null);
    setReason('');
    setFormValues({});
  };

  const confirmAction = async () => {
    if (!pendingAction || reason.trim().length < 3 || mutation.status === 'running') return;
    setMutation({ status: 'running', message: null, jobId: null });
    try {
      const result = await pendingAction.execute(reason.trim(), formValues);
      setMutation({
        status: 'success',
        message: `${actionLabels[pendingAction.action] || pendingAction.label} queued.`,
        jobId: result.jobId,
      });
      setPendingAction(null);
      setReason('');
      setFormValues({});
      await diagnostics.refresh();
    } catch (error) {
      setMutation({
        status: 'error',
        message: getOperationsErrorMessage(error, 'The operator action could not be queued.'),
        jobId: null,
      });
    }
  };

  const data = diagnostics.data;
  const totals = useMemo(() => {
    if (!data) return null;
    return {
      attention:
        data.cycles.filter((cycle) => cycle.status === 'attention').length +
        data.alerts.filter((alert) => alert.status === 'open').length,
      activeStreams: data.streams.filter((stream) => stream.enabled).length,
      onlineCollectors: data.collectors.filter(
        (collector) => collector.lastSeenAt && !collector.revoked,
      ).length,
      runningJobs: data.jobs.filter((job) => ['queued', 'running'].includes(job.status)).length,
    };
  }, [data]);

  if (diagnostics.status === 'loading' && !data) {
    return (
      <main className="operations-page" aria-busy="true">
        <p className="eyebrow">Firebase-admin surface</p>
        <h1>Operations Console</h1>
        <p role="status">Loading collection diagnostics…</p>
      </main>
    );
  }

  if (diagnostics.status === 'error' && !data) {
    return (
      <main className="operations-page">
        <p className="eyebrow">Firebase-admin surface</p>
        <h1>Operations Console</h1>
        <div className="operations-state operations-state-error" role="alert">
          <h2>Diagnostics unavailable</h2>
          <p>{diagnostics.error}</p>
          <button type="button" className="operations-button" onClick={() => diagnostics.refresh()}>
            Retry diagnostics
          </button>
        </div>
      </main>
    );
  }

  if (!data) return null;

  return (
    <main className="operations-page">
      <div className="operations-heading">
        <div>
          <p className="eyebrow">Firebase-admin surface</p>
          <h1>Operations Console</h1>
          <p className="operations-lede">
            Bounded collection health and audited controls for the active Regular Season.
          </p>
        </div>
        <div className="operations-heading-actions">
          <Link to="/matchups" className="operations-link">
            Back to Matchups
          </Link>
          <button
            type="button"
            className="operations-button operations-button-muted"
            onClick={() => diagnostics.refresh()}
            disabled={diagnostics.status === 'loading'}
          >
            {diagnostics.status === 'loading' ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>
      {diagnostics.error && (
        <div className="operations-state operations-state-warning" role="alert">
          <strong>Showing last known diagnostics.</strong> {diagnostics.error}
        </div>
      )}
      {mutation.status === 'success' && (
        <div className="operations-state operations-state-success" role="status">
          {mutation.message} Durable job <code>{mutation.jobId}</code> is visible in Operator jobs.
        </div>
      )}
      {totals && (
        <section className="operations-overview" aria-label="Operations overview">
          <Metric label="Attention required" value={totals.attention} />
          <Metric label="Active streams" value={totals.activeStreams} />
          <Metric label="Collectors seen" value={totals.onlineCollectors} />
          <Metric label="Collector releases" value="Unavailable" detail="Not reported" />
          <Metric label="Queued or running jobs" value={totals.runningJobs} />
        </section>
      )}
      <CycleSection
        cycles={data.cycles}
        beginAction={beginAction}
        disabled={mutation.status === 'running'}
      />
      <StreamsSection
        streams={data.streams}
        beginAction={beginAction}
        disabled={mutation.status === 'running'}
      />
      <CollectorsSection
        collectors={data.collectors}
        beginAction={beginAction}
        disabled={mutation.status === 'running'}
      />
      <AlertsSection alerts={data.alerts} />
      <ReconciliationSection
        items={data.reconciliation}
        beginAction={beginAction}
        disabled={mutation.status === 'running'}
      />
      <ValidationSection validation={data.validation} />
      <UsageSection usage={data.usage} />
      <JobsSection
        jobs={data.jobs}
        beginAction={beginAction}
        disabled={mutation.status === 'running'}
      />
      <section
        className="operations-section operations-recovery"
        aria-labelledby="operations-recovery-heading"
      >
        <p className="eyebrow">Private-network recovery</p>
        <h2 id="operations-recovery-heading">Collector recovery notes</h2>
        <p>
          The hosted control plane only records bounded health and schedules durable work. If the
          residential machine is offline, use the private-network operator runbook, Windows Task
          Scheduler recovery, or an always-on device on that network. This console does not contact
          the machine or expose machine secrets.
        </p>
      </section>
      <MutationDialog
        pending={pendingAction}
        reason={reason}
        setReason={setReason}
        formValues={formValues}
        setFormValues={setFormValues}
        onCancel={cancelAction}
        onConfirm={confirmAction}
        state={mutation}
      />
    </main>
  );
}
