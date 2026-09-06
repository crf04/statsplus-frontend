import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import TargetDetailPage from './TargetDetailPage';
import {
  deleteTarget,
  fetchDietBaselines,
  fetchTargetPreview,
  fetchTargets,
  updateTarget,
} from './targetsApi';

jest.mock('./targetsApi', () => ({
  fetchTargets: jest.fn(),
  fetchDietBaselines: jest.fn(),
  fetchTargetPreview: jest.fn(),
  updateTarget: jest.fn(),
  deleteTarget: jest.fn(),
}));

const auth = { isAuthenticated: true, loading: false };
jest.mock('../contexts/AuthContext', () => ({
  useAuth: () => auth,
}));

/*
 * The title is the backend's and is deliberately not what these Qualifiers
 * would derive, so displaying a locally derived title fails here. The instant
 * is near midnight UTC, and the suite runs in a zone east of UTC, so a
 * formatter reading it in local time names the wrong day.
 */
const target = {
  id: 7,
  opponent: 'OKC',
  title: 'OKC vs Corner 3 ≥ 40% (v2)',
  note: 'Leaks the corner late.',
  createdAt: '2026-04-08T23:30:00Z',
  qualifiers: [
    { base: 'shot_zones', sliceKey: 'Corner 3', comparator: 'at_or_above', threshold: 0.4 },
  ],
};

/*
 * The season behind the Target: every league-wide player who meets the
 * Qualifiers and has faced the opponent, with the outcome markets the
 * Qualifier's slice maps to. It travels with the Target the backend ran it
 * for, so the shares are labelled by those Qualifiers rather than the page's.
 */
const backtest = {
  target,
  proxy: 'Outcomes are box-score proxies; there are no per-game slice splits.',
  statColumns: ['PTS', '3PM'],
  // The backend's arithmetic over the three games below: +5.6, -2.9 and 0.0
  // in points, two of three at or over.
  summary: {
    players: 1,
    games: 3,
    columns: {
      PTS: { meanDifference: 0.913, overAverageShare: 0.667 },
      '3PM': { meanDifference: 0.333, overAverageShare: 0.667 },
    },
  },
  players: [
    {
      canonicalId: 2544,
      name: 'LeBron James',
      tricode: 'LAL',
      shares: [{ share: 0.44, leagueAverageShare: 0.2 }],
      seasonAverages: { PTS: 25.4, '3PM': 2 },
      games: [
        { gameDate: '2026-01-12', stats: { PTS: 31, '3PM': 4 } },
        { gameDate: '2025-12-02', stats: { PTS: 22.5, '3PM': 1 } },
        { gameDate: '2025-11-06', stats: { PTS: 25.44, '3PM': 2 } },
      ],
    },
  ],
};

const LocationProbe = () => <output data-testid="location">{useLocation().pathname}</output>;

const renderDetail = (path = '/targets/7') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/targets" element={<p>All Targets</p>} />
        <Route path="/targets/:targetId" element={<TargetDetailPage />} />
      </Routes>
      <LocationProbe />
    </MemoryRouter>,
  );

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  auth.isAuthenticated = true;
  auth.loading = false;
  fetchTargets.mockResolvedValue([target]);
  fetchTargetPreview.mockResolvedValue({ ...backtest, today: null });
  fetchDietBaselines.mockResolvedValue({ shares: { shot_zones: { 'Corner 3': 0.2 } } });
  updateTarget.mockResolvedValue(undefined);
  deleteTarget.mockResolvedValue(undefined);
});
afterEach(() => jest.useRealTimers());
const open = async () => {
  renderDetail();
  await screen.findByLabelText('Qualifier 1 threshold percent');
  await act(async () => jest.advanceTimersByTime(600));
};
test('the workbench opens live with a dirty-only footer and reverts without saving', async () => {
  await open();
  expect(screen.getByRole('link', { name: '← All Targets' })).toHaveAttribute('href', '/targets');
  expect(screen.getByRole('heading', { name: target.title })).toBeVisible();
  expect(screen.getByRole('button', { name: 'Delete' })).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Save changes' })).not.toBeInTheDocument();
  expect(screen.queryByText(/Target · set/)).not.toBeInTheDocument();
  const slider = screen.getByRole('slider');
  fireEvent.change(slider, { target: { value: '45' } });
  expect(screen.getByRole('button', { name: 'Save changes' })).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Revert' }));
  expect(slider).toHaveValue('40');
  expect(screen.queryByRole('button', { name: 'Save changes' })).not.toBeInTheDocument();
  expect(updateTarget).not.toHaveBeenCalled();
});
test('saving sends edited criteria explicitly and keeps a refused draft editable', async () => {
  await open();
  fireEvent.change(screen.getByRole('slider'), { target: { value: '45' } });
  updateTarget.mockRejectedValueOnce(new Error('Unavailable'));
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Save changes' })));
  expect(screen.getByRole('alert')).toBeVisible();
  expect(screen.getByRole('slider')).toHaveValue('45');
  expect(updateTarget).toHaveBeenCalledWith({
    id: 7,
    note: target.note,
    qualifiers: [{ ...target.qualifiers[0], threshold: 0.45 }],
  });
});
test('delete asks before acting and returns to all Targets', async () => {
  await open();
  fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
  expect(deleteTarget).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Keep it' }));
  expect(deleteTarget).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Yes, delete' })));
  expect(deleteTarget).toHaveBeenCalledWith({ id: 7 });
  expect(screen.getByTestId('location')).toHaveTextContent(/^\/targets$/);
});
test('the Lab reads automatically and retains dimmed evidence while criteria move', async () => {
  await open();
  expect(fetchTargetPreview).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('list', { name: 'Backtest summary' })).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Expand backtest' })).not.toBeInTheDocument();
  fireEvent.change(screen.getByRole('slider'), { target: { value: '45' } });
  expect(
    screen.getByRole('list', { name: 'Backtest summary' }).closest('.target-lab-result'),
  ).toHaveClass('is-stale');
  expect(fetchTargetPreview).toHaveBeenCalledTimes(1);
  await act(async () => jest.advanceTimersByTime(600));
  expect(fetchTargetPreview).toHaveBeenCalledTimes(2);
});
test('missing and signed-out Targets are still explicit states', async () => {
  auth.isAuthenticated = false;
  renderDetail();
  expect(screen.getByRole('heading', { name: 'Sign in to view your Targets' })).toBeVisible();
  expect(fetchTargets).not.toHaveBeenCalled();
  expect(fetchDietBaselines).not.toHaveBeenCalled();
});

test('a successful save refreshes the stored record and clears the dirty footer', async () => {
  await open();
  fireEvent.change(screen.getByRole('slider'), { target: { value: '45' } });
  fetchTargets.mockResolvedValue([
    { ...target, qualifiers: [{ ...target.qualifiers[0], threshold: 0.45 }] },
  ]);
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Save changes' })));
  expect(await screen.findByRole('slider')).toHaveValue('45');
  expect(screen.queryByRole('button', { name: 'Save changes' })).not.toBeInTheDocument();
});
test('a delete refusal leaves the Target editable', async () => {
  await open();
  deleteTarget.mockRejectedValue({
    response: { data: { error: { message: 'Deletion unavailable.' } } },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Yes, delete' })));
  expect(screen.getByRole('alert')).toHaveTextContent('Deletion unavailable.');
  expect(screen.getByRole('slider')).toBeEnabled();
  expect(screen.getByRole('button', { name: 'Delete' })).toBeEnabled();
});
test('a failed season read stays retryable without losing the criteria', async () => {
  fetchTargetPreview.mockRejectedValueOnce({
    response: { data: { error: { message: 'Season unavailable.' } } },
  });
  await open();
  expect(screen.getByRole('alert')).toHaveTextContent('Season unavailable.');
  expect(screen.getByRole('slider')).toHaveValue('40');
  fireEvent.click(screen.getByRole('button', { name: 'Retry backtest' }));
  await act(async () => jest.advanceTimersByTime(600));
  expect(screen.getByRole('list', { name: 'Backtest summary' })).toBeVisible();
  expect(fetchTargetPreview).toHaveBeenCalledTimes(2);
});
test('a late superseded preview never replaces the latest evidence', async () => {
  await open();
  let finishOld;
  fetchTargetPreview.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finishOld = resolve;
      }),
  );
  fireEvent.change(screen.getByRole('slider'), { target: { value: '45' } });
  await act(async () => jest.advanceTimersByTime(600));
  const oldSignal = fetchTargetPreview.mock.calls[1][0].signal;
  fireEvent.change(screen.getByRole('slider'), { target: { value: '46' } });
  expect(oldSignal.aborted).toBe(true);
  fetchTargetPreview.mockResolvedValueOnce({ ...backtest, today: null, players: [] });
  await act(async () => jest.advanceTimersByTime(600));
  expect(screen.getByText('Nobody qualifying has faced OKC yet.')).toBeVisible();
  await act(async () => finishOld({ ...backtest, today: null }));
  expect(screen.getByText('Nobody qualifying has faced OKC yet.')).toBeVisible();
});
test('games page newest first and the selected summary column grades both surfaces', async () => {
  const games = Array.from({ length: 25 }, (_, i) => ({
    gameDate: `2026-01-${String(i + 1).padStart(2, '0')}`,
    stats: { PTS: 30, '3PM': 0 },
  }));
  fetchTargetPreview.mockResolvedValue({
    ...backtest,
    today: null,
    players: [{ ...backtest.players[0], games }],
  });
  await open();
  const rows = screen.getByRole('region', { name: 'Backtest games' });
  expect(within(rows).getAllByRole('listitem')).toHaveLength(20);
  expect(within(rows).getAllByRole('listitem')[0]).toHaveTextContent('2026-01-25');
  expect(within(rows).getAllByRole('listitem')[0]).toHaveTextContent('0.0 3PM');
  expect(within(rows).getAllByRole('listitem')[0]).toHaveTextContent('LeBron James');
  const grid = screen.getByRole('list', { name: /25 games, oldest to newest, graded by PTS/ });
  expect(within(grid).getAllByRole('listitem')[0]).toHaveClass('grade-hit-4');
  fireEvent.click(screen.getByRole('button', { name: /^3PM/ }));
  expect(screen.getByRole('list', { name: /graded by 3PM/ })).toBeVisible();
  expect(within(grid).getAllByRole('listitem')[0]).toHaveClass('grade-miss-4');
  expect(within(rows).getAllByRole('listitem')[0].querySelector('i')).toHaveClass('grade-miss-4');
  fireEvent.click(screen.getByRole('button', { name: 'Show all 25 games' }));
  expect(within(rows).getAllByRole('listitem')).toHaveLength(25);
});
