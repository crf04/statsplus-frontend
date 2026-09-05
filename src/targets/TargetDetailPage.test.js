import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import TargetDetailPage from './TargetDetailPage';
import {
  deleteTarget,
  fetchResolvedTargets,
  fetchTargetBacktest,
  fetchTargets,
  updateTarget,
} from './targetsApi';

jest.mock('./targetsApi', () => ({
  fetchTargets: jest.fn(),
  fetchResolvedTargets: jest.fn(),
  fetchTargetBacktest: jest.fn(),
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
 * The page reads the Target twice over: the list says what it is and keeps it
 * manageable, and the resolution says what today makes of it — the game its
 * opponent plays, the readings on the Qualifier's slice, and the fits.
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

const reading = (rank, allowedPer48, percentVsLeagueAverage, sigmaDeviation) => ({
  rank,
  allowedPer48,
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
        away: { tricode: 'LAL' },
        home: { tricode: 'OKC' },
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
              season: reading(27, 9.4, 9.7, 1.2),
              last15: reading(11, 8.1, -4.2, -0.6),
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

/*
 * A reading is one visual unit with no role of its own, so a test that wants
 * to know which window a figure belongs to has to scope to the reading the
 * window labels. Asserting on the Qualifier as a whole would pass if Season
 * and L15 swapped values.
 */
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
        { gameDate: '2025-11-06', stats: { PTS: 25.4, '3PM': 2 } },
      ],
    },
  ],
};

/*
 * The same backtest as the backend would return it for a Target whose
 * Qualifiers have since been edited: it carries the criteria it was actually
 * run against, which are not the ones the page is holding.
 */
const backtestOfAnotherTarget = {
  ...backtest,
  target: {
    ...target,
    opponent: 'DEN',
    title: 'DEN vs Mid-range ≥ 50%',
    qualifiers: [
      { base: 'shot_zones', sliceKey: 'Mid-Range', comparator: 'at_or_above', threshold: 0.5 },
    ],
  },
};

const expandBacktest = async () => {
  const toggle = await screen.findByRole('button', { name: 'Expand backtest' });
  await act(async () => {
    fireEvent.click(toggle);
  });
};

const readingFor = (window) => within(screen.getByText(window).closest('.target-reading'));

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
  fetchTargets.mockResolvedValue([target]);
  fetchResolvedTargets.mockResolvedValue(idleOn('2026-04-09'));
  updateTarget.mockResolvedValue(undefined);
  deleteTarget.mockResolvedValue(undefined);
  fetchTargetBacktest.mockResolvedValue(backtest);
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

  fetchTargets.mockResolvedValue([
    {
      ...target,
      title: 'OKC vs Corner 3 ≤ 45%',
      note: 'Zone walls off the corner instead.',
      qualifiers: [
        { base: 'shot_zones', sliceKey: 'Corner 3', comparator: 'at_or_below', threshold: 0.45 },
      ],
    },
  ]);
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
  fetchTargets.mockResolvedValue([
    {
      ...target,
      qualifiers: [
        { base: 'play_types', sliceKey: 'Misc', comparator: 'at_or_above', threshold: 0.4 },
      ],
    },
  ]);
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
  expect(fetchTargets).not.toHaveBeenCalled();
  expect(fetchResolvedTargets).not.toHaveBeenCalled();
});

test('a live Target reads its opponent in both windows and lists the fits', async () => {
  fetchResolvedTargets.mockResolvedValue(liveOn('2026-04-09'));

  renderDetail();

  // Every Defense Sheet row on the Qualifier's slice, in both windows, each
  // figure under the window it was read in.
  const qualifier = (await screen.findAllByRole('listitem'))[0];
  expect(qualifier).toHaveTextContent('Corner 3 FGA');
  const season = readingFor('Season');
  expect(season.getByText('9.4')).toBeVisible();
  expect(season.getByText('+9.7% vs league')).toBeVisible();
  expect(season.getByText('+1.2σ')).toBeVisible();
  const last15 = readingFor('L15');
  expect(last15.getByText('8.1')).toBeVisible();
  expect(last15.getByText('-4.2% vs league')).toBeVisible();
  expect(last15.getByText('-0.6σ')).toBeVisible();
  // The rank pill carries the rank it is coloured by, as the Matchup's does.
  const pill = season.getByTitle('Opponent rank 27/30 — 30 allows the most');
  expect(pill).toHaveTextContent('27');
  expect(pill.style.getPropertyValue('--rank')).toBe('27');
  expect(last15.getByTitle('Opponent rank 11/30 — 30 allows the most')).toHaveTextContent('11');

  // The fits, headed by the game they came from, named as the Slate names it.
  expect(screen.getByRole('link', { name: 'LAL @ OKC' })).toHaveAttribute(
    'href',
    '/matchups/0022500584',
  );
  expect(screen.getByText('LeBron James')).toBeVisible();
  expect(screen.getByText('44%')).toBeVisible();
  expect(screen.getByText('lg 20%')).toBeVisible();
  expect(screen.getByText('25.4')).toBeVisible();
  expect(screen.queryByText(/has no game on/)).not.toBeInTheDocument();
  // A stored Player Pool named these players; only a completed game's
  // participants are captioned with the evidence that listed them.
  expect(screen.queryByText('from game logs')).not.toBeInTheDocument();
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
              season: reading(27, 9.4, 9.7, 1.2),
              last15: null,
            },
          ],
        },
      ],
    }),
  );

  renderDetail();

  // The missing window is the one that says nothing; the published one still
  // reads its figures.
  expect(await screen.findByText('L15')).toBeVisible();
  expect(readingFor('L15').getByText('n/a')).toBeVisible();
  const season = readingFor('Season');
  expect(season.getByText('9.4')).toBeVisible();
  expect(season.getByText('+9.7% vs league')).toBeVisible();
  expect(season.queryByText('n/a')).not.toBeInTheDocument();
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
        away: { tricode: 'LAL' },
        home: { tricode: 'OKC' },
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

/*
 * The readings are a second read over the Target. Losing them costs the day's
 * context and nothing else: a Target that cannot be resolved is still a
 * Target to read, edit, and delete.
 */
test('a refused resolution keeps the Target readable, editable, and deletable', async () => {
  fetchResolvedTargets.mockRejectedValue({
    response: { status: 503, data: { error: { message: 'Targets are unavailable.' } } },
  });

  renderDetail();

  expect(
    await screen.findByRole('heading', { name: 'OKC vs Corner 3 ≥ 40% (v2)' }),
  ).toBeInTheDocument();
  expect(screen.getByText(/Live readings unavailable\. Targets are unavailable\./)).toBeVisible();
  expect(screen.getByText('Corner 3 ≥ 40%')).toBeVisible();
  // Nothing is claimed about the day: no reading, and no "no game" either.
  expect(screen.queryByText(/vs league/)).not.toBeInTheDocument();
  expect(screen.queryByText(/has no game on/)).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
  fireEvent.change(screen.getByLabelText('Qualifier 1 threshold percent'), {
    target: { value: '45' },
  });
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
  });
  expect(updateTarget).toHaveBeenCalledWith(
    expect.objectContaining({
      qualifiers: [
        { base: 'shot_zones', sliceKey: 'Corner 3', comparator: 'at_or_above', threshold: 0.45 },
      ],
    }),
  );

  fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Yes, delete' }));
  });
  expect(deleteTarget).toHaveBeenCalledWith({ id: 7 });
});

/*
 * The list is what the Target is. Without it there is nothing to show, so the
 * page refuses rather than rendering a Target it cannot manage.
 */
test('a refused list read is the failure that stops the page', async () => {
  fetchTargets.mockRejectedValue({
    response: { status: 503, data: { error: { message: 'Targets are unavailable.' } } },
  });

  renderDetail();

  expect(await screen.findByRole('alert')).toHaveTextContent('Targets are unavailable.');
  expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
});

/*
 * The backtest is a league-wide game-log scan, so the page that can be opened
 * to read a Target must not pay for one nobody asked for.
 */
test('the backtest is not read until the disclosure is opened, and is read once', async () => {
  let publish;
  fetchTargetBacktest.mockReturnValue(
    new Promise((resolve) => {
      publish = resolve;
    }),
  );
  renderDetail();

  const toggle = await screen.findByRole('button', { name: 'Expand backtest' });
  expect(toggle).toHaveAttribute('aria-expanded', 'false');
  expect(fetchTargetBacktest).not.toHaveBeenCalled();

  fireEvent.click(toggle);
  expect(fetchTargetBacktest).toHaveBeenCalledWith(expect.objectContaining({ id: 7 }));
  expect(screen.getByText('Reading the season…')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Collapse backtest' })).toHaveAttribute(
    'aria-expanded',
    'true',
  );

  await act(async () => {
    publish(backtest);
  });
  expect(
    screen.getByRole('table', { name: 'Backtest for OKC vs Corner 3 ≥ 40% (v2)' }),
  ).toBeVisible();

  // A backtest already in hand is kept rather than read a second time.
  fireEvent.click(screen.getByRole('button', { name: 'Collapse backtest' }));
  expect(screen.queryByRole('table')).not.toBeInTheDocument();
  await expandBacktest();
  expect(screen.getByRole('table')).toBeVisible();
  expect(fetchTargetBacktest).toHaveBeenCalledTimes(1);
});

test('an expanded backtest reads each game against the player’s own season average', async () => {
  renderDetail();
  await expandBacktest();

  expect(screen.getByText('Backtest · season to date · vs OKC')).toBeVisible();
  // Reading "points" as "corner 3s made" is exactly the mistake the note
  // exists to prevent, so it is shown rather than implied.
  expect(
    screen.getByText('Outcomes are box-score proxies; there are no per-game slice splits.'),
  ).toBeVisible();

  // The share that made him qualify, and the baseline his games are read
  // against, under the name that opens his games against this opponent.
  const player = screen.getByRole('rowheader', { name: /LeBron James/ });
  expect(player).toHaveTextContent('LAL · Corner 3 44%');
  expect(player).toHaveTextContent('season 25.4 PTS · 2.0 3PM');

  // One row per game, one cell per outcome market, each carrying how far the
  // game was from that average and in which direction.
  const over = screen.getByRole('row', { name: /2026-01-12/ });
  expect(over).toHaveTextContent('31.0');
  expect(over).toHaveTextContent('+5.6');
  expect(over).toHaveTextContent('4.0');
  expect(over).toHaveTextContent('+2.0');
  const under = screen.getByRole('row', { name: /2025-12-02/ });
  expect(under).toHaveTextContent('22.5');
  expect(under).toHaveTextContent('-2.9');
  expect(under).toHaveTextContent('1.0');
  expect(under).toHaveTextContent('-1.0');
  expect(within(over).getByText('+5.6').closest('td')).toHaveClass('is-hit');
  expect(within(under).getByText('-2.9').closest('td')).toHaveClass('is-miss');

  // A game that lands on the average is neither, and is coloured as neither.
  const level = screen.getByRole('row', { name: /2025-11-06/ });
  expect(within(level).getAllByText('0.0')).toHaveLength(2);
  within(level)
    .getAllByText('0.0')
    .forEach((difference) => {
      expect(difference.closest('td')).not.toHaveClass('is-hit');
      expect(difference.closest('td')).not.toHaveClass('is-miss');
    });
});

/*
 * A backtest travels with the Target it was run for. Labelling its rows from
 * the page's Target instead would put criteria on a table that never used
 * them — a backtest read before an edit, described by the edit.
 */
test('a backtest is labelled by the Target the backend ran it against', async () => {
  fetchTargetBacktest.mockResolvedValue(backtestOfAnotherTarget);
  renderDetail();
  await expandBacktest();

  expect(screen.getByRole('table', { name: 'Backtest for DEN vs Mid-range ≥ 50%' })).toBeVisible();
  expect(screen.getByRole('rowheader', { name: /LeBron James/ })).toHaveTextContent(
    'LAL · Mid-range 44%',
  );
  expect(screen.getByRole('link', { name: 'LeBron James games vs DEN' })).toHaveAttribute(
    'href',
    '/?player_name=LeBron+James&opponent_tricode=DEN',
  );
  // The heading names the Target being read, which is the page's own.
  expect(screen.getByText('Backtest · season to date · vs OKC')).toBeVisible();
});

/*
 * The team-side Target hands off to the player-side tools: a row is that
 * player's games against that opponent, so following it opens exactly those.
 */
test('a backtest row opens the Log Workspace with the player and the opponent fixed', async () => {
  renderDetail();
  await expandBacktest();

  expect(screen.getByRole('link', { name: 'LeBron James games vs OKC' })).toHaveAttribute(
    'href',
    '/?player_name=LeBron+James&opponent_tricode=OKC',
  );
});

test('a backtest nobody has played into says so rather than showing an empty table', async () => {
  // Named after the opponent the backtest was run against, not the one the
  // page happens to be showing.
  fetchTargetBacktest.mockResolvedValue({ ...backtestOfAnotherTarget, players: [] });
  renderDetail();
  await expandBacktest();

  expect(screen.getByText('Nobody qualifying has faced DEN yet.')).toBeVisible();
  expect(screen.queryByRole('table')).not.toBeInTheDocument();
});

/*
 * The backtest is a third read over the Target. Losing it costs the season
 * behind the idea and nothing else.
 */
test('a refused backtest leaves the rest of the Target intact and can be asked for again', async () => {
  fetchTargetBacktest.mockRejectedValue({
    response: { status: 503, data: { error: { message: 'The backtest is unavailable.' } } },
  });
  renderDetail();
  await expandBacktest();

  expect(screen.getByRole('alert')).toHaveTextContent('The backtest is unavailable.');
  expect(screen.getByRole('heading', { name: 'OKC vs Corner 3 ≥ 40% (v2)' })).toBeInTheDocument();
  expect(screen.getByText('Corner 3 ≥ 40%')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();

  // A backtest nobody can request again would be a dead end, so opening it
  // after a refusal asks for it again.
  fetchTargetBacktest.mockResolvedValue(backtest);
  fireEvent.click(screen.getByRole('button', { name: 'Collapse backtest' }));
  await expandBacktest();
  expect(screen.getByRole('table')).toBeVisible();
  expect(fetchTargetBacktest).toHaveBeenCalledTimes(2);
});
