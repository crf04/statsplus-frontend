import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import OperationsPage from './OperationsPage';
import { operationsApi } from './operationsApi';

jest.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ isAdmin: true }) }));
jest.mock('./operationsApi', () => ({
  getOperationsErrorMessage: (error, fallback) => error?.message || fallback,
  operationsApi: {
    getDiagnostics: jest.fn(),
    scopedRepair: jest.fn(),
    rollbackStream: jest.fn(),
    activateStream: jest.fn(),
    retryComposition: jest.fn(),
    resolveReconciliation: jest.fn(),
    startCycle: jest.fn(),
    finishCycle: jest.fn(),
    rotateCollector: jest.fn(),
    revokeCollector: jest.fn(),
  },
}));

const emptyPayload = {
  cycles: [],
  streams: [],
  collectors: [],
  alerts: [],
  reconciliation: [],
  validation: [],
  usage: [],
  jobs: [],
};

const payload = {
  cycles: [
    {
      cycleId: 'cycle-attention',
      season: '2025-26',
      status: 'attention',
      cutoff: '2026-04-13T00:00:00.000Z',
    },
    {
      cycleId: 'cycle-complete',
      season: '2024-25',
      status: 'complete',
      cutoff: '2025-04-13T00:00:00.000Z',
    },
    {
      cycleId: 'cycle-superseded',
      season: '2023-24',
      status: 'superseded',
      cutoff: '2024-04-13T00:00:00.000Z',
    },
  ],
  streams: [
    {
      streamKey: 'traditional_opponent',
      provider: 'pbp',
      owner: 'railway',
      enabled: true,
      available: true,
      activationStatus: 'active',
      freshnessRule: 'cutoff_current',
      publicationId: 'publication-1',
      coverageCutoff: '2026-04-13T00:00:00.000Z',
      fence: 2,
      freshnessStatus: 'stale',
      ageSeconds: 7200,
    },
    {
      streamKey: 'unsupported_stream',
      provider: 'nba',
      owner: 'collector',
      enabled: false,
      available: false,
      activationStatus: 'unavailable',
      freshnessRule: 'unavailable',
      publicationId: null,
      coverageCutoff: null,
      fence: null,
      freshnessStatus: 'unavailable',
      ageSeconds: null,
    },
    {
      streamKey: 'missing_stream',
      provider: 'nba',
      owner: 'collector',
      enabled: false,
      available: true,
      activationStatus: 'inactive',
      freshnessRule: 'daily_recheck',
      publicationId: null,
      coverageCutoff: null,
      fence: null,
      freshnessStatus: 'missing',
      ageSeconds: null,
    },
    {
      streamKey: 'fresh_stream',
      provider: 'nba',
      owner: 'collector',
      enabled: true,
      available: true,
      activationStatus: 'active',
      freshnessRule: 'daily_recheck',
      publicationId: 'publication-fresh',
      coverageCutoff: '2026-04-13T00:00:00.000Z',
      fence: 1,
      freshnessStatus: 'fresh',
      ageSeconds: 30,
    },
  ],
  collectors: [
    {
      identityId: 'collector-offline',
      environment: 'production',
      revoked: false,
      lastSeenAt: null,
      releaseVersion: 'collector-1.2.3',
      releaseChecksum: 'a'.repeat(64),
    },
    {
      identityId: 'collector-new',
      environment: 'production',
      revoked: false,
      lastSeenAt: '2026-04-13T00:05:00.000Z',
      releaseVersion: 'collector-1.3.0',
      releaseChecksum: 'b'.repeat(64),
    },
  ],
  alerts: [{ alertId: 'alert-1', severity: 'critical', code: 'cycle_attention', status: 'open' }],
  reconciliation: [
    {
      itemId: 'item-1',
      season: '2025-26',
      kind: 'identity',
      reason: 'identity_unresolved',
      status: 'open',
    },
  ],
  validation: [{ summaryId: 'summary-1', cycleId: 'cycle-attention', status: 'failed' }],
  usage: [
    {
      collectorId: 'collector-offline',
      pollCount: 85,
      envelopeCount: 7,
      byteCount: 4096,
      concurrencyCount: 1,
      limits: { pollCount: 100, envelopeCount: 1000, byteCount: 52428800, concurrencyCount: 1 },
      windowStartedAt: '2026-04-13T00:00:00.000Z',
      windowResetsAt: '2026-04-14T00:00:00.000Z',
      retryAfterSeconds: 3600,
      concurrencyRetryAfterSeconds: 30,
    },
  ],
  jobs: ['queued', 'running', 'succeeded', 'failed'].map((status) => ({
    jobId: `job-${status}`,
    action: 'composition.retry',
    resource: `composition-${status}`,
    status,
    createdAt: '2026-04-13T00:00:00.000Z',
    completedAt: status === 'queued' || status === 'running' ? null : '2026-04-13T00:01:00.000Z',
    errorCode: status === 'failed' ? 'provider_unavailable' : null,
  })),
};

const renderPage = () =>
  render(
    <MemoryRouter>
      <OperationsPage />
    </MemoryRouter>,
  );

beforeEach(() => {
  jest.clearAllMocks();
  operationsApi.getDiagnostics.mockResolvedValue(payload);
  Object.values(operationsApi).forEach((operation) => {
    if (operation !== operationsApi.getDiagnostics)
      operation.mockResolvedValue({ jobId: 'job-new' });
  });
});

test('renders empty states for every bounded diagnostic collection', async () => {
  operationsApi.getDiagnostics.mockResolvedValue(emptyPayload);
  renderPage();
  expect(await screen.findByText('No collection cycles have been recorded.')).toBeInTheDocument();
  expect(screen.getByText('No publication streams are registered.')).toBeInTheDocument();
  expect(screen.getByText('No Collector identities are registered.')).toBeInTheDocument();
  expect(screen.getByText('No open or historical alerts are recorded.')).toBeInTheDocument();
  expect(screen.getByText('No reconciliation items are recorded.')).toBeInTheDocument();
  expect(screen.getByText('No validation summaries are recorded.')).toBeInTheDocument();
  expect(screen.getByText('No usage windows are recorded.')).toBeInTheDocument();
  expect(screen.getByText('No durable operator jobs are recorded.')).toBeInTheDocument();
});

test('renders healthy, degraded, attention, superseded, and durable job states', async () => {
  renderPage();
  expect(
    await screen.findByText('Attention Required: this cycle requires operator review.'),
  ).toBeInTheDocument();
  expect(screen.getByText(/superseded; it remains visible for audit/i)).toBeInTheDocument();
  expect(screen.getAllByText('Complete').length).toBeGreaterThan(0);
  expect(screen.getByText('Cycle Attention')).toBeInTheDocument();
  expect(screen.getByText(/Identity Unresolved/)).toBeInTheDocument();
  expect(screen.getByText('Counts and check time are not reported.')).toBeInTheDocument();
  for (const state of ['Queued', 'Running', 'Succeeded', 'Failed']) {
    expect(screen.getAllByText(state).length).toBeGreaterThan(0);
  }
});

test('shows stale, unsupported, release, usage threshold, and retry evidence', async () => {
  renderPage();
  await screen.findByRole('heading', { name: 'Publication streams' });
  expect(screen.getByText('Stale')).toBeInTheDocument();
  expect(screen.getByText('Fresh')).toBeInTheDocument();
  expect(screen.getByText('Missing')).toBeInTheDocument();
  expect(screen.getByText('No active publication has been recorded.')).toBeInTheDocument();
  expect(
    screen.getByText('Unsupported provider window; this stream cannot be activated.'),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'Activate unsupported_stream' }),
  ).not.toBeInTheDocument();
  expect(screen.getByText(/Offline: no last-seen heartbeat/)).toBeInTheDocument();
  expect(screen.getByText('collector-1.2.3')).toBeInTheDocument();
  expect(screen.getByText(/Usage threshold/)).toBeInTheDocument();
  expect(screen.getByText(/Counter retry in 1h/)).toBeInTheDocument();
  expect(screen.getByText(/Concurrency retry in 30s/)).toBeInTheDocument();
  expect(screen.getByText(/Version mismatch/)).toBeInTheDocument();
});

test('requires a reason and confirmation before scheduling scoped repair', async () => {
  renderPage();
  await screen.findByRole('heading', { name: 'Publication streams' });
  fireEvent.click(screen.getByRole('button', { name: 'Repair traditional_opponent' }));
  expect(screen.getByRole('button', { name: 'Confirm action' })).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Season'), { target: { value: '2025-26' } });
  fireEvent.change(screen.getByLabelText('Cutoff (ISO timestamp)'), {
    target: { value: '2026-04-13T00:00:00Z' },
  });
  fireEvent.change(screen.getByLabelText('Reason (required)'), {
    target: { value: 'Repair the governed stream' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Confirm action' }));
  await waitFor(() =>
    expect(operationsApi.scopedRepair).toHaveBeenCalledWith(
      'traditional_opponent',
      '2025-26',
      '2026-04-13T00:00:00Z',
      'Repair the governed stream',
    ),
  );
  expect(await screen.findByText(/Durable job/)).toBeInTheDocument();
});

test('prevents duplicate submission while a durable action is pending', async () => {
  let resolveMutation;
  operationsApi.rollbackStream.mockImplementation(
    () => new Promise((resolve) => (resolveMutation = resolve)),
  );
  renderPage();
  await screen.findByRole('heading', { name: 'Publication streams' });
  fireEvent.click(screen.getByRole('button', { name: 'Rollback traditional_opponent' }));
  fireEvent.change(screen.getByLabelText('Reason (required)'), {
    target: { value: 'Use the prior governed publication' },
  });
  const confirm = screen.getByRole('button', { name: 'Confirm action' });
  fireEvent.click(confirm);
  expect(await screen.findByRole('button', { name: /Submitting/ })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: /Submitting/ }));
  expect(operationsApi.rollbackStream).toHaveBeenCalledTimes(1);
  resolveMutation({ jobId: 'job-new' });
  expect(await screen.findByText(/Durable job/)).toBeInTheDocument();
});

test('keeps an accessible action error open and permits retry', async () => {
  operationsApi.retryComposition
    .mockRejectedValueOnce(new Error('Provider unavailable'))
    .mockResolvedValueOnce({ jobId: 'job-retry' });
  renderPage();
  await screen.findByRole('heading', { name: 'Operator jobs' });
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  fireEvent.change(screen.getByLabelText('Reason (required)'), {
    target: { value: 'Retry after provider recovery' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Confirm action' }));
  expect(await screen.findByText('Provider unavailable')).toHaveAttribute('role', 'alert');
  fireEvent.click(screen.getByRole('button', { name: 'Confirm action' }));
  expect(await screen.findByText(/job-retry/)).toBeInTheDocument();
  expect(operationsApi.retryComposition).toHaveBeenCalledTimes(2);
});

test('retains a useful error state when diagnostics cannot be loaded', async () => {
  operationsApi.getDiagnostics.mockRejectedValueOnce(new Error('Admin API unavailable'));
  renderPage();
  expect(
    await screen.findByRole('heading', { name: 'Diagnostics unavailable' }),
  ).toBeInTheDocument();
  expect(screen.getByRole('alert')).toHaveTextContent('Admin API unavailable');
});
