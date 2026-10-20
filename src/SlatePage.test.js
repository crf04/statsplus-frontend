import { act } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import SlatePage from './SlatePage';
import { getTodaySlateDate } from './calendarDate';
import { fetchSlate } from './slateApi';
import { partialPoolSlatePayload } from './slatePartialPoolFixture';
import { fetchResolvedTargets } from './targets/targetsApi';

jest.mock('./slateApi', () => ({ fetchSlate: jest.fn() }));
jest.mock('./targets/targetsApi', () => ({ fetchResolvedTargets: jest.fn() }));
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

const Url = () => {
  const { pathname, search } = useLocation();
  return <output aria-label="Current URL">{pathname + search}</output>;
};

beforeEach(() => {
  jest.useFakeTimers().setSystemTime(new Date('2026-01-15T12:00:00Z'));
  fetchSlate.mockResolvedValue(slate);
  fetchResolvedTargets.mockResolvedValue({ slateDate: '2026-01-15', entries: [] });
});

afterEach(() => {
  jest.useRealTimers();
  jest.clearAllMocks();
});

test('opens on today in New York by default and can return to it', async () => {
  // 02:00 UTC on Sep 12 is still Sep 11 in New York.
  jest.setSystemTime(new Date('2026-09-12T02:00:00Z'));
  fetchSlate.mockImplementation(async (date) => ({ ...slate, slateDate: date ?? '2026-09-11' }));
  render(
    <MemoryRouter initialEntries={['/matchups']}>
      <SlatePage />
      <Url />
    </MemoryRouter>,
  );

  expect(screen.getByLabelText('Slate date')).toHaveValue('2026-09-11');
  await screen.findByRole('heading', { name: 'Friday, September 11, 2026' });
  // No date is named, so the backend decides the day; today having games, the
  // URL stays as it was.
  expect(fetchSlate).toHaveBeenCalledWith(undefined, {
    signal: expect.any(AbortSignal),
    fallback: 'next_game_day',
  });
  expect(screen.getByLabelText('Current URL')).toHaveTextContent('/matchups');
  expect(screen.getByLabelText('Current URL')).not.toHaveTextContent('date=');

  fireEvent.change(screen.getByLabelText('Slate date'), { target: { value: '2026-03-11' } });
  await screen.findByRole('heading', { name: 'Wednesday, March 11, 2026' });
  fireEvent.click(screen.getByRole('button', { name: 'Today' }));
  await screen.findByRole('heading', { name: 'Friday, September 11, 2026' });
  expect(fetchSlate).toHaveBeenLastCalledWith('2026-09-11', expect.any(Object));
});

test('with no date and no games today it opens the next game day and puts its date in the URL', async () => {
  fetchSlate.mockImplementation(async (date) => ({
    ...slate,
    slateDate: '2026-10-20',
    fallback: date === undefined ? 'next_game_day' : null,
  }));
  fetchResolvedTargets.mockResolvedValue({ slateDate: '2026-10-20', entries: [] });
  render(
    <MemoryRouter initialEntries={['/matchups']}>
      <SlatePage />
      <Url />
    </MemoryRouter>,
  );

  await screen.findByRole('heading', { name: 'Tuesday, October 20, 2026' });
  expect(screen.getByLabelText('Current URL')).toHaveTextContent('/matchups?date=2026-10-20');
  expect(screen.getByLabelText('Slate date')).toHaveValue('2026-10-20');
  expect(screen.queryByText('No games on this slate.')).not.toBeInTheDocument();
  expect(screen.getByText('1 game')).toBeInTheDocument();
  // One Slate read, and Targets read for the resolved day only.
  await waitFor(() => expect(fetchResolvedTargets).toHaveBeenCalledTimes(1));
  expect(fetchSlate).toHaveBeenCalledTimes(1);
  expect(fetchResolvedTargets).toHaveBeenCalledWith({
    date: '2026-10-20',
    signal: expect.any(AbortSignal),
  });
});

test('with no date and no next game day it opens the previous one and puts its date in the URL', async () => {
  fetchSlate.mockImplementation(async (date) => ({
    ...slate,
    slateDate: '2026-04-12',
    fallback: date === undefined ? 'previous_game_day' : null,
  }));
  fetchResolvedTargets.mockResolvedValue({ slateDate: '2026-04-12', entries: [] });
  render(
    <MemoryRouter initialEntries={['/matchups']}>
      <SlatePage />
      <Url />
    </MemoryRouter>,
  );

  await screen.findByRole('heading', { name: 'Sunday, April 12, 2026' });
  expect(screen.getByLabelText('Current URL')).toHaveTextContent('/matchups?date=2026-04-12');
  expect(screen.getByLabelText('Slate date')).toHaveValue('2026-04-12');
  await waitFor(() => expect(fetchResolvedTargets).toHaveBeenCalledTimes(1));
  expect(fetchResolvedTargets).toHaveBeenCalledWith({
    date: '2026-04-12',
    signal: expect.any(AbortSignal),
  });
  expect(fetchSlate).toHaveBeenCalledTimes(1);
});

test('an undated page left open past midnight in New York reads the new day', async () => {
  // 03:30 UTC on Sep 12 is 23:30 on Sep 11 in New York.
  jest.setSystemTime(new Date('2026-09-12T03:30:00Z'));
  fetchSlate.mockImplementation(async () => ({
    ...slate,
    slateDate: getTodaySlateDate(),
    fallback: null,
  }));
  render(
    <MemoryRouter initialEntries={['/matchups']}>
      <SlatePage />
      <Url />
    </MemoryRouter>,
  );
  await screen.findByRole('heading', { name: 'Friday, September 11, 2026' });
  expect(fetchSlate).toHaveBeenCalledTimes(1);

  // The minute clock ticks across 00:00 in New York.
  await act(async () => {
    jest.advanceTimersByTime(60 * 60 * 1000);
  });

  await screen.findByRole('heading', { name: 'Saturday, September 12, 2026' });
  expect(fetchSlate).toHaveBeenCalledTimes(2);
  expect(screen.getByLabelText('Current URL')).not.toHaveTextContent('date=');
});

test('an explicit date is read as named, with no fallback', async () => {
  render(
    <MemoryRouter initialEntries={['/matchups?date=2026-01-15']}>
      <SlatePage />
      <Url />
    </MemoryRouter>,
  );

  await screen.findByRole('heading', { name: 'Thursday, January 15, 2026' });
  expect(fetchSlate).toHaveBeenCalledTimes(1);
  expect(fetchSlate).toHaveBeenCalledWith('2026-01-15', { signal: expect.any(AbortSignal) });
  expect(screen.getByLabelText('Current URL')).toHaveTextContent('/matchups?date=2026-01-15');
});

test('an empty slate offers its previous and next game days and jumps to them', async () => {
  fetchSlate.mockImplementation(async (date) =>
    date === '2026-07-15'
      ? {
          ...slate,
          slateDate: date,
          games: [],
          previousGameDate: '2026-06-14',
          nextGameDate: '2026-10-21',
        }
      : { ...slate, slateDate: date },
  );
  render(
    <MemoryRouter initialEntries={['/matchups?date=2026-07-15']}>
      <SlatePage />
    </MemoryRouter>,
  );

  expect(
    await screen.findByRole('button', { name: 'Next game day Wednesday, October 21, 2026' }),
  ).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Previous game day Sunday, June 14, 2026' }));
  await screen.findByRole('heading', { name: 'Sunday, June 14, 2026' });
  expect(fetchSlate).toHaveBeenLastCalledWith('2026-06-14', expect.any(Object));
  expect(screen.queryByRole('button', { name: /game day/ })).toBeNull();
});

test('the next game day button opens that date', async () => {
  fetchSlate.mockImplementation(async (date) =>
    date === '2026-07-15'
      ? { ...slate, slateDate: date, games: [], previousGameDate: null, nextGameDate: '2026-10-21' }
      : { ...slate, slateDate: date },
  );
  render(
    <MemoryRouter initialEntries={['/matchups?date=2026-07-15']}>
      <SlatePage />
    </MemoryRouter>,
  );

  fireEvent.click(
    await screen.findByRole('button', { name: 'Next game day Wednesday, October 21, 2026' }),
  );
  await screen.findByRole('heading', { name: 'Wednesday, October 21, 2026' });
  expect(screen.getByLabelText('Slate date')).toHaveValue('2026-10-21');
  expect(fetchSlate).toHaveBeenLastCalledWith('2026-10-21', expect.any(Object));
});

test('an empty slate with no neighbours, or from an older backend, offers no jump', async () => {
  fetchSlate.mockResolvedValue({
    ...slate,
    games: [],
    previousGameDate: null,
    nextGameDate: '2026-10-21',
  });
  const { unmount } = render(
    <MemoryRouter initialEntries={['/matchups?date=2026-07-15']}>
      <SlatePage />
    </MemoryRouter>,
  );
  await screen.findByText('No games on this slate.');
  expect(screen.queryByRole('button', { name: /Previous game day/ })).toBeNull();
  expect(screen.getByRole('button', { name: /Next game day/ })).toBeVisible();
  unmount();

  fetchSlate.mockResolvedValue({ ...slate, games: [] });
  render(
    <MemoryRouter initialEntries={['/matchups?date=2026-07-15']}>
      <SlatePage />
    </MemoryRouter>,
  );
  await screen.findByText('No games on this slate.');
  expect(screen.queryByRole('button', { name: /game day/ })).toBeNull();
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
  // Polled hourly, a prizepicks entry the backend serves as fresh is not stale at 20 minutes.
  expect(screen.getByText('prizepicks pool is fresh — as of 20m ago')).not.toHaveClass(
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

test('holds a prizepicks entry to a 90m bar and every other provider to 15m', async () => {
  fetchSlate.mockResolvedValue({
    ...slate,
    freshness: {
      ...slate.freshness,
      pool: {
        status: 'fresh',
        retrievedAt: '2026-01-15T11:50:00.000Z',
        providers: [
          { name: 'prizepicks', status: 'fresh', retrievedAt: '2026-01-15T10:45:00.000Z' },
          { name: 'underdog', status: 'fresh', retrievedAt: '2026-01-15T11:50:00.000Z' },
        ],
      },
    },
  });
  render(
    <MemoryRouter initialEntries={['/matchups?date=2026-01-15']}>
      <SlatePage />
    </MemoryRouter>,
  );

  // Noon: prizepicks is 75m old, underdog 10m.
  const prizepicks = await screen.findByText('prizepicks pool is fresh — as of 1h ago');
  expect(prizepicks).not.toHaveClass('freshness-warning');
  expect(screen.getByText('underdog pool is fresh — as of 10m ago')).not.toHaveClass(
    'freshness-warning',
  );
  // 12:06: underdog is 16m old and past its bar; prizepicks is 81m and is not.
  act(() => jest.advanceTimersByTime(6 * 60000));
  expect(
    screen.getByText('underdog pool is stale — as of 16m ago (older than 15m freshness bar)'),
  ).toHaveClass('freshness-warning');
  expect(screen.getByText('prizepicks pool is fresh — as of 1h ago')).not.toHaveClass(
    'freshness-warning',
  );
  // 12:16: prizepicks is 91m old.
  act(() => jest.advanceTimersByTime(10 * 60000));
  expect(
    screen.getByText('prizepicks pool is stale — as of 2h ago (older than 90m freshness bar)'),
  ).toHaveClass('freshness-warning');
  expect(fetchSlate).toHaveBeenCalledTimes(1);
});

test('holds a pool that only prizepicks has read to its 90m bar', async () => {
  fetchSlate.mockResolvedValue({
    ...slate,
    freshness: {
      ...slate.freshness,
      pool: {
        status: 'fresh',
        retrievedAt: '2026-01-15T10:45:00.000Z',
        providers: [
          { name: 'prizepicks', status: 'fresh', retrievedAt: '2026-01-15T10:45:00.000Z' },
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

  // Noon: the pool is 75m old, past the 15m bar but inside prizepicks's 90m.
  const pool = await screen.findByText('Player pool is fresh — as of 1h ago');
  expect(pool).not.toHaveClass('freshness-warning');
  expect(screen.getByText('Targetable counts use the current player pool.')).toBeVisible();
  // 12:16: 91m old.
  act(() => jest.advanceTimersByTime(16 * 60000));
  expect(
    screen.getByText('Player pool is stale — as of 2h ago (older than 90m freshness bar)'),
  ).toHaveClass('freshness-warning');
  expect(screen.getByText(/player pool snapshot is stale/i)).toBeVisible();
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

  await waitFor(() => expect(fetchSlate).toHaveBeenCalledWith('2026-01-15', expect.any(Object)));
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

  await waitFor(() => expect(fetchSlate).toHaveBeenCalledWith('2026-01-15', expect.any(Object)));
  expect(screen.queryByRole('heading', { name: 'Invalid slate date' })).not.toBeInTheDocument();
});

test('explains mixed provider counts without claiming the whole pool is missing', async () => {
  fetchSlate.mockResolvedValue({
    ...slate,
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
  expect(screen.getByRole('link', { name: /9 targetable players, LAL 5, BOS 4/ })).toBeVisible();
  expect(screen.getByText('9')).toBeVisible();
  expect(document.querySelectorAll('.slate-pip')).toHaveLength(9);
  expect(screen.queryByText(/no targetable players/i)).not.toBeInTheDocument();
});

test('shows every game of a partial pool, the one without a pool at zero', async () => {
  jest.setSystemTime(new Date('2026-10-20T20:50:00Z'));
  const { decodeSlate } = jest.requireActual('./slateApi');
  fetchSlate.mockResolvedValue(decodeSlate(partialPoolSlatePayload));

  render(
    <MemoryRouter initialEntries={['/matchups?date=2026-10-20']}>
      <SlatePage />
    </MemoryRouter>,
  );

  expect(await screen.findByText(/counts reflect the available boards/i)).toBeVisible();
  expect(
    screen.getByRole('link', { name: /^BOS @ DET, .*0 targetable players, BOS 0, DET 0/ }),
  ).toBeVisible();
  expect(
    screen.getByRole('link', { name: /^PHI @ NYK, .*15 targetable players, PHI 7, NYK 8/ }),
  ).toBeVisible();
  expect(
    screen.getByRole('link', { name: /^OKC @ SAS, .*18 targetable players, OKC 9, SAS 9/ }),
  ).toBeVisible();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

test('groups the slate into tip-time windows in schedule order', async () => {
  const later = {
    ...game,
    gameId: '0022500585',
    away: { ...game.away, tricode: 'NYK', name: 'New York Knicks' },
    home: { ...game.home, tricode: 'MIL', name: 'Milwaukee Bucks' },
    scheduledAt: '2026-01-16T03:00:00.000Z',
  };
  fetchSlate.mockResolvedValue({ ...slate, games: [later, game] });

  render(
    <MemoryRouter initialEntries={['/matchups?date=2026-01-15']}>
      <SlatePage />
    </MemoryRouter>,
  );

  await screen.findByRole('heading', { name: 'LAL @ BOS' });
  const headings = screen.getAllByRole('heading').map((node) => node.textContent);
  const earlyTip = headings.indexOf('LAL @ BOS');
  const lateTip = headings.indexOf('NYK @ MIL');
  expect(earlyTip).toBeGreaterThan(-1);
  expect(lateTip).toBeGreaterThan(earlyTip);
});

test('states depth as a figure, not a bar against an invented denominator', async () => {
  const deeper = {
    ...game,
    gameId: '0022500585',
    away: { ...game.away, tricode: 'NYK', targetablePlayerCount: 8 },
    home: { ...game.home, tricode: 'MIL', targetablePlayerCount: 7 },
  };
  fetchSlate.mockResolvedValue({ ...slate, games: [game, deeper] });

  render(
    <MemoryRouter initialEntries={['/matchups?date=2026-01-15']}>
      <SlatePage />
    </MemoryRouter>,
  );

  const shallow = await screen.findByRole('link', { name: /9 targetable players/ });
  const busiest = screen.getByRole('link', { name: /15 targetable players/ });
  expect(within(shallow).getByText('9')).toBeVisible();
  expect(within(busiest).getByText('15')).toBeVisible();

  // One mark per player, grouped away then home — a unit chart, so no mark
  // stands for a fraction of a capacity that does not exist.
  const marks = (row) =>
    [...row.querySelectorAll('.slate-pip-group')].map((g) => g.childElementCount);
  expect(marks(shallow)).toEqual([5, 4]);
  expect(marks(busiest)).toEqual([8, 7]);
  expect(document.querySelector('.slate-bar')).toBeNull();
});

test('offers Today from any other date and marks it inert on today', async () => {
  render(
    <MemoryRouter initialEntries={['/matchups']}>
      <SlatePage />
    </MemoryRouter>,
  );

  await screen.findByRole('heading', { name: 'Thursday, January 15, 2026' });
  // Today's slate: the control is inert rather than an action that does nothing.
  expect(screen.getByRole('button', { name: 'Today' })).toBeDisabled();

  fetchSlate.mockResolvedValue({ ...slate, slateDate: '2026-01-10' });
  fireEvent.change(screen.getByLabelText('Slate date'), { target: { value: '2026-01-10' } });

  await waitFor(() => expect(screen.getByRole('button', { name: 'Today' })).toBeEnabled());
  fetchSlate.mockClear();
  fetchSlate.mockResolvedValue(slate);

  fireEvent.click(screen.getByRole('button', { name: 'Today' }));

  await waitFor(() => expect(fetchSlate).toHaveBeenCalledWith('2026-01-15', expect.any(Object)));
});

test('opens Team Sheets from anywhere on the row', async () => {
  render(
    <MemoryRouter initialEntries={['/matchups?date=2026-01-15']}>
      <SlatePage />
    </MemoryRouter>,
  );

  const heading = await screen.findByRole('heading', { name: 'LAL @ BOS' });
  const row = heading.closest('a');
  expect(row).toHaveAttribute('href', '/matchups/0022500584');
  // One control, one sentence — not a heading plus a separate call to action.
  expect(row).toHaveAccessibleName(
    /^LAL @ BOS, .+, 9 targetable players, LAL 5, BOS 4, Open Team Sheets$/,
  );
  expect(within(row.closest('li')).getAllByRole('link')).toHaveLength(1);
});

test.each([
  ['missing', /player pool is missing/i],
  ['unavailable', /player pool is unavailable/i],
])('renders distinct %s pool copy', async (poolStatus, expected) => {
  fetchSlate.mockResolvedValue({
    ...slate,
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
  ['postponed', null, 'Postponed'],
  ['final', null, 'Final'],
  ['final', 'Final/OT', 'Final/OT'],
  ['scheduled', 'Delayed', 'Delayed'],
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

test('does not label an ordinary scheduled game, which its tip time already states', async () => {
  fetchSlate.mockResolvedValue({
    ...slate,
    games: [{ ...game, status: 'scheduled', statusLabel: 'Scheduled' }],
  });

  render(
    <MemoryRouter initialEntries={['/matchups?date=2026-01-15']}>
      <SlatePage />
    </MemoryRouter>,
  );

  await screen.findByRole('heading', { name: 'LAL @ BOS' });
  expect(screen.queryByText('Scheduled')).not.toBeInTheDocument();
});

test('separates a postponement from a descriptive classification', async () => {
  fetchSlate.mockResolvedValue({
    ...slate,
    games: [{ ...game, status: 'postponed', statusLabel: null, classification: 'NBA Cup' }],
  });

  render(
    <MemoryRouter initialEntries={['/matchups?date=2026-01-15']}>
      <SlatePage />
    </MemoryRouter>,
  );

  expect(await screen.findByText('Postponed')).toHaveClass('is-blocked');
  expect(screen.getByText('NBA Cup')).toHaveClass('is-event');
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

/*
 * The day's Targets hang under the game rows they belong to. A resolved entry
 * is what the resolve read returns for one Target on one date: the game its
 * opponent plays, the opponent's readings on each Qualifier's slice, and the
 * opposing players who meet every Qualifier.
 */
const corner3 = {
  base: 'shot_zones',
  sliceKey: 'Corner 3',
  comparator: 'at_or_above',
  threshold: 0.4,
};

const resolvedEntry = (overrides = {}) => ({
  target: {
    id: 7,
    opponent: 'BOS',
    title: 'BOS vs Corner 3 ≥ 40%',
    note: '',
    createdAt: '2026-01-10T00:10:00Z',
    qualifiers: [corner3],
  },
  game: {
    gameId: '0022500584',
    scheduledAt: '2026-01-16T00:30:00.000Z',
    status: { state: 'scheduled', label: 'Scheduled' },
    away: { tricode: 'LAL' },
    home: { tricode: 'BOS' },
    opponent: { tricode: 'BOS' },
    opposingTeam: { tricode: 'LAL' },
  },
  availability: { status: 'available', source: 'player_pool', unavailableReason: null },
  context: [{ label: 'Corner 3', metrics: [] }],
  players: [
    {
      canonicalId: 2544,
      name: 'LeBron James',
      tricode: 'LAL',
      seasonScoring: 25.4,
      thin: false,
      shares: [{ share: 0.44, leagueAverageShare: 0.2 }],
    },
  ],
  ...overrides,
});

const renderSlate = () =>
  render(
    <MemoryRouter initialEntries={['/matchups?date=2026-01-15']}>
      <SlatePage />
    </MemoryRouter>,
  );

test('a game with a Target grows a block of its fits beneath the row', async () => {
  fetchResolvedTargets.mockResolvedValue({
    slateDate: '2026-01-15',
    entries: [resolvedEntry()],
  });

  renderSlate();

  const row = (await screen.findByRole('heading', { name: 'LAL @ BOS' })).closest('li');
  const block = within(within(row).getByRole('article'));
  // The Target, as its title is derived: the opponent, then the bound.
  expect(block.getByText('BOS')).toBeVisible();
  expect(block.getByText('≥ 40%')).toBeVisible();
  expect(block.getByText('1')).toBeVisible();
  expect(block.getByText('fit', { exact: false })).toBeVisible();
  // One column per Qualifier, so a share is attributable to what demanded it.
  expect(block.getByRole('columnheader', { name: 'Corner 3' })).toBeVisible();
  // The share that made the player fit, against what the league does on it.
  expect(block.getByText('LeBron James')).toBeVisible();
  expect(block.getByText('44%')).toBeVisible();
  expect(block.getByText('lg 20%')).toBeVisible();
  expect(block.getByText('25.4')).toBeVisible();
  // A stored Player Pool named these players, so there is no other evidence
  // to name; only a completed game's participants are captioned.
  expect(block.queryByText('from game logs')).not.toBeInTheDocument();
  // The Slate says how many Targets the day has, and where all of them live.
  expect(screen.getByText('1 Target active', { exact: false })).toBeVisible();
  expect(screen.getByRole('link', { name: 'All Targets →' })).toHaveAttribute('href', '/targets');
  // The date being viewed is the date the Targets were resolved against.
  await waitFor(() =>
    expect(fetchResolvedTargets).toHaveBeenCalledWith(
      expect.objectContaining({ date: '2026-01-15' }),
    ),
  );
});

test('a thin diet is flagged in the fit list rather than dropped from it', async () => {
  fetchResolvedTargets.mockResolvedValue({
    slateDate: '2026-01-15',
    entries: [
      resolvedEntry({
        players: [
          {
            canonicalId: 1630559,
            name: 'Austin Reaves',
            tricode: 'LAL',
            seasonScoring: 20.1,
            thin: true,
            shares: [{ share: 0.41, leagueAverageShare: null }],
          },
        ],
      }),
    ],
  });

  renderSlate();

  expect(await screen.findByText('Austin Reaves')).toBeVisible();
  expect(screen.getByText('thin')).toBeVisible();
  // Nothing to compare against is not a league average of zero.
  expect(screen.queryByText(/^lg /)).not.toBeInTheDocument();
});

test('an unavailable pool reads differently from nobody fitting', async () => {
  fetchResolvedTargets.mockResolvedValue({
    slateDate: '2026-01-15',
    entries: [
      resolvedEntry({ players: [] }),
      resolvedEntry({
        target: { ...resolvedEntry().target, id: 8, title: 'BOS vs Corner 3 ≥ 50%' },
        availability: {
          status: 'unavailable',
          source: 'player_pool',
          unavailableReason: 'player_pool_unavailable',
        },
        players: [],
      }),
    ],
  });

  renderSlate();

  expect(await screen.findByText('No LAL player meets every Qualifier today.')).toBeVisible();
  expect(screen.getByText(/LAL pool unavailable: player_pool_unavailable/)).toBeVisible();
  expect(screen.getByText(/not the same as nobody fitting/)).toBeVisible();
  // An unavailable pool has no count to state; a fitless one counts zero.
  expect(screen.getByText('0')).toBeVisible();
  expect(screen.getByText('2 Targets active', { exact: false })).toBeVisible();
});

test('states a window_not_ready pool reason in a sentence instead of the raw code', async () => {
  fetchResolvedTargets.mockResolvedValue({
    slateDate: '2026-01-15',
    entries: [
      resolvedEntry({
        availability: {
          status: 'unavailable',
          source: 'player_pool',
          unavailableReason: 'window_not_ready',
        },
        players: [],
      }),
    ],
  });

  renderSlate();

  expect(
    await screen.findByText(
      'LAL pool unavailable: Last 15 has not opened yet; it opens once every team has played 15 games. Nobody can be listed, which is not the same as nobody fitting.',
    ),
  ).toBeVisible();
  expect(screen.queryByText(/window_not_ready/)).not.toBeInTheDocument();
});

test('an idle Target adds nothing to the board and counts as nothing active', async () => {
  fetchResolvedTargets.mockResolvedValue({
    slateDate: '2026-01-15',
    entries: [
      {
        ...resolvedEntry(),
        target: { ...resolvedEntry().target, id: 9, opponent: 'OKC' },
        game: null,
        availability: {
          status: 'unavailable',
          source: null,
          unavailableReason: 'opponent_idle',
        },
        context: [],
        players: [],
      },
    ],
  });

  renderSlate();

  expect(await screen.findByRole('heading', { name: 'LAL @ BOS' })).toBeVisible();
  expect(screen.getByText('0 Targets active', { exact: false })).toBeVisible();
  expect(screen.queryByText('OKC')).not.toBeInTheDocument();
});

/*
 * The Targets read is not the slate's. A slate that loaded is still worth
 * reading, so a refused resolution says so on its own line instead of
 * claiming that no Target is active today.
 */
test('a refused Targets read leaves the board standing and does not claim zero', async () => {
  fetchResolvedTargets.mockRejectedValue({
    response: { status: 503, data: { error: { message: 'Targets are unavailable.' } } },
  });

  renderSlate();

  expect(await screen.findByRole('heading', { name: 'LAL @ BOS' })).toBeVisible();
  expect(screen.getByText('Targets unavailable', { exact: false })).toBeVisible();
  expect(screen.queryByText(/Targets active/)).not.toBeInTheDocument();
});
