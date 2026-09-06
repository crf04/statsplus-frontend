import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import TargetsPage from './TargetsPage';
import { createTarget, fetchResolvedTargets, fetchTargetPreview, fetchTargets } from './targetsApi';

jest.mock('./targetsApi', () => ({
  fetchTargets: jest.fn(),
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

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/targets']}>
      <TargetsPage />
      <LocationProbe />
    </MemoryRouter>,
  );

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
  const status = screen.getByRole('status');
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
  auth.isAuthenticated = true;
  auth.loading = false;
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

  const cards = await screen.findAllByRole('link', { name: /^Open / });
  expect(cards).toHaveLength(2);
  expect(cards[0]).toHaveAccessibleName('Open OKC vs Corner 3 ≥ 40% (v2)');
  expect(cards[0]).toHaveAttribute('href', '/targets/7');
  expect(cards[0]).toHaveTextContent('Corner 3 ≥ 40%');
  // The bound is set apart from the slice it applies to, not run together
  // with it, so a card can be scanned for the number alone.
  expect(within(cards[0]).getByText('≥ 40%').tagName).toBe('B');
  expect(cards[0]).toHaveTextContent('Leaks the corner late.');
  expect(cards[1]).toHaveAccessibleName('Open MIA vs Restricted area ≤ 20% (v2)');
  expect(cards[1]).toHaveTextContent('No note');
  expect(screen.getByRole('heading', { name: '2 Targets' })).toBeInTheDocument();
});

test('counts one Target as a Target rather than as Targets', async () => {
  fetchTargets.mockResolvedValue([targets[0]]);
  renderPage();

  expect(await screen.findByRole('heading', { name: '1 Target' })).toBeInTheDocument();
});

test('says so plainly when the account has no Targets yet', async () => {
  fetchTargets.mockResolvedValue([]);
  renderPage();

  expect(await screen.findByRole('heading', { name: 'No Targets yet.' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: '0 Targets' })).toBeInTheDocument();
});

test('previews the title the Qualifiers would derive', async () => {
  renderPage();
  await screen.findAllByRole('link', { name: /^Open / });

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
  await screen.findAllByRole('link', { name: /^Open / });

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
  await screen.findAllByRole('link', { name: /^Open / });
  const save = screen.getByRole('button', { name: 'Save Target' });

  expect(screen.getByLabelText('Qualifier 1 threshold percent')).toHaveValue(null);
  expect(save).toBeDisabled();

  fireEvent.change(screen.getByLabelText('Qualifier 1 threshold percent'), {
    target: { value: '40' },
  });
  expect(save).toBeEnabled();
});

test('refuses to save a threshold outside the 0-100% share range', async () => {
  renderPage();
  await screen.findAllByRole('link', { name: /^Open / });
  const save = screen.getByRole('button', { name: 'Save Target' });

  fireEvent.change(screen.getByLabelText('Qualifier 1 threshold percent'), {
    target: { value: '140' },
  });
  expect(save).toBeDisabled();
  expect(
    screen.getByText('Every threshold must be a share between 0% and 100%.'),
  ).toBeInTheDocument();

  fireEvent.change(screen.getByLabelText('Qualifier 1 threshold percent'), {
    target: { value: '0' },
  });
  expect(save).toBeEnabled();
});

test('refuses to save a Target with no Qualifier at all', async () => {
  renderPage();
  await screen.findAllByRole('link', { name: /^Open / });

  fireEvent.click(screen.getByRole('button', { name: 'Remove Qualifier 1' }));

  expect(screen.getByRole('button', { name: 'Save Target' })).toBeDisabled();
  expect(screen.getByText('Add at least one Qualifier before saving.')).toBeInTheDocument();
});

test('saves several Qualifiers as one Target and opens the Target the backend stored', async () => {
  renderPage();
  await screen.findAllByRole('link', { name: /^Open / });

  composeQualifier({ opponent: 'NOP', slice: 'Restricted Area', percent: '35' });
  fireEvent.click(screen.getByRole('button', { name: '+ Add a Qualifier' }));
  fireEvent.change(screen.getByLabelText('Qualifier 2 diet base'), {
    target: { value: 'play_types' },
  });
  fireEvent.change(screen.getByLabelText('Qualifier 2 slice'), { target: { value: 'Transition' } });
  fireEvent.change(screen.getByLabelText('Qualifier 2 threshold percent'), {
    target: { value: '15' },
  });
  fireEvent.click(screen.getAllByRole('button', { name: 'At or below' })[1]);
  fireEvent.change(screen.getByLabelText('Note · optional, never the title'), {
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
  await screen.findAllByRole('link', { name: /^Open / });

  composeQualifier();
  fireEvent.change(screen.getByLabelText('Note · optional, never the title'), {
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
  await screen.findAllByRole('link', { name: /^Open / });

  composeQualifier();
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Save Target' }));
  });

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'You already have that Target for OKC.',
  );
  expect(screen.getByLabelText('Opponent')).toHaveValue('OKC');
  expect(screen.getByLabelText('Qualifier 1 threshold percent')).toHaveValue(40);
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
  await screen.findAllByRole('link', { name: /^Open / });

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

  const live = await screen.findByRole('link', { name: 'Open OKC vs Corner 3 ≥ 40% (v2)' });
  expect(within(live).getByText('1 fit today')).toBeVisible();
  const idle = screen.getByRole('link', { name: 'Open MIA vs Restricted area ≤ 20% (v2)' });
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
    await screen.findByRole('link', { name: 'Open OKC vs Corner 3 ≥ 40% (v2)' }),
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

  expect(await screen.findByText('0 fit today')).toBeVisible();
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
  await screen.findAllByRole('link', { name: /^Open / });

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
  await screen.findAllByRole('link', { name: /^Open / });
  composeQualifier();
  await settle();
  const result = screen
    .getByRole('list', { name: 'Backtest summary' })
    .closest('.target-lab-result');

  fireEvent.change(screen.getByLabelText('Note · optional, never the title'), {
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
  await screen.findAllByRole('link', { name: /^Open / });

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
    publishers[1]({ ...preview, summary: { ...preview.summary, players: 7 } });
  });
  expect(summaryItem('Players')).toHaveTextContent('7');
});

test('an incomplete draft asks for nothing and says what to complete', async () => {
  jest.useFakeTimers();
  renderPage();
  await screen.findAllByRole('link', { name: /^Open / });

  // The blank form: a threshold has not been typed.
  expect(labStatus()).toHaveTextContent('Complete the Qualifiers to see the Backtest.');
  await settle();
  expect(fetchTargetPreview).not.toHaveBeenCalled();

  // A threshold outside the share range is not a threshold either.
  fireEvent.change(screen.getByLabelText('Qualifier 1 threshold percent'), {
    target: { value: '140' },
  });
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
  await screen.findAllByRole('link', { name: /^Open / });
  composeQualifier();
  await settle();
  const result = screen
    .getByRole('list', { name: 'Backtest summary' })
    .closest('.target-lab-result');
  expect(result).not.toHaveClass('is-stale');

  fireEvent.change(screen.getByLabelText('Qualifier 1 threshold percent'), {
    target: { value: '' },
  });
  expect(labStatus()).toHaveTextContent('Complete the Qualifiers to see the Backtest.');
  expect(result).toHaveClass('is-stale');
  expect(summaryItem('Players')).toHaveTextContent('2');
  expect(screen.getByRole('table')).toBeInTheDocument();
  await settle();
  expect(fetchTargetPreview).toHaveBeenCalledTimes(1);

  // Typed whole again as it was, it is the draft that was read: current, not
  // re-read.
  fireEvent.change(screen.getByLabelText('Qualifier 1 threshold percent'), {
    target: { value: '40' },
  });
  expect(result).not.toHaveClass('is-stale');
  await settle();
  expect(fetchTargetPreview).toHaveBeenCalledTimes(1);
});

test('the Lab leads with the summary and whether the draft fires tonight, then the games', async () => {
  jest.useFakeTimers();
  renderPage();
  await screen.findAllByRole('link', { name: /^Open / });

  composeQualifier();
  await settle();

  expect(screen.getByText('Lab · Backtest · season to date · vs OKC')).toBeVisible();
  expect(
    screen.getByText('Outcomes are box-score proxies; there are no per-game slice splits.'),
  ).toBeVisible();
  // Tonight, in one line, from the resolve rule the backend applied.
  expect(screen.getByText(/fit tonight/)).toHaveTextContent('1 fit tonight vs OKC');

  // The strip: how many players and games, then per market the mean signed
  // distance from the players' own averages, coloured by direction, and the
  // share of games over.
  expect(summaryItem('Players')).toHaveTextContent('2');
  expect(summaryItem('Games')).toHaveTextContent('5');
  expect(summaryItem('PTS')).toHaveTextContent('+2.5');
  expect(summaryItem('PTS')).toHaveTextContent('60% of games over');
  expect(within(summaryItem('PTS')).getByText('+2.5')).toHaveClass('is-hit');
  expect(summaryItem('3PM')).toHaveTextContent('-0.8');
  expect(summaryItem('3PM')).toHaveTextContent('40% of games over');
  expect(within(summaryItem('3PM')).getByText('-0.8')).toHaveClass('is-miss');

  // The same table the saved detail shows, labelled by the draft's title.
  expect(screen.getByRole('table', { name: 'Backtest for OKC vs Corner 3 ≥ 40%' })).toBeVisible();
  expect(screen.getByRole('row', { name: /2026-01-12/ })).toHaveTextContent('+5.6');
  expect(
    screen.queryByText('Complete the Qualifiers to see the Backtest.'),
  ).not.toBeInTheDocument();
});

test('the tonight line is absent when the opponent has no game', async () => {
  jest.useFakeTimers();
  fetchTargetPreview.mockResolvedValue({ ...preview, today: null });
  renderPage();
  await screen.findAllByRole('link', { name: /^Open / });

  composeQualifier();
  await settle();

  expect(summaryItem('Players')).toHaveTextContent('2');
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
  await screen.findAllByRole('link', { name: /^Open / });
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
  fireEvent.click(screen.getByRole('button', { name: 'Qualifier 1 threshold up 1%' }));
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
  expect(summaryItem('Players')).toHaveTextContent('2');
  expect(screen.getByRole('table')).toBeInTheDocument();

  await act(async () => {
    publish({ ...preview, summary: { ...preview.summary, players: 1, games: 3 } });
  });
  expect(result).not.toHaveClass('is-stale');
  expect(result).toHaveAttribute('aria-busy', 'false');
  expect(labStatus()).toHaveTextContent('Backtest up to date.');
  expect(summaryItem('Players')).toHaveTextContent('1');
  expect(summaryItem('Games')).toHaveTextContent('3');
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
  await screen.findAllByRole('link', { name: /^Open / });

  composeQualifier();
  await settle();

  expect(screen.getByRole('alert')).toHaveTextContent('That slice is not evaluable.');
  // The refusal is the answer to this draft, and is what the status says
  // until the next read replaces it — not that a read is coming.
  expect(labStatus()).toHaveTextContent('Backtest not updated.');
  await settle();
  expect(labStatus()).toHaveTextContent('Backtest not updated.');
  expect(screen.getByLabelText('Qualifier 1 threshold percent')).toHaveValue(40);
  expect(screen.getByText('OKC vs Corner 3 ≥ 40%')).toBeInTheDocument();
  const save = screen.getByRole('button', { name: 'Save Target' });
  expect(save).toBeEnabled();

  // An edit after a refusal is read again, and recovers.
  fetchTargetPreview.mockResolvedValue(preview);
  fireEvent.click(screen.getByRole('button', { name: 'Qualifier 1 threshold up 1%' }));
  expect(labStatus()).toHaveTextContent('Backtest not updated.');
  await settle();
  expect(fetchTargetPreview).toHaveBeenCalledTimes(2);
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(labStatus()).toHaveTextContent('Backtest up to date.');
  expect(summaryItem('Players')).toHaveTextContent('2');

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
test('the steppers and the arrow keys move a threshold by one percent', async () => {
  renderPage();
  await screen.findAllByRole('link', { name: /^Open / });
  const threshold = screen.getByLabelText('Qualifier 1 threshold percent');
  const up = screen.getByRole('button', { name: 'Qualifier 1 threshold up 1%' });
  const down = screen.getByRole('button', { name: 'Qualifier 1 threshold down 1%' });

  composeQualifier();
  fireEvent.click(up);
  expect(threshold).toHaveValue(41);
  // The title follows the nudge, as it follows typing.
  expect(screen.getByText('OKC vs Corner 3 ≥ 41%')).toBeInTheDocument();
  fireEvent.click(down);
  fireEvent.click(down);
  expect(threshold).toHaveValue(39);

  fireEvent.keyDown(threshold, { key: 'ArrowUp' });
  expect(threshold).toHaveValue(40);
  fireEvent.keyDown(threshold, { key: 'ArrowDown' });
  fireEvent.keyDown(threshold, { key: 'ArrowDown' });
  expect(threshold).toHaveValue(38);

  // A decimal keeps its decimal; the bounds hold; a blank field starts at zero.
  fireEvent.change(threshold, { target: { value: '40.5' } });
  fireEvent.click(up);
  expect(threshold).toHaveValue(41.5);
  fireEvent.change(threshold, { target: { value: '100' } });
  fireEvent.click(up);
  expect(threshold).toHaveValue(100);
  fireEvent.change(threshold, { target: { value: '0' } });
  fireEvent.click(down);
  expect(threshold).toHaveValue(0);
  fireEvent.change(threshold, { target: { value: '' } });
  fireEvent.keyDown(threshold, { key: 'ArrowUp' });
  expect(threshold).toHaveValue(1);
});
