import { render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SlatePage from './SlatePage';
import { fetchSlate } from './slateApi';

jest.mock('./slateApi', () => ({ fetchSlate: jest.fn() }));
jest.mock('./contexts/AuthContext', () => ({
  useAuth: () => ({ isAuthenticated: true, loading: false }),
}));

const game = {
  gameId: '0022500584',
  away: {
    teamId: 1610612747,
    tricode: 'LAL',
    name: 'Los Angeles Lakers',
    targetablePlayerCount: 5,
  },
  home: {
    teamId: 1610612738,
    tricode: 'BOS',
    name: 'Boston Celtics',
    targetablePlayerCount: 4,
  },
  scheduledAt: '2026-01-16T00:30:00.000Z',
  status: 'scheduled',
  statusLabel: 'Scheduled',
  classification: null,
  preseason: false,
};

const slate = {
  slateDate: '2026-01-15',
  poolStatus: 'stale-served',
  freshness: {
    schedule: { status: 'fresh', retrievedAt: '2026-01-15T11:50:00.000Z' },
    pool: {
      status: 'stale-served',
      retrievedAt: '2026-01-15T11:30:00.000Z',
      providers: [
        { name: 'prizepicks', status: 'fresh', retrievedAt: '2026-01-15T11:40:00.000Z' },
        { name: 'underdog', status: 'missing', retrievedAt: null },
      ],
    },
  },
  games: [game],
};

beforeEach(() => {
  jest.useFakeTimers().setSystemTime(new Date('2026-01-15T12:00:00Z'));
  fetchSlate.mockResolvedValue(slate);
});

afterEach(() => {
  jest.useRealTimers();
  jest.clearAllMocks();
});

test('shows an age for every available freshness surface and names degraded surfaces', async () => {
  render(
    <MemoryRouter initialEntries={['/matchups?date=2026-01-15']}>
      <SlatePage />
    </MemoryRouter>,
  );

  expect(await screen.findByText('Schedule is fresh — as of 10m ago')).toBeVisible();
  expect(screen.getByText('Player pool is stale-served — as of 30m ago')).toHaveAttribute(
    'role',
    'alert',
  );
  expect(screen.getByText('prizepicks pool is fresh — as of 20m ago')).toBeVisible();
  expect(screen.getByText('underdog pool is missing')).toHaveAttribute('role', 'alert');
  expect(screen.getByText(/targetable counts use the latest available snapshot/i)).toBeVisible();
});

test.each([
  ['fresh', 'current player pool is not displayed', 'posted targetable counts'],
  ['stale-served', 'latest available snapshot is not displayed', 'posted targetable counts'],
  ['unavailable', 'player pool is unavailable', 'returned targetable counts'],
])(
  'renders an honest historical empty pool section when the pool is %s',
  async (poolStatus, statusText, countsText) => {
    fetchSlate.mockResolvedValue({
      ...slate,
      slateDate: '2026-01-10',
      poolStatus,
      freshness: {
        ...slate.freshness,
        pool: { ...slate.freshness.pool, status: poolStatus },
      },
      games: [{ ...game, status: 'final', statusLabel: 'Final' }],
    });

    render(
      <MemoryRouter initialEntries={['/matchups?date=2026-01-10']}>
        <SlatePage />
      </MemoryRouter>,
    );

    const heading = await screen.findByRole('heading', { name: 'Player pool' });
    const poolSection = heading.closest('section');
    expect(within(poolSection).getByText(new RegExp(statusText, 'i'))).toBeVisible();
    expect(within(poolSection).getByText(new RegExp(countsText, 'i'))).toBeVisible();
  },
);

test('forwards an impossible calendar date so the backend can return invalid_input', async () => {
  fetchSlate.mockRejectedValue({
    response: { data: { error: { code: 'invalid_input', message: 'Enter a valid date.' } } },
  });

  render(
    <MemoryRouter initialEntries={['/matchups?date=2026-02-30']}>
      <SlatePage />
    </MemoryRouter>,
  );

  expect(await screen.findByRole('alert')).toHaveTextContent('Enter a valid date.');
  expect(screen.getByRole('heading', { name: 'Invalid slate date' })).toBeVisible();
  expect(screen.getByText(/requested date.*2026-02-30.*invalid/i)).toBeVisible();
  expect(screen.getByRole('button', { name: 'Previous date' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Next date' })).toBeDisabled();
  expect(screen.getByLabelText('Slate date')).toHaveValue('');
  await waitFor(() => expect(fetchSlate).toHaveBeenCalledWith('2026-02-30', expect.any(Object)));
});

test('uses the server slate date for the heading and historical pool state', async () => {
  fetchSlate.mockResolvedValue({ ...slate, slateDate: '2026-01-14', poolStatus: 'fresh' });

  render(
    <MemoryRouter initialEntries={['/matchups']}>
      <SlatePage />
    </MemoryRouter>,
  );

  expect(await screen.findByRole('heading', { name: 'Wednesday, January 14' })).toBeVisible();
  expect(screen.getByText(/current player pool is not displayed/i)).toBeVisible();
});
