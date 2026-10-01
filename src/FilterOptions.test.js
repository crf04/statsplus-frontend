import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import FilterOptions from './FilterOptions';

jest.mock('./contexts/AuthContext', () => ({ useAuth: () => ({ isAuthenticated: false }) }));
global.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
window.matchMedia = () => ({ matches: false });

const renderPanel = (appliedFilters = {}, seasonGameLogs = []) => {
  const Panel = () => {
    const [result, setResult] = useState(null);
    const [line, setLine] = useState(20);
    return (
      <MemoryRouter>
        <FilterOptions
          playerList={['LeBron James', 'Anthony Davis']}
          onApplyFilters={setResult}
          selectedPlayer="LeBron James"
          seasonGameLogs={seasonGameLogs}
          gameLogs={seasonGameLogs.slice(0, 1)}
          lineType="PTS"
          lineValue={line}
          averages={[{ PTS: 30 }]}
          onOpenSelfFilters={() => {}}
          appliedFilters={appliedFilters}
        />
        <button onClick={() => setLine(30)}>Set chart line to 30</button>
        <output data-testid="patch">{JSON.stringify(result)}</output>
      </MemoryRouter>
    );
  };
  render(<Panel />);
};
const apply = () => fireEvent.click(screen.getByRole('button', { name: /^Apply/ }));
const patch = () => JSON.parse(screen.getByTestId('patch').textContent);

test('untouched controls emit only the player, and Own stat line is ready without a season', () => {
  renderPanel();
  apply();
  expect(patch()).toEqual({ player_name: 'LeBron James' });
  fireEvent.click(screen.getByRole('button', { name: /\+ Own stat line/ }));
  expect(screen.getByRole('option', { name: 'Points (PTS)' })).toBeVisible();
});

test('rows describe a link, teammate clicks flip it and removing last counts two changes', () => {
  renderPanel({ 'players_off[]': ['Anthony Davis'], game_filter: 10 });
  expect(screen.getByRole('button', { name: /without Anthony Davis off court/i })).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: /without Anthony Davis off court/i }));
  fireEvent.click(screen.getByRole('button', { name: 'Remove last' }));
  expect(screen.getByRole('button', { name: 'Apply 2 changes' })).toBeVisible();
  apply();
  expect(patch()).toEqual({
    player_name: 'LeBron James',
    'players_on[]': ['Anthony Davis'],
    'players_off[]': [],
    game_filter: null,
  });
});

test('editing Last N uses quick picks and specific opponents can be removed', () => {
  renderPanel({ game_filter: 10, opponent_tricode: 'OKC' });
  fireEvent.click(screen.getByRole('button', { name: 'last 10 games' }));
  fireEvent.click(screen.getByRole('button', { name: '5', exact: true }));
  fireEvent.click(screen.getByRole('button', { name: /^Remove versus/ }));
  apply();
  expect(patch()).toEqual({ player_name: 'LeBron James', game_filter: 5, opponent_tricode: null });
});

test('season strip uses actual rows and the selected line', () => {
  renderPanel({}, [
    { GAME_DATE: '2026-01-01', MATCHUP: 'LAL @ BOS', PTS: 25 },
    { GAME_DATE: '2026-01-02', MATCHUP: 'LAL @ OKC', PTS: 10 },
  ]);
  expect(screen.getByText(/of 2 games match/)).toBeVisible();
  expect(
    screen.getByRole('button', { name: '2026-01-01 LAL @ BOS · PTS 25 (over)' }),
  ).toBeVisible();
  fireEvent.click(
    screen.getByRole('button', { name: '2026-01-02 LAL @ OKC · PTS 10 (filtered out)' }),
  );
  expect(screen.getByRole('status', { name: 'Game details' })).toHaveTextContent(
    '2026-01-02 LAL @ OKC · PTS 10 (filtered out)',
  );
});

test('a linked Team Filter remains encoded and Clear all clears every applied field', () => {
  renderPanel({
    'teams_against[]': ['OPP_PTS'],
    'rank_filter[]': ['11,20'],
    'self_filters[PTS]': '20,40',
  });
  expect(screen.getByText('Points Allowed (ranks 11–20)')).toBeVisible();
  apply();
  expect(patch()).toEqual({
    player_name: 'LeBron James',
    'teams_against[]': ['OPP_PTS'],
    'rank_filter[]': ['11,20'],
    'self_filters[PTS]': '20,40',
  });
  fireEvent.click(screen.getByRole('button', { name: 'Clear all' }));
  expect(patch()).toEqual({
    player_name: 'LeBron James',
    minutes_filter: null,
    'players_on[]': [],
    'players_off[]': [],
    date_filter: null,
    'teams_against[]': [],
    'rank_filter[]': [],
    opponent_tricode: null,
    location_filter: null,
    game_filter: null,
    playstyle_RTG_min: null,
    playstyle_RTG_max: null,
    'self_filters[PTS]': null,
  });
});

test('single playtype bounds prefill defaults, and clearing Since emits a blank patch', () => {
  renderPanel({ playstyle_RTG_max: 80, date_filter: '2026-01-01' });
  fireEvent.click(screen.getByRole('button', { name: /rating playtype 0–80/ }));
  expect(screen.getByRole('slider', { name: 'Minimum rating' })).toHaveAttribute(
    'aria-valuenow',
    '0',
  );
  expect(screen.getByRole('slider', { name: 'Maximum rating' })).toHaveAttribute(
    'aria-valuenow',
    '80',
  );
  fireEvent.click(screen.getByRole('button', { name: 'Remove since' }));
  apply();
  expect(patch()).toEqual({
    player_name: 'LeBron James',
    playstyle_RTG_min: 0,
    playstyle_RTG_max: 80,
    date_filter: null,
  });
});

test('Team Filter categories scope metrics and switching drops a stale selection', () => {
  renderPanel();
  fireEvent.click(screen.getByRole('button', { name: /\+ Opp. defense/ }));
  fireEvent.change(screen.getByLabelText('Defensive metric'), { target: { value: 'OPP_PTS' } });
  expect(screen.getByRole('button', { name: 'Add: Points Allowed, ranks 1–10' })).toBeEnabled();
  fireEvent.click(screen.getByRole('tab', { name: 'Play type' }));
  expect(screen.getByRole('option', { name: 'Spot-Up' })).toBeVisible();
  expect(screen.queryByRole('option', { name: 'Points Allowed' })).toBeNull();
  expect(screen.getByRole('button', { name: 'Pick a metric to add' })).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Defensive metric'), { target: { value: 'Transition' } });
  fireEvent.click(screen.getByRole('button', { name: 'Add: Transition, ranks 1–10' }));
  apply();
  expect(patch()).toEqual({
    player_name: 'LeBron James',
    'teams_against[]': ['Transition'],
    'rank_filter[]': [10],
  });
});

test('editing a Team Filter loads its rank window and replaces its existing token', () => {
  renderPanel({ 'teams_against[]': ['Transition'], 'rank_filter[]': ['11,20'] });
  fireEvent.click(screen.getByRole('button', { name: /versus Transition \(ranks 11–20\)/ }));
  const thumb = screen.getByRole('slider', { name: 'From rank' });
  fireEvent.focus(thumb);
  fireEvent.keyDown(thumb, { key: 'ArrowRight' });
  fireEvent.click(screen.getByRole('button', { name: 'Add: Transition, ranks 12–20' }));
  apply();
  expect(patch()).toEqual({
    player_name: 'LeBron James',
    'teams_against[]': ['Transition'],
    'rank_filter[]': ['12,20'],
  });
});

test('legacy signed rank forms remain readable and survive apply', () => {
  renderPanel({ 'teams_against[]': ['OPP_PTS', 'Isolation'], 'rank_filter[]': ['-10', '5'] });
  expect(screen.getByText('Points Allowed (last 10)')).toBeVisible();
  expect(screen.getByText('Isolation (ranks 1–5)')).toBeVisible();
  apply();
  expect(patch()).toEqual({
    player_name: 'LeBron James',
    'teams_against[]': ['OPP_PTS', 'Isolation'],
    'rank_filter[]': [-10, 5],
  });
});

test('signed-out panel exposes no account saved sets or next opponent block', () => {
  renderPanel({ game_filter: 10 });
  expect(screen.queryByText('Saved Filter Sets')).toBeNull();
  expect(screen.queryByText(/^Next:/)).toBeNull();
  expect(screen.getByRole('button', { name: 'last 10 games' })).toBeVisible();
});

test('season cells follow the explicit chart line rather than the filtered average', () => {
  renderPanel({}, [{ GAME_DATE: '2026-01-01', MATCHUP: 'LAL @ BOS', PTS: 25 }]);
  expect(
    screen.getByRole('button', { name: '2026-01-01 LAL @ BOS · PTS 25 (over)' }),
  ).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Set chart line to 30' }));
  expect(
    screen.getByRole('button', { name: '2026-01-01 LAL @ BOS · PTS 25 (under)' }),
  ).toBeVisible();
});

test('picking a teammate suggestion directly adds its row and on-court patch', () => {
  renderPanel();
  fireEvent.click(screen.getByRole('button', { name: /\+ Teammate/ }));
  fireEvent.change(screen.getByRole('combobox', { name: 'Teammate' }), {
    target: { value: 'Anthony' },
  });
  fireEvent.click(screen.getByRole('option', { name: 'Anthony Davis + on court' }));
  expect(screen.getByRole('button', { name: /with Anthony Davis on court/ })).toBeVisible();
  apply();
  expect(patch()).toEqual({
    player_name: 'LeBron James',
    'players_on[]': ['Anthony Davis'],
    'players_off[]': [],
  });
});

test('a minimum-only playtype link retains the default maximum when applied', () => {
  renderPanel({ playstyle_RTG_min: 20 });
  fireEvent.click(screen.getByRole('button', { name: /rating playtype 20–200/ }));
  expect(screen.getByRole('slider', { name: 'Maximum rating' })).toHaveAttribute(
    'aria-valuenow',
    '200',
  );
  apply();
  expect(patch()).toEqual({
    player_name: 'LeBron James',
    playstyle_RTG_min: 20,
    playstyle_RTG_max: 200,
  });
});
