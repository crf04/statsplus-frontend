import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import TargetsPage from './TargetsPage';
import {
  createTarget,
  fetchResolvedTargets,
  fetchTargetPreview,
  fetchTargets,
  fetchDietBaselines,
  fetchTargetBacktest,
  fetchSeasonMinutes,
} from './targetsApi';

jest.mock('./targetsApi', () => ({
  fetchTargetBacktest: jest.fn(),
  fetchSeasonMinutes: jest.fn(),
  fetchTargets: jest.fn(),
  fetchDietBaselines: jest.fn(),
  fetchResolvedTargets: jest.fn(),
  fetchTargetPreview: jest.fn(),
  createTarget: jest.fn(),
}));

const auth = { isAuthenticated: true, loading: false };
jest.mock('../contexts/AuthContext', () => ({
  useAuth: () => auth,
}));

/*
 * The stored title is the backend's, and it is deliberately not the string
 * these Qualifiers would derive. A card that displayed a locally derived title
 * would pass a matching fixture and still be wrong.
 */
const targets = [
  {
    id: 7,
    opponent: 'OKC',
    title: 'OKC vs Corner 3 ≥ 40% (v2)',
    note: 'Leaks the corner late.',
    createdAt: '2026-04-08T23:30:00Z',
    qualifiers: [
      { base: 'shot_zones', sliceKey: 'Corner 3', comparator: 'at_or_above', threshold: 0.4 },
    ],
  },
  {
    id: 8,
    opponent: 'MIA',
    title: 'MIA vs Restricted area ≤ 20% (v2)',
    note: '',
    createdAt: '2026-04-08T23:30:00Z',
    qualifiers: [
      {
        base: 'shot_zones',
        sliceKey: 'Restricted Area',
        comparator: 'at_or_below',
        threshold: 0.2,
      },
    ],
  },
];

const queuedTargets = [
  ...targets,
  { ...targets[0], id: 10, title: 'CHI vs Corner 3 ≥ 40% (v2)' },
  { ...targets[1], id: 11, title: 'PHX vs Restricted area ≤ 20% (v2)' },
];

const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
};

/*
 * What today makes of each saved Target, read against the current Slate Date.
 * The first has a game and one fit; the second's opponent is not playing.
 */
const resolution = {
  slateDate: '2026-04-09',
  entries: [
    {
      target: targets[0],
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
    },
    {
      target: targets[1],
      game: null,
      availability: { status: 'unavailable', source: null, unavailableReason: 'opponent_idle' },
      context: [],
      players: [],
    },
  ],
};

/*
 * What the Lab reads for a draft: the backtest a saved Target would have, with
 * the draft echoed back under its derived title, and whether it fires tonight.
 * The figures are the backend's; the strip reads them at one decimal and
 * colours them by direction.
 */
const preview = {
  target: {
    opponent: 'OKC',
    title: 'OKC vs Corner 3 ≥ 40%',
    note: '',
    qualifiers: [
      { base: 'shot_zones', sliceKey: 'Corner 3', comparator: 'at_or_above', threshold: 0.4 },
    ],
  },
  proxy: 'Outcomes are box-score proxies; there are no per-game slice splits.',
  statColumns: ['PTS', '3PM'],
  summary: {
    players: 2,
    games: 5,
    columns: {
      PTS: { meanDifference: 2.46, overAverageShare: 0.6 },
      '3PM': { meanDifference: -0.8, overAverageShare: 0.4 },
    },
  },
  players: [
    {
      canonicalId: 2544,
      name: 'LeBron James',
      tricode: 'LAL',
      shares: [{ share: 0.44, leagueAverageShare: 0.2 }],
      seasonAverages: { PTS: 25.4, '3PM': 2 },
      games: [{ gameDate: '2026-01-12', stats: { PTS: 31, '3PM': 4 } }],
    },
  ],
  today: {
    game: resolution.entries[0].game,
    fitCount: 1,
  },
};

const storedTarget = { ...targets[0], id: 9, title: 'A title only the backend could have written' };

// A plain span, so the Lab's status line is the page's one live region.
const LocationProbe = () => <span data-testid="location">{useLocation().pathname}</span>;

const renderPage = (compose = true) => {
  const result = render(
    <MemoryRouter initialEntries={['/targets']}>
      <TargetsPage />
      <LocationProbe />
    </MemoryRouter>,
  );
  if (compose && screen.queryByRole('button', { name: '+ New Target' }))
    fireEvent.click(screen.getByRole('button', { name: '+ New Target' }));
  return result;
};

const summaryItem = (label) =>
  within(screen.getByRole('list', { name: 'Backtest summary' })).getByRole('listitem', {
    name: label,
  });

const settle = () =>
  act(async () => {
    jest.advanceTimersByTime(600);
  });

/*
 * The Lab's one live region: what a screen reader is told. It has to be a
 * status role of its own, and sit outside the busy results, or nothing is
 * announced while they load.
 */
const labStatus = () => {
  const status = within(screen.getByRole('region', { name: /Lab · Backtest/ })).getByRole('status');
  expect(status.closest('[aria-busy]')).toBeNull();
  return status;
};

const composeQualifier = ({ opponent = 'OKC', slice = 'Corner 3', percent = '40' } = {}) => {
  fireEvent.change(screen.getByLabelText('Opponent'), { target: { value: opponent } });
  fireEvent.change(screen.getByLabelText('Qualifier 1 slice'), { target: { value: slice } });
  fireEvent.change(screen.getByLabelText('Qualifier 1 threshold percent'), {
    target: { value: percent },
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  fetchDietBaselines.mockResolvedValue({ shares: {} });
  auth.isAuthenticated = true;
  auth.loading = false;
  fetchTargetBacktest.mockImplementation(() => new Promise(() => {}));
  fetchTargets.mockResolvedValue(targets);
  fetchResolvedTargets.mockResolvedValue(resolution);
  fetchTargetPreview.mockResolvedValue(preview);
  createTarget.mockResolvedValue(storedTarget);
});

afterEach(() => {
  jest.useRealTimers();
});

test('shows every saved Target as a card carrying the stored title, Qualifiers, and note', async () => {
  renderPage();

  const cards = await screen.findAllByRole('article');
  expect(cards).toHaveLength(2);
  expect(cards[0]).toHaveAccessibleName('OKC vs Corner 3 ≥ 40% (v2)');
  expect(within(cards[0]).getByRole('link', { name: 'View Details / Edit' })).toHaveAttribute(
    'href',
    '/targets/7',
  );
  expect(cards[0]).toHaveTextContent('Corner 3 ≥ 40%');
  // The bound is set apart from the slice it applies to, not run together
  // with it, so a card can be scanned for the number alone.
  expect(within(cards[0]).getByText('≥ 40%').tagName).toBe('B');
  expect(cards[0]).toHaveTextContent('Leaks the corner late.');
  expect(cards[1]).toHaveAccessibleName('MIA vs Restricted area ≤ 20% (v2)');
  expect(cards[1]).not.toHaveTextContent('No note');
  expect(screen.getByText('1 Target active today')).toBeInTheDocument();
});

test('counts one Target as a Target rather than as Targets', async () => {
  fetchTargets.mockResolvedValue([targets[0]]);
  renderPage();

  expect(await screen.findByText('1 Target active today')).toBeInTheDocument();
});

test('says so plainly when the account has no Targets yet', async () => {
  fetchTargets.mockResolvedValue([]);
  renderPage();

  expect(await screen.findByRole('heading', { name: 'No Targets yet.' })).toBeInTheDocument();
  expect(screen.getByText('1 Target active today')).toBeInTheDocument();
});

test('previews the title the Qualifiers would derive', async () => {
  renderPage();
  await screen.findAllByRole('article');

  composeQualifier();
  expect(screen.getByText('OKC vs Corner 3 ≥ 40%')).toBeInTheDocument();

  // The backend writes a whole percent plainly and keeps one decimal when
  // there is one, so the preview promises exactly what will be stored.
  fireEvent.change(screen.getByLabelText('Qualifier 1 threshold percent'), {
    target: { value: '40.5' },
  });
  expect(screen.getByText('OKC vs Corner 3 ≥ 40.5%')).toBeInTheDocument();
});

/*
 * The title is written to one decimal, so a share carrying more than one would
 * be stored as a number the title does not say. The preview and the saved
 * Target have to agree about what was composed.
 */
test('a threshold is stored at the same precision the title reads it at', async () => {
  renderPage();
  await screen.findAllByRole('article');

  composeQualifier({ percent: '6.25' });
  expect(screen.getByText('OKC vs Corner 3 ≥ 6.3%')).toBeInTheDocument();

  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Save Target' }));
  });

  expect(createTarget).toHaveBeenCalledWith(
    expect.objectContaining({
      qualifiers: [expect.objectContaining({ threshold: 0.063 })],
    }),
  );
});

test('the blank form is unsaveable until a threshold has been composed', async () => {
  renderPage();
  await screen.findAllByRole('article');
  const save = screen.getByRole('button', { name: 'Save Target' });

  expect(screen.getByLabelText('Qualifier 1 threshold percent')).toHaveValue('0');
  expect(save).toBeDisabled();

  fireEvent.change(screen.getByLabelText('Qualifier 1 threshold percent'), {
    target: { value: '40' },
  });
  expect(save).toBeEnabled();
});

test('slider tuning cannot set a threshold outside the share range', async () => {
  renderPage();
  await screen.findAllByRole('article');
  const threshold = screen.getByLabelText('Qualifier 1 threshold percent');
  fireEvent.change(threshold, { target: { value: '100' } });
  fireEvent.keyDown(threshold, { key: 'ArrowRight' });
  expect(Number(threshold.value)).toBeLessThanOrEqual(100);
  fireEvent.change(threshold, { target: { value: '0' } });
  fireEvent.keyDown(threshold, { key: 'ArrowLeft' });
  expect(threshold).toHaveValue('0');
});

test('refuses to save a Target with no Qualifier at all', async () => {
  renderPage();
  await screen.findAllByRole('article');

  fireEvent.click(screen.getByRole('button', { name: 'Remove Qualifier 1' }));

  expect(screen.getByRole('button', { name: 'Save Target' })).toBeDisabled();
  expect(screen.getByText('Add at least one Qualifier before saving.')).toBeInTheDocument();
});

test('saves several Qualifiers as one Target and opens the Target the backend stored', async () => {
  renderPage();
  await screen.findAllByRole('article');

  composeQualifier({ opponent: 'NOP', slice: 'Restricted Area', percent: '35' });
  fireEvent.click(screen.getByRole('button', { name: '+ and' }));
  fireEvent.click(screen.getByRole('button', { name: 'a Qualifier' }));
  fireEvent.change(screen.getByLabelText('Qualifier 2 diet base'), {
    target: { value: 'play_types' },
  });
  fireEvent.change(screen.getByLabelText('Qualifier 2 slice'), { target: { value: 'Transition' } });
  fireEvent.change(screen.getByLabelText('Qualifier 2 threshold percent'), {
    target: { value: '15' },
  });
  fireEvent.click(screen.getAllByRole('button', { name: 'At or above; switch to at or below' })[1]);
  fireEvent.change(screen.getByLabelText('Why · optional, never the title'), {
    target: { value: 'No rim protection when Missi sits.' },
  });

  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Save Target' }));
  });

  expect(createTarget).toHaveBeenCalledWith({
    opponent: 'NOP',
    note: 'No rim protection when Missi sits.',
    qualifiers: [
      {
        base: 'shot_zones',
        sliceKey: 'Restricted Area',
        comparator: 'at_or_above',
        threshold: 0.35,
      },
      { base: 'play_types', sliceKey: 'Transition', comparator: 'at_or_below', threshold: 0.15 },
    ],
  });
  // The tuned draft is now the record, and its own page is where it reads.
  expect(screen.getByTestId('location')).toHaveTextContent(/^\/targets\/9$/);
});

test('a note is stored without the whitespace it was typed with', async () => {
  renderPage();
  await screen.findAllByRole('article');

  composeQualifier();
  fireEvent.change(screen.getByLabelText('Why · optional, never the title'), {
    target: { value: '  Zone late in the shot clock.  ' },
  });
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Save Target' }));
  });

  expect(createTarget).toHaveBeenCalledWith(
    expect.objectContaining({ note: 'Zone late in the shot clock.' }),
  );
});

test('a refused duplicate reads as the backend explained it and keeps the draft', async () => {
  createTarget.mockRejectedValue({
    response: {
      status: 409,
      data: {
        error: { code: 'operation_conflict', message: 'You already have that Target for OKC.' },
      },
    },
  });
  renderPage();
  await screen.findAllByRole('article');

  composeQualifier();
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Save Target' }));
  });

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'You already have that Target for OKC.',
  );
  expect(screen.getByLabelText('Opponent')).toHaveValue('OKC');
  expect(screen.getByLabelText('Qualifier 1 threshold percent')).toHaveValue('40');
  expect(fetchTargets).toHaveBeenCalledTimes(1);
});

/*
 * A full account is refused by the same status as a duplicate but for a
 * different reason, and only the backend knows the cap, so its sentence is the
 * one the reader sees.
 */
test('a refused save against a full account reads as the backend explained it', async () => {
  createTarget.mockRejectedValue({
    response: {
      status: 409,
      data: {
        error: {
          code: 'operation_conflict',
          message: 'You have reached the limit of 50 Targets.',
        },
      },
    },
  });
  renderPage();
  await screen.findAllByRole('article');

  composeQualifier();
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Save Target' }));
  });

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'You have reached the limit of 50 Targets.',
  );
});

test('a rejected list read stays readable rather than showing an empty account', async () => {
  fetchTargets.mockRejectedValue({
    response: {
      status: 503,
      data: { error: { code: 'provider_unavailable', message: 'Targets are unavailable.' } },
    },
  });
  renderPage();

  await waitFor(() =>
    expect(screen.getByRole('alert')).toHaveTextContent('Targets are unavailable.'),
  );
  expect(screen.queryByRole('heading', { name: 'No Targets yet.' })).not.toBeInTheDocument();
});

test('signed out, the page asks for sign-in the way the slate does', () => {
  auth.isAuthenticated = false;
  renderPage();

  expect(screen.getByRole('heading', { name: 'Sign in to view your Targets' })).toBeInTheDocument();
  expect(fetchTargets).not.toHaveBeenCalled();
});

test('a card says what today makes of its Target', async () => {
  renderPage();

  const live = await screen.findByRole('article', { name: 'OKC vs Corner 3 ≥ 40% (v2)' });
  expect(within(live).getByText(/LeBron James/)).toBeVisible();
  const idle = screen.getByRole('article', { name: 'MIA vs Restricted area ≤ 20% (v2)' });
  expect(within(idle).getByText('no game today')).toBeVisible();
  // The count is the current Slate Date's, which the page does not name.
  expect(fetchResolvedTargets).toHaveBeenCalledWith(expect.objectContaining({ date: undefined }));
});

/*
 * The count is a second read over the same list. A day that will not resolve
 * costs the cards their counts and nothing else: the Targets are still there
 * to read and open.
 */
test('a refused resolution leaves the cards standing without a count', async () => {
  fetchResolvedTargets.mockRejectedValue({
    response: { status: 503, data: { error: { message: 'Targets are unavailable.' } } },
  });

  renderPage();

  expect(
    await screen.findByRole('article', { name: 'OKC vs Corner 3 ≥ 40% (v2)' }),
  ).toBeInTheDocument();
  expect(screen.queryByText(/fit today/)).not.toBeInTheDocument();
  expect(screen.queryByText('no game today')).not.toBeInTheDocument();
});

test('a live Target nobody fits says so rather than staying silent', async () => {
  fetchResolvedTargets.mockResolvedValue({
    ...resolution,
    entries: [{ ...resolution.entries[0], players: [] }, resolution.entries[1]],
  });

  renderPage();

  expect(await screen.findByText('nobody meets every Qualifier')).toBeVisible();
});

/*
 * The Lab: the season behind the draft, read while it is composed. It is the
 * one read on this page that fires on a keystroke, so the first thing to prove
 * is that it waits — several quick edits are one request, made once the draft
 * has held still — and that a half-typed draft is never sent at all.
 */
test('the Lab reads a draft once it has held still, so several quick edits are one read', async () => {
  jest.useFakeTimers();
  renderPage();
  await screen.findAllByRole('article');

  composeQualifier();
  expect(fetchTargetPreview).not.toHaveBeenCalled();
  act(() => {
    jest.advanceTimersByTime(300);
  });
  fireEvent.change(screen.getByLabelText('Qualifier 1 threshold percent'), {
    target: { value: '42' },
  });
  act(() => {
    jest.advanceTimersByTime(500);
  });
  // 800 ms since the first edit, 500 ms since the last: still nothing.
  expect(fetchTargetPreview).not.toHaveBeenCalled();

  await settle();
  expect(fetchTargetPreview).toHaveBeenCalledTimes(1);
  expect(fetchTargetPreview).toHaveBeenCalledWith(
    expect.objectContaining({
      opponent: 'OKC',
      qualifiers: [
        { base: 'shot_zones', sliceKey: 'Corner 3', comparator: 'at_or_above', threshold: 0.42 },
      ],
    }),
  );
  // The note is never part of the evidence, so it is not sent for evaluation.
  expect(fetchTargetPreview.mock.calls[0][0]).not.toHaveProperty('note');
});

test('editing the note is not a new draft, so the Lab does not read again', async () => {
  jest.useFakeTimers();
  renderPage();
  await screen.findAllByRole('article');
  composeQualifier();
  await settle();
  const result = screen
    .getByRole('list', { name: 'Backtest summary' })
    .closest('.target-lab-result');

  fireEvent.change(screen.getByLabelText('Why · optional, never the title'), {
    target: { value: 'Leaks the corner late.' },
  });
  expect(result).not.toHaveClass('is-stale');
  await settle();
  expect(fetchTargetPreview).toHaveBeenCalledTimes(1);
  expect(labStatus()).toHaveTextContent('Backtest up to date.');
});

/*
 * The draft can move on while a read for the old one is still in flight —
 * waiting on a token, say. That read is abandoned the moment the draft
 * changes, and if its answer arrives anyway it is not the draft's and is not
 * shown.
 */
test('a read for a draft that has moved on is abandoned, and its late answer is not shown', async () => {
  jest.useFakeTimers();
  const publishers = [];
  fetchTargetPreview.mockImplementation(
    () =>
      new Promise((resolve) => {
        publishers.push(resolve);
      }),
  );
  renderPage();
  await screen.findAllByRole('article');

  composeQualifier();
  await settle();
  expect(fetchTargetPreview).toHaveBeenCalledTimes(1);
  const first = fetchTargetPreview.mock.calls[0][0].signal;
  expect(first.aborted).toBe(false);

  // Edited again before the first answer: the first read is abandoned at once.
  fireEvent.change(screen.getByLabelText('Qualifier 1 threshold percent'), {
    target: { value: '45' },
  });
  expect(first.aborted).toBe(true);
  expect(fetchTargetPreview).toHaveBeenCalledTimes(1);

  await act(async () => {
    publishers[0](preview);
  });
  expect(screen.queryByRole('list', { name: 'Backtest summary' })).not.toBeInTheDocument();

  // The second read is the draft's, and its answer is the one shown.
  await settle();
  expect(fetchTargetPreview).toHaveBeenCalledTimes(2);
  expect(fetchTargetPreview.mock.calls[1][0].qualifiers[0].threshold).toBe(0.45);
  await act(async () => {
    publishers[1]({ ...preview, players: [] });
  });
  expect(summaryItem('Player-games')).toHaveTextContent('0');
});

test('an incomplete draft asks for nothing and says what to complete', async () => {
  jest.useFakeTimers();
  renderPage();
  await screen.findAllByRole('article');

  // The blank form: a threshold has not been typed.
  expect(labStatus()).toHaveTextContent('Complete the Qualifiers to see the Backtest.');
  await settle();
  expect(fetchTargetPreview).not.toHaveBeenCalled();

  // And a draft with no Qualifier at all has nothing to evaluate.
  fireEvent.click(screen.getByRole('button', { name: 'Remove Qualifier 1' }));
  await settle();
  expect(fetchTargetPreview).not.toHaveBeenCalled();
  expect(screen.getByText('Complete the Qualifiers to see the Backtest.')).toBeVisible();
});

/*
 * A keystroke never blanks the screen, and clearing a field to retype it is a
 * keystroke. The evidence that was on screen stays, dimmed, under the line
 * that says what would make the draft whole again.
 */
test('a draft that stops being complete keeps the last evidence, dimmed', async () => {
  jest.useFakeTimers();
  renderPage();
  await screen.findAllByRole('article');
  composeQualifier();
  await settle();
  const result = screen
    .getByRole('list', { name: 'Backtest summary' })
    .closest('.target-lab-result');
  expect(result).not.toHaveClass('is-stale');

  fireEvent.click(screen.getByRole('button', { name: 'Remove Qualifier 1' }));
  expect(labStatus()).toHaveTextContent('Complete the Qualifiers to see the Backtest.');
  expect(result).toHaveClass('is-stale');
  expect(summaryItem('Player-games')).toHaveTextContent('1');
  expect(screen.getByRole('list', { name: /oldest to newest/ })).toBeInTheDocument();
  await settle();
  expect(fetchTargetPreview).toHaveBeenCalledTimes(1);

  // Typed whole again as it was, it is the draft that was read: current, not
  // re-read.
  fireEvent.click(screen.getByRole('button', { name: '+ and' }));
  fireEvent.click(screen.getByRole('button', { name: 'a Qualifier' }));
  composeQualifier();
  expect(result).not.toHaveClass('is-stale');
  await settle();
  expect(fetchTargetPreview).toHaveBeenCalledTimes(1);
});

test('the Lab leads with the summary and whether the draft fires tonight, then the games', async () => {
  jest.useFakeTimers();
  renderPage();
  await screen.findAllByRole('article');

  composeQualifier();
  await settle();

  expect(screen.getByText('Lab · Backtest · season to date · vs OKC')).toBeVisible();
  fireEvent.click(screen.getByText('PTS vs the player’s own season average'));
  expect(
    screen.getByText('Outcomes are box-score proxies; there are no per-game slice splits.'),
  ).toBeVisible();
  // Tonight, in one line, from the resolve rule the backend applied.
  expect(screen.getByText(/fit tonight/)).toHaveTextContent('1 fit tonight vs OKC');

  // Read the actual game's margin against this player's season, not the legacy proxy summary.
  expect(summaryItem('Player-games')).toHaveTextContent('1');
  expect(summaryItem('PTS')).toHaveTextContent('+5.6 PTS/game');
  expect(summaryItem('PTS')).toHaveTextContent('Hit rate 100%');
  expect(summaryItem('3PM')).toHaveTextContent('+2.0 3PM/game');
  expect(summaryItem('3PM')).toHaveTextContent('Hit rate 100%');
  expect(screen.getByRole('list', { name: /oldest to newest/ })).toBeVisible();
  expect(screen.getByRole('listitem', { name: /2026-01-12/ })).toHaveAttribute(
    'title',
    expect.stringContaining('+5.6 margin'),
  );
  expect(
    screen.queryByText('Complete the Qualifiers to see the Backtest.'),
  ).not.toBeInTheDocument();
});

test('the tonight line is absent when the opponent has no game', async () => {
  jest.useFakeTimers();
  fetchTargetPreview.mockResolvedValue({ ...preview, today: null });
  renderPage();
  await screen.findAllByRole('article');

  composeQualifier();
  await settle();

  expect(summaryItem('Player-games')).toHaveTextContent('1');
  expect(screen.queryByText(/fit tonight/)).not.toBeInTheDocument();
});

/*
 * A keystroke never blanks the screen. The result on screen describes the
 * draft it was read for, so once the draft moves on it reads as stale, and
 * stays until the next answer replaces it.
 */
test('a nudged draft keeps the last result on screen, dimmed, until the next one lands', async () => {
  jest.useFakeTimers();
  renderPage();
  await screen.findAllByRole('article');
  composeQualifier();
  await settle();
  const result = screen
    .getByRole('list', { name: 'Backtest summary' })
    .closest('.target-lab-result');
  expect(result).not.toHaveClass('is-stale');

  let publish;
  fetchTargetPreview.mockReturnValue(
    new Promise((resolve) => {
      publish = resolve;
    }),
  );
  fireEvent.keyDown(screen.getByLabelText('Qualifier 1 threshold percent'), { key: 'ArrowRight' });
  // Stale from the edit, before the read has even started — and said aloud,
  // since a dimmed table is silent to a screen reader.
  expect(result).toHaveClass('is-stale');
  expect(labStatus()).toHaveTextContent('Draft changed · reading shortly…');
  expect(fetchTargetPreview).toHaveBeenCalledTimes(1);

  await settle();
  expect(fetchTargetPreview).toHaveBeenCalledTimes(2);
  expect(fetchTargetPreview).toHaveBeenLastCalledWith(
    expect.objectContaining({ qualifiers: [expect.objectContaining({ threshold: 0.41 })] }),
  );
  expect(result).toHaveAttribute('aria-busy', 'true');
  // Announced from outside the busy results, or it would not be announced.
  expect(labStatus()).toHaveTextContent('Reading the season…');
  expect(result).toHaveClass('is-stale');
  expect(summaryItem('Player-games')).toHaveTextContent('1');
  expect(screen.getByRole('list', { name: /oldest to newest/ })).toBeInTheDocument();

  await act(async () => {
    publish({ ...preview, players: [] });
  });
  expect(result).not.toHaveClass('is-stale');
  expect(result).toHaveAttribute('aria-busy', 'false');
  expect(labStatus()).toHaveTextContent('Backtest up to date.');
  expect(summaryItem('Player-games')).toHaveTextContent('0');
  expect(summaryItem('Player-games')).toHaveTextContent('0');
});

/*
 * The Lab is evidence, not a gate. A read the backend refuses says so and
 * leaves the form and Save exactly as they were.
 */
test('a refused read says so and leaves the draft and Save usable', async () => {
  jest.useFakeTimers();
  fetchTargetPreview.mockRejectedValue({
    response: {
      status: 400,
      data: { error: { code: 'invalid_input', message: 'That slice is not evaluable.' } },
    },
  });
  renderPage();
  await screen.findAllByRole('article');

  composeQualifier();
  await settle();

  expect(screen.getByRole('alert')).toHaveTextContent('That slice is not evaluable.');
  // The refusal is the answer to this draft, and is what the status says
  // until the next read replaces it — not that a read is coming.
  expect(labStatus()).toHaveTextContent('Backtest not updated.');
  await settle();
  expect(labStatus()).toHaveTextContent('Backtest not updated.');
  expect(screen.getByLabelText('Qualifier 1 threshold percent')).toHaveValue('40');
  expect(screen.getByText('OKC vs Corner 3 ≥ 40%')).toBeInTheDocument();
  const save = screen.getByRole('button', { name: 'Save Target' });
  expect(save).toBeEnabled();

  // An edit after a refusal is read again, and recovers.
  fetchTargetPreview.mockResolvedValue(preview);
  fireEvent.keyDown(screen.getByLabelText('Qualifier 1 threshold percent'), { key: 'ArrowRight' });
  expect(labStatus()).toHaveTextContent('Backtest not updated.');
  await settle();
  expect(fetchTargetPreview).toHaveBeenCalledTimes(2);
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(labStatus()).toHaveTextContent('Backtest up to date.');
  expect(summaryItem('Player-games')).toHaveTextContent('1');

  await act(async () => {
    fireEvent.click(save);
  });
  expect(createTarget).toHaveBeenCalledWith(
    expect.objectContaining({ qualifiers: [expect.objectContaining({ threshold: 0.41 })] }),
  );
  expect(screen.getByTestId('location')).toHaveTextContent(/^\/targets\/9$/);
});

/*
 * Tuning is a series of small moves: one whole percent either way, from the
 * steppers or the arrow keys, clamped to the share range and keeping whatever
 * decimal was typed.
 */
test('the arrow keys move a threshold by one percent', async () => {
  renderPage();
  await screen.findAllByRole('article');
  const threshold = screen.getByLabelText('Qualifier 1 threshold percent');

  composeQualifier();
  fireEvent.keyDown(threshold, { key: 'ArrowRight' });
  expect(threshold).toHaveValue('41');
  // The title follows the nudge, as it follows typing.
  expect(screen.getByText('OKC vs Corner 3 ≥ 41%')).toBeInTheDocument();
  fireEvent.keyDown(threshold, { key: 'ArrowLeft' });
  fireEvent.keyDown(threshold, { key: 'ArrowLeft' });
  expect(threshold).toHaveValue('39');

  fireEvent.keyDown(threshold, { key: 'ArrowUp' });
  expect(threshold).toHaveValue('40');
  fireEvent.keyDown(threshold, { key: 'ArrowDown' });
  fireEvent.keyDown(threshold, { key: 'ArrowDown' });
  expect(threshold).toHaveValue('38');

  // A decimal keeps its decimal; the bounds hold; a blank field starts at zero.
  fireEvent.change(threshold, { target: { value: '40.5' } });
  fireEvent.keyDown(threshold, { key: 'ArrowRight' });
  expect(threshold).toHaveValue('41.5');
  for (let step = 0; step < 100; step += 1) fireEvent.keyDown(threshold, { key: 'ArrowRight' });
  expect(threshold).toHaveValue('100');
  fireEvent.change(threshold, { target: { value: '0' } });
  fireEvent.keyDown(threshold, { key: 'ArrowLeft' });
  expect(threshold).toHaveValue('0');
  fireEvent.change(threshold, { target: { value: '0' } });
  fireEvent.keyDown(threshold, { key: 'ArrowUp' });
  expect(threshold).toHaveValue('1');
});

test('the collection opens with an active-today line and a deliberately closed composer', async () => {
  renderPage(false);
  expect(await screen.findByText('1 Target active today')).toBeVisible();
  expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Opponent')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '+ New Target' }));
  expect(screen.getByLabelText('Opponent')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(screen.queryByLabelText('Opponent')).not.toBeInTheDocument();
});

test('cards state tonight’s fits as pills and keep criteria and logs read-only', async () => {
  renderPage(false);
  const card = await screen.findByRole('article', { name: targets[0].title });
  expect(within(card).getByRole('link', { name: /LAL @ OKC/ })).toHaveAttribute(
    'href',
    '/matchups/0022500584',
  );
  expect(within(card).getByRole('link', { name: 'View Details / Edit' })).toHaveAttribute('href', '/targets/7');
  expect(within(card).getByRole('listitem')).toHaveTextContent('44%');
  expect(within(card).getByRole('listitem')).toHaveTextContent('25.4 ppg');
  expect(within(card).queryByRole('spinbutton')).not.toBeInTheDocument();
  expect(within(card).queryByRole('table')).not.toBeInTheDocument();
});

test('Backtests start two reads and refill the queue when one settles', async () => {
  fetchTargets.mockResolvedValue(queuedTargets.slice(0, 3));
  const reads = [deferred(), deferred(), deferred()];
  fetchTargetBacktest.mockImplementation(
    ({ id }) => reads[id === 7 ? 0 : id === 8 ? 1 : 2].promise,
  );
  renderPage(false);

  await waitFor(() => expect(fetchTargetBacktest).toHaveBeenCalledTimes(2));
  expect(fetchTargetBacktest.mock.calls.map(([request]) => request.id)).toEqual([7, 8]);
  expect(screen.queryByRole('article', { name: queuedTargets[2].title })).toBeInTheDocument();

  await act(async () => reads[1].resolve(preview));
  await waitFor(() => expect(fetchTargetBacktest).toHaveBeenCalledTimes(3));
  expect(fetchTargetBacktest.mock.calls.map(([request]) => request.id)).toEqual([7, 8, 10]);
  expect(screen.getAllByRole('list', { name: 'Backtest summary' })).toHaveLength(1);
  expect(screen.queryByRole('table')).not.toBeInTheDocument();
});

test('a failed Backtest frees a slot for every queued card', async () => {
  fetchTargets.mockResolvedValue(queuedTargets);
  const reads = new Map(queuedTargets.map((target) => [target.id, deferred()]));
  fetchTargetBacktest.mockImplementation(({ id }) => reads.get(id).promise);
  renderPage(false);

  await waitFor(() => expect(fetchTargetBacktest).toHaveBeenCalledTimes(2));
  await act(async () => reads.get(7).reject(new Error('failed 7')));
  await waitFor(() => expect(fetchTargetBacktest).toHaveBeenCalledTimes(3));
  await act(async () => reads.get(8).reject(new Error('failed 8')));
  await waitFor(() => expect(fetchTargetBacktest).toHaveBeenCalledTimes(4));

  expect(fetchTargetBacktest.mock.calls.map(([request]) => request.id)).toEqual([7, 8, 10, 11]);
  expect(await screen.findByText('failed 7')).toBeVisible();
  expect(await screen.findByText('failed 8')).toBeVisible();

  await act(async () => {
    reads.get(10).resolve(preview);
    reads.get(11).resolve(preview);
  });
  expect(await screen.findAllByRole('list', { name: 'Backtest summary' })).toHaveLength(2);
});

test('unavailable pools are explicit, while idle Targets do not count as active', async () => {
  fetchResolvedTargets.mockResolvedValue({
    ...resolution,
    entries: [
      { ...resolution.entries[0], availability: { status: 'unavailable' }, players: [] },
      resolution.entries[1],
    ],
  });
  renderPage(false);
  expect(await screen.findByText('pool unavailable')).toBeVisible();
  expect(screen.queryByText('nobody meets every Qualifier')).not.toBeInTheDocument();
  expect(screen.getByText('1 Target active today')).toBeVisible();
});

test('no active Targets says so without calling an unresolved read zero', async () => {
  fetchResolvedTargets.mockResolvedValue({ ...resolution, entries: [resolution.entries[1]] });
  renderPage(false);
  expect(await screen.findByText('No Targets active today')).toBeVisible();
});

test('thin evidence stays visible as a dashed fit pill', async () => {
  fetchResolvedTargets.mockResolvedValue({
    ...resolution,
    entries: [
      { ...resolution.entries[0], players: [{ ...resolution.entries[0].players[0], thin: true }] },
    ],
  });
  renderPage(false);
  expect(await screen.findByText(/thin evidence/)).toBeVisible();
  expect(screen.getByText('LeBron James').closest('li')).toHaveClass('is-thin');
});

test('signing out aborts active reads and leaves queued cards untouched', async () => {
  fetchTargets.mockResolvedValue(queuedTargets.slice(0, 3));
  const reads = [deferred(), deferred()];
  fetchTargetBacktest
    .mockImplementationOnce(() => reads[0].promise)
    .mockImplementationOnce(() => reads[1].promise);
  const view = renderPage(false);
  await waitFor(() => expect(fetchTargetBacktest).toHaveBeenCalledTimes(2));
  const signals = fetchTargetBacktest.mock.calls.map(([request]) => request.signal);

  auth.isAuthenticated = false;
  await act(async () => {
    view.rerender(
      <MemoryRouter initialEntries={['/targets']}>
        <TargetsPage />
        <LocationProbe />
      </MemoryRouter>,
    );
  });

  expect(signals.every((signal) => signal.aborted)).toBe(true);
  expect(
    await screen.findByRole('heading', { name: 'Sign in to view your Targets' }),
  ).toBeVisible();
  await act(async () => {
    reads[0].resolve(preview);
    reads[1].resolve(preview);
  });
  expect(fetchTargetBacktest).toHaveBeenCalledTimes(2);
  expect(screen.queryByRole('article')).not.toBeInTheDocument();
});

test('late old reads cannot overwrite a fresh authenticated read after sign-in', async () => {
  const oldReads = [deferred(), deferred()];
  const freshReads = [deferred(), deferred()];
  const freshBacktest = {
    ...preview,
    players: [
      {
        ...preview.players[0],
        games: [
          ...preview.players[0].games,
          { gameDate: '2026-01-13', stats: { PTS: 29, '3PM': 3 } },
        ],
      },
    ],
  };
  const reads = [...oldReads, ...freshReads];
  let nextRead = 0;
  fetchTargetBacktest.mockImplementation(() => reads[nextRead++].promise);
  const view = renderPage(false);

  await waitFor(() => expect(fetchTargetBacktest).toHaveBeenCalledTimes(2));
  const oldSignals = fetchTargetBacktest.mock.calls.map(([request]) => request.signal);

  auth.isAuthenticated = false;
  await act(async () => {
    view.rerender(
      <MemoryRouter initialEntries={['/targets']}>
        <TargetsPage />
        <LocationProbe />
      </MemoryRouter>,
    );
  });
  expect(
    await screen.findByRole('heading', { name: 'Sign in to view your Targets' }),
  ).toBeVisible();
  expect(oldSignals.every((signal) => signal.aborted)).toBe(true);

  auth.isAuthenticated = true;
  await act(async () => {
    view.rerender(
      <MemoryRouter initialEntries={['/targets']}>
        <TargetsPage />
        <LocationProbe />
      </MemoryRouter>,
    );
  });
  await waitFor(() => expect(fetchTargetBacktest).toHaveBeenCalledTimes(4));

  await act(async () => {
    freshReads[0].resolve(freshBacktest);
    freshReads[1].resolve(freshBacktest);
  });
  const firstCard = await screen.findByRole('article', { name: targets[0].title });
  const secondCard = screen.getByRole('article', { name: targets[1].title });
  expect(
    within(within(firstCard).getByRole('list', { name: 'Backtest summary' })).getByRole(
      'listitem',
      {
        name: 'Player-games',
      },
    ),
  ).toHaveTextContent(/2\s*player-games/);
  expect(
    within(within(secondCard).getByRole('list', { name: 'Backtest summary' })).getByRole(
      'listitem',
      { name: 'Player-games' },
    ),
  ).toHaveTextContent(/2\s*player-games/);

  await act(async () => {
    oldReads[0].resolve(preview);
    oldReads[1].reject(new Error('stale old failure'));
  });
  expect(
    within(within(firstCard).getByRole('list', { name: 'Backtest summary' })).getByRole(
      'listitem',
      {
        name: 'Player-games',
      },
    ),
  ).toHaveTextContent(/2\s*player-games/);
  expect(screen.queryByText('stale old failure')).not.toBeInTheDocument();
});

test('unmounting the list aborts both active reads and never starts the queue', async () => {
  fetchTargets.mockResolvedValue(queuedTargets.slice(0, 3));
  const reads = [deferred(), deferred()];
  fetchTargetBacktest
    .mockImplementationOnce(() => reads[0].promise)
    .mockImplementationOnce(() => reads[1].promise);
  const view = renderPage(false);

  await waitFor(() => expect(fetchTargetBacktest).toHaveBeenCalledTimes(2));
  const signals = fetchTargetBacktest.mock.calls.map(([request]) => request.signal);
  view.unmount();

  expect(signals.every((signal) => signal.aborted)).toBe(true);
  await act(async () => {
    reads[0].resolve(preview);
    reads[1].resolve(preview);
  });
  expect(fetchTargetBacktest).toHaveBeenCalledTimes(2);
});

test('saved cards show their Condition as a read-only chip', async () => {
  fetchTargets.mockResolvedValue([
    {
      ...targets[0],
      conditions: {
        defender: { playerId: 27, comparator: 'under', minutes: 8 },
        from: null,
        to: null,
      },
    },
  ]);
  fetchSeasonMinutes.mockResolvedValue({
    season: '2025-26',
    players: [{ playerId: 27, name: 'Rudy Gobert', averageMinutes: 32, gamesPlayed: 60 }],
  });
  const { container } = renderPage(false);
  await screen.findByText(/Rudy Gobert under/);
  expect(container.querySelector('.target-condition-chip')).toHaveTextContent(
    'Rudy Gobert under 8 min (sat out = 0)',
  );
  expect(screen.queryByLabelText('Defender')).not.toBeInTheDocument();
});

test('fit shares are labelled with the resolved criteria when the list read differs', async () => {
  fetchResolvedTargets.mockResolvedValue({
    ...resolution,
    entries: [
      {
        ...resolution.entries[0],
        target: {
          ...targets[0],
          qualifiers: [{ ...targets[0].qualifiers[0], sliceKey: 'Restricted Area' }],
        },
      },
    ],
  });
  renderPage(false);
  const fits = await screen.findByRole('region', { name: 'Playing tonight' });
  expect(within(fits).getByRole('listitem')).toHaveTextContent('Restricted area 44%');
  expect(within(fits).getByRole('listitem')).not.toHaveTextContent('Corner 3');
});

test('list cards read each Target’s persisted columns and grading independently', async () => {
  auth.currentUser = { uid: 'list-stat-reader' };
  fetchTargets.mockResolvedValue([
    { ...targets[0], statPreferences: { columns: ['PTS', 'PTS/36'], gradedBy: 'PTS/36' } },
    targets[1],
  ]);
  fetchTargetBacktest.mockResolvedValue(preview);
  renderPage(false);
  const first = await screen.findByRole('article', { name: targets[0].title });
  expect(await within(first).findByRole('list', { name: /graded by PTS\/36/ })).toBeVisible();
  const summary = within(first).getByRole('list', { name: 'Backtest summary' });
  expect(within(summary).getByRole('listitem', { name: 'PTS', exact: true })).toBeVisible();
  expect(within(summary).getByRole('listitem', { name: 'PTS/36', exact: true })).toBeVisible();
  expect(
    within(summary).queryByRole('listitem', { name: '3PM', exact: true }),
  ).not.toBeInTheDocument();
  const second = screen.getByRole('article', { name: targets[1].title });
  expect(await within(second).findByRole('list', { name: /graded by PTS margin/ })).toBeVisible();
});

test('a composer’s stat choice is saved only with the new Target', async () => {
  auth.currentUser = { uid: 'composer-stat-reader' };
  jest.useFakeTimers();
  renderPage();
  await screen.findAllByRole('article');
  composeQualifier();
  await settle();
  fireEvent.click(screen.getByRole('button', { name: 'stats ▾' }));
  fireEvent.click(screen.getByRole('checkbox', { name: 'PTS/36' }));
  fireEvent.click(screen.getByRole('button', { name: /^PTS\/36 / }));
  expect(createTarget).not.toHaveBeenCalled();
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Save Target' })));
  expect(createTarget).toHaveBeenCalledWith(
    expect.objectContaining({
      statPreferences: { columns: ['PTS', '3PM', 'PTS/36'], gradedBy: 'PTS/36' },
    }),
  );
});

test('a pending resolution states that today is being read rather than unavailable', async () => {
  fetchResolvedTargets.mockImplementation(() => new Promise(() => {}));
  renderPage(false);
  const card = await screen.findByRole('article', { name: targets[0].title });
  expect(within(card).getByText('Reading today’s activity…')).toBeVisible();
  expect(within(card).queryByText('Today’s activity unavailable')).not.toBeInTheDocument();
});

test('one page shares one roster read across same-opponent chips, then releases it', async () => {
  const conditioned = {
    ...targets[0],
    conditions: {
      defender: { playerId: 27, comparator: 'under', minutes: 8 },
      from: null,
      to: null,
    },
  };
  fetchTargets.mockResolvedValue([
    conditioned,
    { ...conditioned, id: 88, title: 'Another same-opponent Target' },
  ]);
  fetchTargetBacktest.mockResolvedValue({
    ...preview,
    target: conditioned,
    gamesConsidered: { kept: 3, played: 10 },
  });
  fetchSeasonMinutes.mockResolvedValue({
    season: '2025-26',
    players: [{ playerId: 27, name: 'Rudy Gobert', averageMinutes: 32, gamesPlayed: 60 }],
  });
  const page = renderPage(false);
  const chips = (container) => container.querySelectorAll('.target-condition-chip');
  await waitFor(() => expect(screen.getAllByText(/Rudy Gobert under/)).toHaveLength(2));
  expect(chips(page.container)).toHaveLength(2);
  expect(fetchSeasonMinutes).toHaveBeenCalledTimes(1);
  page.unmount();
  const next = renderPage(false);
  await waitFor(() => expect(screen.getAllByText(/Rudy Gobert under/)).toHaveLength(2));
  expect(chips(next.container)).toHaveLength(2);
  expect(fetchSeasonMinutes).toHaveBeenCalledTimes(2);
});

test('leaving a page aborts its shared in-flight roster request', async () => {
  fetchTargets.mockResolvedValue([
    {
      ...targets[0],
      conditions: {
        defender: { playerId: 27, comparator: 'under', minutes: 8 },
        from: null,
        to: null,
      },
    },
  ]);
  fetchSeasonMinutes.mockImplementationOnce(() => new Promise(() => {}));
  const page = renderPage(false);
  await waitFor(() => expect(fetchSeasonMinutes).toHaveBeenCalledTimes(1));
  const signal = fetchSeasonMinutes.mock.calls[0][0].signal;
  expect(signal.aborted).toBe(false);
  page.unmount();
  expect(signal.aborted).toBe(true);
});
