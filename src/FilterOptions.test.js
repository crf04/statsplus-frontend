import { fireEvent, render, screen, within } from '@testing-library/react';
import FilterOptions from './FilterOptions';
import { OPPONENT_FILTERS } from './opponentFilters';

// jsdom has no ResizeObserver, and the range sliders observe their track on
// mount. Nothing here asserts on pixel geometry, so an inert observer is enough
// to let the panel render.
global.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const renderPanel = (appliedFilters = {}) => {
  const onApplyFilters = jest.fn();
  render(
    <FilterOptions
      playerList={['LeBron James']}
      onApplyFilters={onApplyFilters}
      selectedPlayer="LeBron James"
      seasonGameLogs={[]}
      seasonGameLogsLoading={false}
      seasonGameLogsFailed={false}
      onOpenSelfFilters={jest.fn()}
      appliedFilters={appliedFilters}
    />,
  );
  return onApplyFilters;
};

// The minutes slider carries the same thumb labels, so the playtype thumbs are
// reached through their own control's label rather than by role alone.
const playstyleThumbs = () => {
  const label = screen.getByText(/^Playtype Matchup Rating:/);
  return within(label.parentElement)
    .getAllByRole('slider')
    .map((thumb) => thumb.getAttribute('aria-valuenow'));
};

const applyFilters = () => fireEvent.click(screen.getByRole('button', { name: 'Apply Filters' }));

test('the playtype thumbs stand where the link the panel opened under put them', () => {
  renderPanel({ player_name: 'LeBron James', playstyle_RTG_min: 0, playstyle_RTG_max: 80 });

  expect(playstyleThumbs()).toEqual(['0', '80']);
});

test('an untouched panel spans the API domain and applies nothing but the player', () => {
  const onApplyFilters = renderPanel();

  expect(playstyleThumbs()).toEqual(['0', '200']);

  applyFilters();

  expect(onApplyFilters).toHaveBeenCalledWith({ player_name: 'LeBron James' });
});

test('a range the link arrived with survives a later apply', () => {
  const onApplyFilters = renderPanel({
    player_name: 'LeBron James',
    playstyle_RTG_min: 0,
    playstyle_RTG_max: 80,
  });

  applyFilters();

  expect(onApplyFilters).toHaveBeenCalledWith({
    player_name: 'LeBron James',
    playstyle_RTG_min: 0,
    playstyle_RTG_max: 80,
  });
});

test('a single-bound link fills the other side with the API default and applies both', () => {
  const onApplyFilters = renderPanel({ player_name: 'LeBron James', playstyle_RTG_max: 80 });

  expect(playstyleThumbs()).toEqual(['0', '80']);

  applyFilters();

  expect(onApplyFilters).toHaveBeenCalledWith({
    player_name: 'LeBron James',
    playstyle_RTG_min: 0,
    playstyle_RTG_max: 80,
  });
});

// Mirrors the backend catalog (statsplus-backend app/models/catalogs.py,
// SUPPORTED_TEAM_FILTERS) in dropdown order. Deliberately not derived from
// src/opponentFilters.js: a token dropped from that module should fail this
// test rather than silently shrink alongside it.
const BACKEND_DEFENSIVE_FILTER_TOKENS = [
  'OPP_PTS',
  'OPP_REB',
  'OPP_AST',
  'OPP_STOCKS',
  'OPP_STL',
  'OPP_BLK',
  'OPP_FTA',
  'OPP_TOV',
  'C&S PTS',
  'C&S 3s',
  'C&S 3A',
  'PU PTS',
  'PU 2s',
  'PU 3s',
  'Less Than 10 ft',
  'OPP_FG3M',
  'OPP_FG3A',
  'Transition',
  'Isolation',
  'Spotup',
  'Handoff',
  'OffScreen',
  'Postup',
  'PRBallHandler',
  'PRRollMan',
  'Cut',
  'OffRebound',
  'Misc',
  'AtRimAssists',
  'TwoPtAssists',
  'ThreePtAssists',
  'Arc3Assists',
  'Corner3Assists',
  'ShortMidRangeAssists',
  'LongMidRangeAssists',
];

// The pill labels, paired with the slice of the literal token list above that
// each pill's category is expected to scope the select down to. The four slices
// partition BACKEND_DEFENSIVE_FILTER_TOKENS in order, so together they still
// account for the whole backend vocabulary.
const DEFENSIVE_CATEGORY_PILLS = [
  { pill: 'General', tokens: BACKEND_DEFENSIVE_FILTER_TOKENS.slice(0, 8) },
  { pill: 'Shot type', tokens: BACKEND_DEFENSIVE_FILTER_TOKENS.slice(8, 17) },
  { pill: 'Play type', tokens: BACKEND_DEFENSIVE_FILTER_TOKENS.slice(17, 28) },
  { pill: 'Assists', tokens: BACKEND_DEFENSIVE_FILTER_TOKENS.slice(28) },
];

const defensiveSelect = () => screen.getByLabelText('Defensive Filter:');

const clickCategoryPill = (name) => fireEvent.click(screen.getByRole('button', { name }));

// The player search carries an "Add" of its own, so the defensive one is
// reached through the input group it shares with the defensive select.
const defensiveAddButton = () =>
  within(defensiveSelect().closest('.input-group')).getByRole('button', { name: 'Add' });

const rankCountSlider = () => screen.getByRole('slider', { name: 'Number of teams' });

const labelForToken = (token) =>
  OPPONENT_FILTERS.flatMap((group) => group.items).find((item) => item.token === token).label;

test('each category pill scopes the defensive dropdown to its own slice of the vocabulary', () => {
  renderPanel();

  // Every category is reachable, and exactly one is active at a time.
  DEFENSIVE_CATEGORY_PILLS.forEach(({ pill }) => {
    expect(screen.getByRole('button', { name: pill })).toHaveAttribute('aria-pressed');
  });
  expect(screen.getByRole('button', { name: 'General' })).toHaveAttribute('aria-pressed', 'true');

  // The four slices together are the whole backend vocabulary, so no token is
  // left unreachable by the scoping.
  expect(DEFENSIVE_CATEGORY_PILLS.flatMap(({ tokens }) => tokens)).toEqual(
    BACKEND_DEFENSIVE_FILTER_TOKENS,
  );

  DEFENSIVE_CATEGORY_PILLS.forEach(({ pill, tokens }) => {
    clickCategoryPill(pill);

    expect(screen.getByRole('button', { name: pill })).toHaveAttribute('aria-pressed', 'true');

    // The select is flat and scoped: a leading "None", then this category's
    // tokens in order, each under its human label.
    const options = within(defensiveSelect()).getAllByRole('option');
    expect(options.map((option) => option.value)).toEqual(['None', ...tokens]);
    expect(options.map((option) => option.textContent)).toEqual([
      'None',
      ...tokens.map(labelForToken),
    ]);
    expect(within(defensiveSelect()).queryAllByRole('group')).toEqual([]);
  });

  // Spot-checks that the labels above are the human names, not the tokens.
  clickCategoryPill('General');
  expect(within(defensiveSelect()).getByRole('option', { name: 'Points Allowed' }).value).toBe(
    'OPP_PTS',
  );
  clickCategoryPill('Play type');
  expect(within(defensiveSelect()).getByRole('option', { name: 'Spot-Up' }).value).toBe('Spotup');
});

// A select whose value names no option of its own falls back to showing the
// first one, so reading "None" off the select is not on its own proof the
// selection was dropped — the stale token could still be the one Add would
// apply. Each leg below also asserts Add has nothing left to offer.
test('switching category drops a selection the new category cannot show', () => {
  renderPanel();

  // A General token does not survive the move to Shot type.
  fireEvent.change(defensiveSelect(), { target: { value: 'OPP_PTS' } });
  expect(defensiveSelect().value).toBe('OPP_PTS');
  expect(defensiveAddButton()).toBeEnabled();

  clickCategoryPill('Shot type');

  expect(defensiveSelect().value).toBe('None');
  expect(defensiveAddButton()).toBeDisabled();

  // Nor does a Shot type token survive the move back to General.
  fireEvent.change(defensiveSelect(), { target: { value: 'C&S PTS' } });
  expect(defensiveSelect().value).toBe('C&S PTS');
  expect(defensiveAddButton()).toBeEnabled();

  clickCategoryPill('General');

  expect(defensiveSelect().value).toBe('None');
  expect(defensiveAddButton()).toBeDisabled();
});

test('re-picking the category a selection belongs to leaves it selected', () => {
  renderPanel();

  fireEvent.change(defensiveSelect(), { target: { value: 'OPP_PTS' } });
  clickCategoryPill('General');

  expect(defensiveSelect().value).toBe('OPP_PTS');
  expect(defensiveAddButton()).toBeEnabled();
});

// The pill state is form state like any other: the reset-all effect that runs
// when a new applied-filters link arrives must snap it back to General too,
// not just leave the last category from the previous player's panel active.
const filterOptionsElement = (appliedFilters) => (
  <FilterOptions
    playerList={['LeBron James']}
    onApplyFilters={jest.fn()}
    selectedPlayer="LeBron James"
    seasonGameLogs={[]}
    seasonGameLogsLoading={false}
    seasonGameLogsFailed={false}
    onOpenSelfFilters={jest.fn()}
    appliedFilters={appliedFilters}
  />
);

test('a new applied-filters link resets the category pill back to General', () => {
  const { rerender } = render(filterOptionsElement({}));

  clickCategoryPill('Shot type');
  expect(screen.getByRole('button', { name: 'Shot type' })).toHaveAttribute('aria-pressed', 'true');

  rerender(filterOptionsElement({ player_name: 'LeBron James' }));

  expect(screen.getByRole('button', { name: 'General' })).toHaveAttribute('aria-pressed', 'true');
});

test('an added defensive filter wears its label, and applies as its token', () => {
  const onApplyFilters = renderPanel();

  clickCategoryPill('General');
  fireEvent.change(defensiveSelect(), { target: { value: 'OPP_PTS' } });
  fireEvent.change(rankCountSlider(), { target: { value: '5' } });
  fireEvent.click(defensiveAddButton());

  expect(screen.getByText('Points Allowed (5 highest)')).toBeInTheDocument();

  applyFilters();

  expect(onApplyFilters).toHaveBeenCalledWith({
    player_name: 'LeBron James',
    'teams_against[]': ['OPP_PTS'],
    'rank_filter[]': [5],
  });
});

/*
 * The backend sorts teams by the filter's metric, highest first, and a rank
 * slices from either end: +N is the N teams with the highest value, -N the lowest. The
 * control builds that sign from words, so a user never types one.
 */
test('the rank control is a Highest/Lowest toggle and a 1-30 count, defaulting to the 10 highest', () => {
  renderPanel();

  expect(screen.getByRole('radio', { name: 'Highest' })).toBeChecked();
  expect(screen.getByRole('radio', { name: 'Lowest' })).not.toBeChecked();
  expect(rankCountSlider()).toHaveAttribute('min', '1');
  expect(rankCountSlider()).toHaveAttribute('max', '30');
  expect(rankCountSlider()).toHaveValue('10');
  expect(screen.queryByPlaceholderText('Number')).not.toBeInTheDocument();
  expect(screen.queryByText(/Positive rank/)).not.toBeInTheDocument();
});

test('the sentence under the control names the teams Add would select', () => {
  renderPanel();

  expect(
    screen.getByText('Pick a filter to add the 10 teams with the highest value.'),
  ).toBeInTheDocument();

  fireEvent.change(defensiveSelect(), { target: { value: 'OPP_PTS' } });
  fireEvent.click(screen.getByRole('radio', { name: 'Lowest' }));
  fireEvent.change(rankCountSlider(), { target: { value: '8' } });

  expect(screen.getByText('Adds the 8 teams with the lowest Points Allowed.')).toBeInTheDocument();
});

test('a filter is addable as soon as one is picked, since every count is a usable rank', () => {
  renderPanel();

  expect(defensiveAddButton()).toBeDisabled();

  fireEvent.change(defensiveSelect(), { target: { value: 'OPP_PTS' } });

  expect(defensiveAddButton()).toBeEnabled();
});

test('lowest applies as a negative rank and wears its words on the badge', () => {
  const onApplyFilters = renderPanel();

  fireEvent.change(defensiveSelect(), { target: { value: 'OPP_PTS' } });
  fireEvent.click(defensiveAddButton());
  clickCategoryPill('Play type');
  fireEvent.change(defensiveSelect(), { target: { value: 'Transition' } });
  fireEvent.click(screen.getByRole('radio', { name: 'Lowest' }));
  fireEvent.change(rankCountSlider(), { target: { value: '8' } });
  fireEvent.click(defensiveAddButton());

  expect(screen.getByText('Points Allowed (10 highest)')).toBeInTheDocument();
  expect(screen.getByText('Transition (8 lowest)')).toBeInTheDocument();

  applyFilters();

  expect(onApplyFilters).toHaveBeenCalledWith({
    player_name: 'LeBron James',
    'teams_against[]': ['OPP_PTS', 'Transition'],
    'rank_filter[]': [10, -8],
  });
});

test('a rank arriving with a link reads as words in the panel too', () => {
  renderPanel({
    player_name: 'LeBron James',
    'teams_against[]': ['OPP_PTS'],
    'rank_filter[]': ['-10'],
  });

  expect(screen.getByText('Points Allowed (10 lowest)')).toBeInTheDocument();
});

/*
 * A specific opponent only ever arrives with the Filter Set — from a link, or
 * from a Target handing off into the Log Workspace — so the panel has no picker
 * for it. It still has to say which opponent is in force, and offer the way out.
 */
test('the panel shows the opponent the Filter Set fixes, and applies it unchanged', () => {
  const onApplyFilters = renderPanel({ player_name: 'LeBron James', opponent_tricode: 'OKC' });

  expect(screen.getByText(/vs OKC/)).toBeVisible();

  applyFilters();

  expect(onApplyFilters).toHaveBeenCalledWith({
    player_name: 'LeBron James',
    opponent_tricode: 'OKC',
  });
});

test('clearing the opponent applies a blank value instead of leaving it fixed', () => {
  const onApplyFilters = renderPanel({ player_name: 'LeBron James', opponent_tricode: 'OKC' });

  fireEvent.click(screen.getByRole('button', { name: 'Remove OKC opponent' }));

  expect(screen.queryByText(/vs OKC/)).not.toBeInTheDocument();

  applyFilters();

  expect(onApplyFilters).toHaveBeenCalledWith({
    player_name: 'LeBron James',
    opponent_tricode: null,
  });
});

test('a panel opened without an opponent offers no opponent control at all', () => {
  const onApplyFilters = renderPanel({ player_name: 'LeBron James' });

  expect(screen.queryByText('Opponent:')).not.toBeInTheDocument();

  applyFilters();

  // Not merely absent from the panel: a Filter Set that never named an opponent
  // must not acquire the parameter at all, not even as a blank one that would
  // read as a cleared opponent.
  expect(onApplyFilters).toHaveBeenCalledWith({ player_name: 'LeBron James' });
});

test('clearing a control applies a blank value instead of leaving the bound behind', () => {
  const onApplyFilters = renderPanel({ player_name: 'LeBron James', date_filter: '2026-01-09' });

  fireEvent.change(screen.getByLabelText('Date Filter:'), { target: { value: '' } });
  applyFilters();

  expect(onApplyFilters).toHaveBeenCalledWith({
    player_name: 'LeBron James',
    date_filter: null,
  });
});
