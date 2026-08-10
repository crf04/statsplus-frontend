import { act } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
  expect(screen.getByRole('group', { name: 'Data freshness' })).toBeVisible();
  expect(screen.getByText('Player pool is stale-served — as of 30m ago')).toBeVisible();
  expect(screen.getByText(/prizepicks pool is stale.*older than 15m freshness bar/i)).toHaveClass(
    'freshness-warning',
  );
  expect(screen.getByText('underdog pool is missing')).toBeVisible();
  expect(screen.queryAllByRole('alert')).toHaveLength(0);
  expect(screen.getByText(/targetable counts use the latest available snapshot/i)).toBeVisible();
});

test('updates freshness ages each minute and cleans up its clock', async () => {
  const { unmount } = render(
    <MemoryRouter initialEntries={['/matchups?date=2026-01-15']}>
      <SlatePage />
    </MemoryRouter>,
  );

  expect(await screen.findByText('Schedule is fresh — as of 10m ago')).toBeVisible();
  expect(jest.getTimerCount()).toBe(1);
  act(() => jest.advanceTimersByTime(60000));
  expect(screen.getByText('Schedule is fresh — as of 11m ago')).toBeVisible();

  unmount();
  expect(jest.getTimerCount()).toBe(0);
});

test('warns when a fresh schedule crosses the 30h bar without refetching', async () => {
  fetchSlate.mockResolvedValue({
    ...slate,
    freshness: {
      ...slate.freshness,
      schedule: { status: 'fresh', retrievedAt: '2026-01-14T06:01:00.000Z' },
    },
  });
  render(
    <MemoryRouter initialEntries={['/matchups?date=2026-01-15']}>
      <SlatePage />
    </MemoryRouter>,
  );

  const fresh = await screen.findByText(/schedule is fresh/i);
  expect(fresh).not.toHaveClass('freshness-warning');
  act(() => jest.advanceTimersByTime(120000));
  expect(screen.getByText(/schedule is stale/i)).toHaveClass('freshness-warning');
  expect(fetchSlate).toHaveBeenCalledTimes(1);
});

test('labels a fresh pool snapshot stale when it crosses the 15m bar', async () => {
  fetchSlate.mockResolvedValue({
    ...slate,
    poolStatus: 'fresh',
    freshness: {
      ...slate.freshness,
      pool: {
        status: 'fresh',
        retrievedAt: '2026-01-15T11:46:00.000Z',
        providers: [],
      },
    },
  });
  render(
    <MemoryRouter initialEntries={['/matchups?date=2026-01-15']}>
      <SlatePage />
    </MemoryRouter>,
  );

  const fresh = await screen.findByText('Player pool is fresh — as of 14m ago');
  expect(fresh).not.toHaveClass('freshness-warning');
  expect(screen.getByText('Targetable counts use the current player pool.')).toBeVisible();
  act(() => jest.advanceTimersByTime(120000));
  expect(screen.getByText(/player pool is stale.*older than 15m freshness bar/i)).toHaveClass(
    'freshness-warning',
  );
  expect(screen.getByText(/player pool snapshot is stale/i)).toBeVisible();
  expect(screen.queryByText(/use the current player pool/i)).not.toBeInTheDocument();
  expect(fetchSlate).toHaveBeenCalledTimes(1);
});

test('clearing the date requests today without entering an invalid state', async () => {
  render(
    <MemoryRouter initialEntries={['/matchups?date=2026-01-14']}>
      <SlatePage />
    </MemoryRouter>,
  );
  await screen.findByRole('heading', { name: 'Thursday, January 15, 2026' });
  fetchSlate.mockClear();

  fireEvent.change(screen.getByLabelText('Slate date'), { target: { value: '' } });

  await waitFor(() => expect(fetchSlate).toHaveBeenCalledWith(undefined, expect.any(Object)));
  expect(screen.queryByRole('heading', { name: 'Invalid slate date' })).not.toBeInTheDocument();
  expect(screen.getByLabelText('Slate date')).toHaveValue('2026-01-15');
});

test('offers Today as a recovery from an invalid requested date', async () => {
  fetchSlate.mockRejectedValueOnce({
    response: { data: { error: { code: 'invalid_input', message: 'Enter a valid date.' } } },
  });
  render(
    <MemoryRouter initialEntries={['/matchups?date=2026-02-30']}>
      <SlatePage />
    </MemoryRouter>,
  );
  await screen.findByRole('heading', { name: 'Invalid slate date' });
  await screen.findByRole('alert');
  fetchSlate.mockClear();
  fetchSlate.mockResolvedValue(slate);

  fireEvent.click(screen.getByRole('button', { name: 'Today' }));

  await waitFor(() => expect(fetchSlate).toHaveBeenCalledWith(undefined, expect.any(Object)));
  expect(screen.queryByRole('heading', { name: 'Invalid slate date' })).not.toBeInTheDocument();
});

test('explains mixed provider counts without claiming the whole pool is missing', async () => {
  fetchSlate.mockResolvedValue({
    ...slate,
    poolStatus: 'partial',
    freshness: {
      ...slate.freshness,
      pool: {
        status: 'partial',
        retrievedAt: '2026-01-15T11:40:00.000Z',
        providers: [
          { name: 'prizepicks', status: 'fresh', retrievedAt: '2026-01-15T11:40:00.000Z' },
          { name: 'underdog', status: 'missing', retrievedAt: null },
        ],
      },
    },
  });

  render(
    <MemoryRouter initialEntries={['/matchups?date=2026-01-15']}>
      <SlatePage />
    </MemoryRouter>,
  );

  expect(await screen.findByText(/counts reflect the available boards/i)).toBeVisible();
  expect(screen.getByText('5 targetable')).toBeVisible();
  expect(screen.getByText('4 targetable')).toBeVisible();
  expect(screen.queryByText(/no targetable players/i)).not.toBeInTheDocument();
});

test.each([
  ['missing', /player pool is missing/i],
  ['unavailable', /player pool is unavailable/i],
])('renders distinct %s pool copy', async (poolStatus, expected) => {
  fetchSlate.mockResolvedValue({
    ...slate,
    poolStatus,
    freshness: {
      ...slate.freshness,
      pool: { status: poolStatus, retrievedAt: null, providers: [] },
    },
  });

  render(
    <MemoryRouter initialEntries={['/matchups?date=2026-01-15']}>
      <SlatePage />
    </MemoryRouter>,
  );

  const heading = await screen.findByRole('heading', { name: 'Player pool' });
  expect(within(heading.closest('section')).getByText(expected)).toBeVisible();
});

test.each([
  ['scheduled', null, 'Scheduled'],
  ['postponed', null, 'Postponed'],
  ['final', null, 'Final'],
  ['final', 'Final/OT', 'Final/OT'],
])('shows %s catalog label %s with a cased fallback', async (status, statusLabel, expected) => {
  fetchSlate.mockResolvedValue({
    ...slate,
    games: [{ ...game, status, statusLabel }],
  });

  render(
    <MemoryRouter initialEntries={['/matchups?date=2026-01-15']}>
      <SlatePage />
    </MemoryRouter>,
  );

  expect((await screen.findAllByText(expected))[0]).toBeVisible();
});

test('shows preseason and unusual classification badges', async () => {
  fetchSlate.mockResolvedValue({
    ...slate,
    games: [{ ...game, classification: 'International Series', preseason: true }],
  });
  render(
    <MemoryRouter initialEntries={['/matchups?date=2026-01-15']}>
      <SlatePage />
    </MemoryRouter>,
  );

  expect(await screen.findByText('International Series')).toBeVisible();
  expect(screen.getByText('Preseason')).toBeVisible();
});

test('does not invent a classification badge for an ordinary game', async () => {
  fetchSlate.mockResolvedValue({
    ...slate,
    games: [{ ...game, classification: null, preseason: false }],
  });
  render(
    <MemoryRouter initialEntries={['/matchups?date=2026-01-15']}>
      <SlatePage />
    </MemoryRouter>,
  );

  await screen.findByRole('heading', { name: 'LAL @ BOS' });
  expect(screen.queryByText('International Series')).not.toBeInTheDocument();
  expect(screen.queryByText('Preseason')).not.toBeInTheDocument();
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
        pool: {
          ...slate.freshness.pool,
          status: poolStatus,
          retrievedAt:
            poolStatus === 'fresh' ? '2026-01-15T11:50:00.000Z' : slate.freshness.pool.retrievedAt,
        },
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
  fetchSlate.mockResolvedValue({
    ...slate,
    slateDate: '2026-01-14',
    poolStatus: 'fresh',
    freshness: {
      ...slate.freshness,
      pool: {
        ...slate.freshness.pool,
        status: 'fresh',
        retrievedAt: '2026-01-15T11:50:00.000Z',
      },
    },
  });

  render(
    <MemoryRouter initialEntries={['/matchups']}>
      <SlatePage />
    </MemoryRouter>,
  );

  expect(await screen.findByRole('heading', { name: 'Wednesday, January 14, 2026' })).toBeVisible();
  expect(screen.getByText(/current player pool is not displayed/i)).toBeVisible();
});
