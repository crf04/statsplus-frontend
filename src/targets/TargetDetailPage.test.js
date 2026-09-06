import { Fragment, StrictMode } from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import TargetDetailPage from './TargetDetailPage';
import {
  deleteTarget,
  fetchDietBaselines,
  fetchSeasonMinutes,
  fetchTargetPreview,
  fetchTargets,
  updateTarget,
} from './targetsApi';

jest.mock('./targetsApi', () => ({
  fetchTargets: jest.fn(),
  fetchDietBaselines: jest.fn(),
  fetchSeasonMinutes: jest.fn(),
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

const renderDetail = (path = '/targets/7', wrapper = Fragment) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/targets" element={<p>All Targets</p>} />
        <Route path="/targets/:targetId" element={<TargetDetailPage />} />
      </Routes>
      <LocationProbe />
    </MemoryRouter>,
    { wrapper },
  );

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  auth.isAuthenticated = true;
  auth.loading = false;
  fetchTargets.mockResolvedValue([target]);
  fetchSeasonMinutes.mockResolvedValue({
    season: '2025-26',
    players: [{ playerId: 27, name: 'Rudy Gobert', averageMinutes: 32, gamesPlayed: 60 }],
  });
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
  expect(within(rows).getAllByRole('listitem')).toHaveLength(12);
  expect(within(rows).getAllByRole('listitem')[0]).toHaveTextContent('Jan 25');
  expect(within(rows).getAllByRole('listitem')[0]).toHaveTextContent('3PM 0');
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

test('Conditions dirty the workbench, ride the preview and survive Save without resetting its lens or paging', async () => {
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
  fireEvent.click(screen.getByRole('button', { name: /^3PM/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Show all 25 games' }));
  fireEvent.click(screen.getByRole('button', { name: '+ and' }));
  fireEvent.click(screen.getByRole('button', { name: 'a defender’s minutes' }));
  expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();
  await screen.findByRole('option', { name: /Rudy Gobert/ });
  fireEvent.change(screen.getByLabelText('Defender'), { target: { value: '27' } });
  const conditions = {
    defender: { playerId: 27, comparator: 'under', minutes: 10 },
    from: null,
    to: null,
  };
  await act(async () => jest.advanceTimersByTime(600));
  expect(fetchTargetPreview).toHaveBeenLastCalledWith(expect.objectContaining({ conditions }));
  fetchTargets.mockResolvedValue([{ ...target, conditions }]);
  const calls = fetchTargetPreview.mock.calls.length;
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Save changes' })));
  expect(updateTarget).toHaveBeenLastCalledWith(expect.objectContaining({ conditions }));
  expect(screen.getByRole('button', { name: 'Show first 12 games' })).toBeVisible();
  expect(screen.getByRole('list', { name: /graded by 3PM/ })).toBeVisible();
  await act(async () => jest.advanceTimersByTime(600));
  expect(fetchTargetPreview).toHaveBeenCalledTimes(calls);
  expect(screen.queryByRole('button', { name: 'Save changes' })).not.toBeInTheDocument();
});
test('an unknown stored slice remains untouched when another field is saved', async () => {
  fetchTargets.mockResolvedValue([
    { ...target, qualifiers: [{ ...target.qualifiers[0], sliceKey: 'Unknown' }] },
  ]);
  await open();
  expect(screen.getByLabelText('Qualifier 1 slice')).toHaveValue('Unknown');
  expect(screen.getByLabelText('Qualifier 1 slice')).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Note · optional, never the title'), {
    target: { value: 'Edited note' },
  });
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Save changes' })));
  expect(updateTarget).toHaveBeenCalledWith(
    expect.objectContaining({ qualifiers: [expect.objectContaining({ sliceKey: 'Unknown' })] }),
  );
});
test('a refused Target list shows the backend error', async () => {
  fetchTargets.mockRejectedValue({
    response: { data: { error: { message: 'Targets unavailable.' } } },
  });
  renderDetail();
  expect(await screen.findByRole('alert')).toHaveTextContent('Targets unavailable.');
});

test('the stat picker persists its lens separately from criteria and reads it back', async () => {
  auth.currentUser = { uid: 'stat-picker-reader' };
  fetchTargets.mockResolvedValue([
    { ...target, statPreferences: { columns: ['PTS'], gradedBy: 'PTS' } },
  ]);
  const view = renderDetail();
  await act(async () => {});
  await act(async () => jest.advanceTimersByTime(600));
  fireEvent.click(screen.getByRole('button', { name: 'stats ▾' }));
  expect(screen.getByRole('group', { name: 'Box score' })).toBeVisible();
  expect(screen.getByRole('group', { name: 'Per 36 minutes' })).toBeVisible();
  expect(screen.getByRole('group', { name: 'Efficiency' })).toBeVisible();
  fireEvent.click(screen.getByRole('checkbox', { name: 'PTS/36' }));
  fireEvent.click(screen.getByRole('button', { name: /^PTS\/36 / }));
  expect(screen.getByRole('list', { name: /graded by PTS\/36/ })).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Save changes' })).not.toBeInTheDocument();
  expect(updateTarget).not.toHaveBeenCalled();
  await act(async () => jest.advanceTimersByTime(400));
  expect(updateTarget).toHaveBeenCalledTimes(1);
  expect(updateTarget).toHaveBeenCalledWith({
    id: 7,
    statPreferences: { columns: ['PTS', 'PTS/36'], gradedBy: 'PTS/36' },
    expectedUserId: 'stat-picker-reader',
  });
  fireEvent.click(screen.getByRole('checkbox', { name: 'PTS', exact: true }));
  expect(screen.queryByRole('button', { name: /^PTS / })).not.toBeInTheDocument();
  expect(screen.getByRole('checkbox', { name: 'PTS/36' })).toBeDisabled();
  await act(async () => jest.advanceTimersByTime(400));
  expect(updateTarget.mock.calls[1][0].statPreferences).toEqual({
    columns: ['PTS/36'],
    gradedBy: 'PTS/36',
  });
  view.unmount();
  // A real reload starts a fresh page/account session and seeds from the API.
  auth.currentUser = { uid: 'stat-picker-reloaded' };
  fetchTargets.mockResolvedValue([
    { ...target, statPreferences: { columns: ['PTS/36'], gradedBy: 'PTS/36' } },
  ]);
  renderDetail();
  await act(async () => {});
  await act(async () => jest.advanceTimersByTime(600));
  expect(screen.getByRole('list', { name: /graded by PTS\/36/ })).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Save changes' })).not.toBeInTheDocument();
});

test('route cleanup flushes the newest preference and serializes changes across remounts', async () => {
  auth.currentUser = { uid: 'stat-navigation-reader' };
  let finishFirst;
  updateTarget.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finishFirst = resolve;
      }),
  );
  const view = renderDetail();
  await act(async () => {});
  await act(async () => jest.advanceTimersByTime(600));
  fireEvent.click(screen.getByRole('button', { name: /^3PM / }));
  // Leave before the debounce: the write starts and remembers the original id.
  view.unmount();
  expect(updateTarget).toHaveBeenCalledTimes(1);
  expect(updateTarget.mock.calls[0][0]).toEqual({
    id: 7,
    statPreferences: { columns: ['PTS', '3PM'], gradedBy: '3PM' },
    expectedUserId: 'stat-navigation-reader',
  });
  renderDetail();
  await act(async () => {});
  await act(async () => jest.advanceTimersByTime(600));
  expect(screen.getByRole('button', { name: /^3PM / })).toHaveAttribute('aria-pressed', 'true');
  fireEvent.click(screen.getByRole('button', { name: /^PTS / }));
  await act(async () => jest.advanceTimersByTime(400));
  expect(updateTarget).toHaveBeenCalledTimes(1);
  await act(async () => finishFirst());
  expect(updateTarget).toHaveBeenCalledTimes(2);
  expect(updateTarget.mock.calls[1][0].statPreferences.gradedBy).toBe('PTS');
  expect(screen.getByRole('button', { name: /^PTS / })).toHaveAttribute('aria-pressed', 'true');
});

test('a failed stats save is retryable without changing criteria', async () => {
  auth.currentUser = { uid: 'stat-retry-reader' };
  updateTarget.mockRejectedValueOnce(new Error('Stats could not save.'));
  renderDetail();
  await act(async () => {});
  await act(async () => jest.advanceTimersByTime(600));
  fireEvent.click(screen.getByRole('button', { name: /^3PM / }));
  await act(async () => jest.advanceTimersByTime(400));
  expect(screen.getByRole('alert')).toHaveTextContent('Stats could not save.');
  fireEvent.click(screen.getByRole('button', { name: 'Retry saving stats' }));
  await act(async () => jest.advanceTimersByTime(400));
  expect(updateTarget).toHaveBeenCalledTimes(2);
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Save changes' })).not.toBeInTheDocument();
});

test('criteria save remounts do not reset a pending grading choice', async () => {
  auth.currentUser = { uid: 'stat-criteria-reader' };
  renderDetail();
  await act(async () => {});
  await act(async () => jest.advanceTimersByTime(600));
  fireEvent.click(screen.getByRole('button', { name: /^3PM / }));
  fireEvent.change(screen.getByLabelText('Note · optional, never the title'), {
    target: { value: 'Updated note' },
  });
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Save changes' })));
  await act(async () => jest.advanceTimersByTime(600));
  expect(screen.getByRole('button', { name: /^3PM / })).toHaveAttribute('aria-pressed', 'true');
  expect(
    updateTarget.mock.calls.some(([request]) => request.statPreferences?.gradedBy === '3PM'),
  ).toBe(true);
  expect(
    updateTarget.mock.calls.find(([request]) => request.note === 'Updated note')[0],
  ).not.toHaveProperty('statPreferences');
});

test('another account never sees the previous account’s optimistic grading', async () => {
  auth.currentUser = { uid: 'stat-account-one' };
  const first = renderDetail();
  await act(async () => {});
  await act(async () => jest.advanceTimersByTime(600));
  fireEvent.click(screen.getByRole('button', { name: /^3PM / }));
  first.unmount();
  auth.currentUser = { uid: 'stat-account-two' };
  renderDetail();
  await act(async () => {});
  await act(async () => jest.advanceTimersByTime(600));
  expect(screen.getByRole('button', { name: /^PTS / })).toHaveAttribute('aria-pressed', 'true');
  expect(updateTarget.mock.calls[0][0].expectedUserId).toBe('stat-account-one');
});

test('revisiting a settled Target reads fresh server preferences', async () => {
  auth.currentUser = { uid: 'stat-fresh-reader' };
  const view = renderDetail();
  await act(async () => {});
  await act(async () => jest.advanceTimersByTime(600));
  fireEvent.click(screen.getByRole('button', { name: /^3PM / }));
  await act(async () => jest.advanceTimersByTime(400));
  expect(updateTarget).toHaveBeenCalledTimes(1);
  view.unmount();
  await act(async () => jest.advanceTimersByTime(0));
  fetchTargets.mockResolvedValue([
    { ...target, statPreferences: { columns: ['PTS/36'], gradedBy: 'PTS/36' } },
  ]);
  renderDetail();
  await act(async () => {});
  await act(async () => jest.advanceTimersByTime(600));
  expect(screen.getByRole('list', { name: /graded by PTS\/36/ })).toBeVisible();
  expect(screen.queryByRole('button', { name: /^3PM / })).not.toBeInTheDocument();
});

test('a destination read started before the preference save cannot restore the old lens', async () => {
  auth.currentUser = { uid: 'stat-slow-destination-reader' };
  let finishSave, finishRead;
  updateTarget.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finishSave = resolve;
      }),
  );
  const view = renderDetail('/targets/7', StrictMode);
  await act(async () => {});
  await act(async () => jest.advanceTimersByTime(600));
  fireEvent.click(screen.getByRole('button', { name: /^3PM / }));
  view.unmount();
  fetchTargets.mockImplementation(
    ({ signal }) =>
      new Promise((resolve, reject) => {
        signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
        finishRead = resolve;
      }),
  );
  renderDetail('/targets/7', StrictMode);
  await act(async () => {});
  await act(async () => finishSave());
  await act(async () => jest.advanceTimersByTime(0));
  await act(async () => finishRead([target]));
  await act(async () => jest.advanceTimersByTime(600));
  expect(screen.getByRole('button', { name: /^3PM / })).toHaveAttribute('aria-pressed', 'true');
});
