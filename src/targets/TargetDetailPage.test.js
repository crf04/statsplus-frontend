import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import TargetDetailPage from './TargetDetailPage';
import { deleteTarget, fetchResolvedTargets, updateTarget } from './targetsApi';

jest.mock('./targetsApi', () => ({
  fetchResolvedTargets: jest.fn(),
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
 * The page reads one Target as it resolves against the current Slate Date, so
 * every fixture below is a resolution: the Target, the game its opponent
 * plays that day, the readings on the Qualifier's slice, and the fits.
 */
const idleOn = (slateDate, record = target) => ({
  slateDate,
  entries: [
    {
      target: record,
      game: null,
      availability: { status: 'unavailable', source: null, unavailableReason: 'opponent_idle' },
      context: [],
      players: [],
    },
  ],
});

const reading = (rank, percentVsLeagueAverage, sigmaDeviation) => ({
  rank,
  percentVsLeagueAverage,
  sigmaDeviation,
});

const liveOn = (slateDate, record = target, overrides = {}) => ({
  slateDate,
  entries: [
    {
      target: record,
      game: {
        gameId: '0022500584',
        scheduledAt: '2026-04-09T23:30:00.000Z',
        status: { state: 'scheduled', label: 'Scheduled' },
        opponent: { tricode: 'OKC' },
        opposingTeam: { tricode: 'LAL' },
      },
      availability: { status: 'available', source: 'player_pool', unavailableReason: null },
      context: [
        {
          label: 'Corner 3',
          metrics: [
            {
              key: 'Corner 3:FGA',
              label: 'Corner 3 FGA',
              season: reading(27, 9.7, 1.2),
              last15: reading(11, -4.2, -0.6),
            },
          ],
        },
      ],
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
    },
  ],
});

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
  auth.isAuthenticated = true;
  auth.loading = false;
  fetchResolvedTargets.mockResolvedValue(idleOn('2026-04-09'));
  updateTarget.mockResolvedValue(undefined);
  deleteTarget.mockResolvedValue(undefined);
});

test('shows one Target with its Qualifiers, note, creation date, and a way back', async () => {
  renderDetail();

  expect(
    await screen.findByRole('heading', { name: 'OKC vs Corner 3 ≥ 40% (v2)' }),
  ).toBeInTheDocument();
  expect(screen.getByText('Target · set Apr 8, 2026')).toBeInTheDocument();
  expect(screen.getByText('Leaks the corner late.')).toBeInTheDocument();
  const qualifiers = screen.getAllByRole('listitem');
  expect(qualifiers).toHaveLength(1);
  expect(qualifiers[0]).toHaveTextContent('Shot zones');
  expect(qualifiers[0]).toHaveTextContent('Corner 3 ≥ 40%');
  expect(qualifiers[0]).toHaveTextContent('of FGA');
  expect(screen.getByRole('link', { name: '← All Targets' })).toHaveAttribute('href', '/targets');
});

test('a Target that is gone says so instead of showing an empty one', async () => {
  renderDetail('/targets/999');

  expect(await screen.findByRole('heading', { name: 'That Target is gone.' })).toBeInTheDocument();
});

test('editing changes the Qualifiers and the note, and the backend re-derives the title', async () => {
  renderDetail();
  fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));

  // The opponent is what the Target is about, so editing cannot move it.
  expect(screen.queryByLabelText('Opponent')).not.toBeInTheDocument();
  expect(screen.getByLabelText('Qualifier 1 threshold percent')).toHaveValue(40);

  fireEvent.change(screen.getByLabelText('Qualifier 1 threshold percent'), {
    target: { value: '45' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'At or below' }));
  fireEvent.change(screen.getByLabelText('Note · optional, never the title'), {
    target: { value: 'Zone walls off the corner instead.' },
  });

  fetchResolvedTargets.mockResolvedValue(
    idleOn('2026-04-09', {
      ...target,
      title: 'OKC vs Corner 3 ≤ 45%',
      note: 'Zone walls off the corner instead.',
      qualifiers: [
        { base: 'shot_zones', sliceKey: 'Corner 3', comparator: 'at_or_below', threshold: 0.45 },
      ],
    }),
  );
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
  });

  expect(updateTarget).toHaveBeenCalledWith({
    id: 7,
    note: 'Zone walls off the corner instead.',
    qualifiers: [
      { base: 'shot_zones', sliceKey: 'Corner 3', comparator: 'at_or_below', threshold: 0.45 },
    ],
  });
  expect(await screen.findByRole('heading', { name: 'OKC vs Corner 3 ≤ 45%' })).toBeInTheDocument();
  expect(screen.getByText('Zone walls off the corner instead.')).toBeInTheDocument();
});

test('a refused edit reads as the backend explained it and keeps the form open', async () => {
  updateTarget.mockRejectedValue({
    response: {
      status: 409,
      data: { error: { code: 'operation_conflict', message: 'You already have that Target.' } },
    },
  });
  renderDetail();
  fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));

  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
  });

  expect(screen.getByRole('alert')).toHaveTextContent('You already have that Target.');
  expect(screen.getByRole('button', { name: 'Save changes' })).toBeInTheDocument();
});

test('deleting asks first, then removes the Target and returns to the grid', async () => {
  renderDetail();
  fireEvent.click(await screen.findByRole('button', { name: 'Delete' }));

  expect(screen.getByText('Delete this Target?')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Keep it' }));
  expect(deleteTarget).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Yes, delete' }));
  });

  expect(deleteTarget).toHaveBeenCalledWith({ id: 7 });
  expect(screen.getByTestId('location')).toHaveTextContent(/^\/targets$/);
});

/*
 * The slice vocabulary is the backend's. If a stored Target names a slice this
 * page has no label for, a picker would quietly swap it for its first option
 * and the edit would change a criterion nobody touched.
 */
test('an unrecognised slice is shown as stored rather than silently replaced', async () => {
  fetchResolvedTargets.mockResolvedValue(
    idleOn('2026-04-09', {
      ...target,
      qualifiers: [
        { base: 'play_types', sliceKey: 'Misc', comparator: 'at_or_above', threshold: 0.4 },
      ],
    }),
  );
  renderDetail();
  fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));

  const slice = screen.getByLabelText('Qualifier 1 slice');
  expect(slice).toHaveValue('Misc');
  expect(slice).toBeDisabled();

  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
  });

  expect(updateTarget).toHaveBeenCalledWith(
    expect.objectContaining({
      qualifiers: [
        { base: 'play_types', sliceKey: 'Misc', comparator: 'at_or_above', threshold: 0.4 },
      ],
    }),
  );
});

test('signed out, the detail asks for sign-in the way the slate does', () => {
  auth.isAuthenticated = false;
  renderDetail();

  expect(screen.getByRole('heading', { name: 'Sign in to view your Targets' })).toBeInTheDocument();
  expect(fetchResolvedTargets).not.toHaveBeenCalled();
});

test('a live Target reads its opponent in both windows and lists the fits', async () => {
  fetchResolvedTargets.mockResolvedValue(liveOn('2026-04-09'));

  renderDetail();

  // Every Defense Sheet row on the Qualifier's slice, in both windows.
  const qualifier = (await screen.findAllByRole('listitem'))[0];
  expect(qualifier).toHaveTextContent('Corner 3 FGA');
  expect(qualifier).toHaveTextContent('Season');
  expect(qualifier).toHaveTextContent('+9.7% vs league');
  expect(qualifier).toHaveTextContent('+1.2σ');
  expect(qualifier).toHaveTextContent('L15');
  expect(qualifier).toHaveTextContent('-4.2% vs league');
  expect(qualifier).toHaveTextContent('-0.6σ');
  // The rank pill carries the reading the Matchup's does.
  expect(
    within(qualifier).getByTitle('Opponent rank 27/30 — 30 allows the most'),
  ).toHaveTextContent('27');

  // The fits, headed by the game they came from.
  expect(screen.getByRole('link', { name: 'LAL vs OKC' })).toHaveAttribute(
    'href',
    '/matchups/0022500584',
  );
  expect(screen.getByText('LeBron James')).toBeVisible();
  expect(screen.getByText('44%')).toBeVisible();
  expect(screen.getByText('lg 20%')).toBeVisible();
  expect(screen.getByText('25.4')).toBeVisible();
  expect(screen.queryByText(/has no game on/)).not.toBeInTheDocument();
  // The detail resolves against the current Slate Date rather than one it
  // works out for itself.
  expect(fetchResolvedTargets).toHaveBeenCalledWith(expect.objectContaining({ date: undefined }));
});

test('a window the opponent publishes nothing for reads as unavailable, not as zero', async () => {
  fetchResolvedTargets.mockResolvedValue(
    liveOn('2026-04-09', target, {
      context: [
        {
          label: 'Corner 3',
          metrics: [
            {
              key: 'Corner 3:FGA',
              label: 'Corner 3 FGA',
              season: reading(27, 9.7, 1.2),
              last15: null,
            },
          ],
        },
      ],
    }),
  );

  renderDetail();

  expect(await screen.findByText('n/a', { exact: false })).toBeVisible();
  expect(screen.getByText('+9.7% vs league')).toBeVisible();
  expect(screen.queryByText('0.0σ')).not.toBeInTheDocument();
});

test('an unavailable pool is stated instead of an empty fit list', async () => {
  fetchResolvedTargets.mockResolvedValue(
    liveOn('2026-04-09', target, {
      availability: {
        status: 'unavailable',
        source: 'player_pool',
        unavailableReason: 'player_pool_unavailable',
      },
      players: [],
    }),
  );

  renderDetail();

  expect(await screen.findByText(/LAL pool unavailable: player_pool_unavailable/)).toBeVisible();
  expect(screen.getByText(/not the same as nobody fitting/)).toBeVisible();
});

test('a completed game names the evidence that listed its participants', async () => {
  fetchResolvedTargets.mockResolvedValue(
    liveOn('2026-04-09', target, {
      game: {
        gameId: '0022501082',
        scheduledAt: '2026-04-09T23:30:00.000Z',
        status: { state: 'final', label: 'Final' },
        opponent: { tricode: 'OKC' },
        opposingTeam: { tricode: 'LAL' },
      },
      availability: { status: 'available', source: 'game_logs', unavailableReason: null },
    }),
  );

  renderDetail();

  expect(await screen.findByText('Final')).toBeVisible();
  expect(screen.getByText('from game logs')).toBeVisible();
});

test('an idle Target keeps its Qualifiers and says which day it has no game on', async () => {
  fetchResolvedTargets.mockResolvedValue(idleOn('2026-04-09'));

  renderDetail();

  expect(await screen.findByText('OKC has no game on Thursday, April 9, 2026.')).toBeVisible();
  // No game means no game-scoped window, so there is no reading to show.
  expect(screen.getByText('Corner 3 ≥ 40%')).toBeVisible();
  expect(screen.queryByText(/vs league/)).not.toBeInTheDocument();
  expect(screen.queryByText('Season')).not.toBeInTheDocument();
});
