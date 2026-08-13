import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import OperationsPage from './OperationsPage';
import { operationsApi } from './operationsApi';

jest.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ isAdmin: true }),
}));

jest.mock('./operationsApi', () => ({
  getOperationsErrorMessage: (error, fallback) => error?.message || fallback,
  operationsApi: {
    getDiagnostics: jest.fn(),
    scopedRepair: jest.fn(),
    rollbackStream: jest.fn(),
  },
}));

const payload = {
  cycles: [
    {
      cycleId: 'cycle-1',
      season: '2025-26',
      status: 'attention',
      cutoff: '2026-04-13T00:00:00.000Z',
      attentionReason: 'cycle_window_expired',
      manifestId: null,
      completedGameCount: null,
      completedAt: null,
      supersededAt: null,
    },
  ],
  streams: [
    {
      streamKey: 'traditional_opponent',
      provider: 'pbp',
      owner: 'railway',
      enabled: true,
      freshnessRule: 'cutoff_current',
      freshnessStatus: 'stale',
      activePublicationId: 'publication-1',
      fence: 2,
      lastPublishedAt: null,
      retrievedAt: null,
      cutoff: null,
      publicationVersion: null,
      checksum: null,
      schemaVersions: [],
      supportedWindows: [],
      completenessRule: null,
      publicationStrategy: null,
      unavailableReason: null,
    },
  ],
  collectors: [
    {
      identityId: 'collector-1',
      label: 'Residential Collector',
      environment: 'production',
      revoked: false,
      lastSeenAt: null,
      releaseVersion: null,
      owner: null,
      providers: [],
      surfaces: [],
      scopes: [],
      status: null,
    },
  ],
  alerts: [],
  reconciliation: [],
  validation: [],
  usage: [],
  jobs: [],
};

const renderPage = () =>
  render(
    <MemoryRouter>
      <OperationsPage />
    </MemoryRouter>,
  );

beforeEach(() => {
  operationsApi.getDiagnostics.mockResolvedValue(payload);
  operationsApi.scopedRepair.mockResolvedValue({ jobId: 'job-2' });
  operationsApi.rollbackStream.mockResolvedValue({ jobId: 'job-3' });
});

test('renders attention, stale-stream, and offline Collector states', async () => {
  renderPage();

  expect(await screen.findByRole('heading', { name: 'Publication streams' })).toBeInTheDocument();
  expect(screen.getByText('Attention Required: Cycle Window Expired.')).toBeInTheDocument();
  expect(screen.getByText('Stale')).toBeInTheDocument();
  expect(screen.getByText(/Offline: no last-seen heartbeat/)).toBeInTheDocument();
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
    target: { value: 'Repair the stale stream' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Confirm action' }));

  await waitFor(() =>
    expect(operationsApi.scopedRepair).toHaveBeenCalledWith(
      'traditional_opponent',
      '2025-26',
      '2026-04-13T00:00:00Z',
      'Repair the stale stream',
    ),
  );
  expect(await screen.findByText(/Durable job/)).toBeInTheDocument();
});

test('retains a useful error state when diagnostics cannot be loaded', async () => {
  operationsApi.getDiagnostics.mockRejectedValueOnce(new Error('Admin API unavailable'));
  renderPage();
  expect(
    await screen.findByRole('heading', { name: 'Diagnostics unavailable' }),
  ).toBeInTheDocument();
  expect(screen.getByRole('alert')).toHaveTextContent('Admin API unavailable');
});
