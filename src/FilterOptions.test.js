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

test('the defensive dropdown offers the whole vocabulary, grouped and labelled', () => {
  renderPanel();

  const select = screen.getByLabelText('Defensive Filter:');
  const options = within(select).getAllByRole('option');

  // The bare "None" option leads, and sits outside any optgroup.
  expect(options[0].value).toBe('None');
  expect(options[0].textContent).toBe('None');
  expect(options[0].closest('optgroup')).toBeNull();

  // The rest of the options, in order, are exactly the backend's tokens.
  expect(options.slice(1).map((option) => option.value)).toEqual(BACKEND_DEFENSIVE_FILTER_TOKENS);

  const groups = within(select).getAllByRole('group');
  expect(groups.map((group) => group.getAttribute('label'))).toEqual([
    'General defense',
    'Shot type defense',
    'Play type defense',
    'Assists allowed',
  ]);

  options.slice(1).forEach((option) => {
    expect(option.textContent).not.toBe('');
  });
  expect(within(select).getByRole('option', { name: 'Points Allowed' }).value).toBe('OPP_PTS');
  expect(within(select).getByRole('option', { name: 'Spot-Up' }).value).toBe('Spotup');

  // Kept alongside the literal assertions above: still checks the component
  // renders every group and item the vocabulary module currently declares.
  expect(groups.map((group) => group.getAttribute('label'))).toEqual(
    OPPONENT_FILTERS.map((group) => group.category),
  );
  OPPONENT_FILTERS.forEach((group, index) => {
    expect(
      within(groups[index])
        .getAllByRole('option')
        .map((option) => [option.value, option.textContent]),
    ).toEqual(group.items.map((item) => [item.token, item.label]));
  });
});

test('an added defensive filter wears its label, and applies as its token', () => {
  const onApplyFilters = renderPanel();

  const select = screen.getByLabelText('Defensive Filter:');
  fireEvent.change(select, { target: { value: 'OPP_PTS' } });
  fireEvent.change(screen.getByPlaceholderText('Number'), { target: { value: '5' } });
  fireEvent.click(within(select.closest('.input-group')).getByRole('button', { name: 'Add' }));

  expect(screen.getByText('Points Allowed (5)')).toBeInTheDocument();

  applyFilters();

  expect(onApplyFilters).toHaveBeenCalledWith({
    player_name: 'LeBron James',
    'teams_against[]': ['OPP_PTS'],
    'rank_filter[]': [5],
  });
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
