import { useState } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import FilterOptions from './FilterOptions';
import { fetchSeasons } from './seasonsApi';

jest.mock('./contexts/AuthContext', () => ({
  useAuth: () => ({ isAuthenticated: true, loading: false }),
}));
jest.mock('./seasonsApi', () => ({ fetchSeasons: jest.fn() }));
global.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
window.matchMedia = () => ({ matches: false });

beforeEach(() => {
  fetchSeasons.mockReset();
  fetchSeasons.mockRejectedValue(new Error('offline'));
});

const renderPanel = (appliedFilters = {}, seasonGameLogs = []) => {
  const Panel = () => {
    const [result, setResult] = useState(null);
    const [seasonChoice, setSeasonChoice] = useState(null);
    const [line, setLine] = useState(20);
    const [applied, setApplied] = useState(appliedFilters);
    return (
      <MemoryRouter>
        <FilterOptions
          playerList={['LeBron James', 'Anthony Davis']}
          onApplyFilters={setResult}
          onSeasonChange={setSeasonChoice}
          selectedPlayer="LeBron James"
          seasonGameLogs={seasonGameLogs}
          gameLogs={seasonGameLogs.slice(0, 1)}
          lineType="PTS"
          lineValue={line}
          averages={[{ PTS: 30 }]}
          onOpenSelfFilters={() => {}}
          appliedFilters={applied}
        />
        <button onClick={() => setLine(30)}>Set chart line to 30</button>
        <button onClick={() => setApplied({ date_filter: '2026-03-01' })}>
          Open a link without an end date
        </button>
        <output data-testid="patch">{JSON.stringify(result)}</output>
        <output data-testid="season-choice">{seasonChoice}</output>
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

test('Add a filter offers no playtype matchup rating tile', () => {
  renderPanel();
  expect(screen.getByRole('button', { name: /\+ Minutes/ })).toBeVisible();
  expect(screen.queryByRole('button', { name: /\+ Playtype/ })).toBeNull();
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
    date_to: null,
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

test('the end date prefills, emits on change, and Clear all blanks it', () => {
  renderPanel({ date_filter: '2026-01-01', date_to: '2026-01-31' });
  fireEvent.click(screen.getByRole('button', { name: /^until/i }));
  expect(screen.getByLabelText('Since date')).toHaveValue('2026-01-01');
  expect(screen.getByLabelText('Until date')).toHaveValue('2026-01-31');
  apply();
  expect(patch()).toEqual({
    player_name: 'LeBron James',
    date_filter: '2026-01-01',
    date_to: '2026-01-31',
  });
  fireEvent.change(screen.getByLabelText('Until date'), { target: { value: '2026-02-15' } });
  apply();
  expect(patch().date_to).toBe('2026-02-15');
  fireEvent.click(screen.getByRole('button', { name: 'Clear all' }));
  expect(patch().date_to).toBeNull();
  expect(patch().date_filter).toBeNull();
});

test('an end date typed into a blank panel is emitted', () => {
  renderPanel();
  fireEvent.click(screen.getByRole('button', { name: /\+ Since/ }));
  fireEvent.change(screen.getByLabelText('Until date'), { target: { value: '2026-01-31' } });
  apply();
  expect(patch()).toEqual({ player_name: 'LeBron James', date_to: '2026-01-31' });
});

test('opening a different Filter Set clears an end date the old one left behind', () => {
  renderPanel({ date_filter: '2026-01-01', date_to: '2026-01-31' });
  expect(screen.getByRole('button', { name: /^until/i })).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Open a link without an end date' }));
  expect(screen.queryByRole('button', { name: /^until/i })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: /^since/i }));
  expect(screen.getByLabelText('Since date')).toHaveValue('2026-03-01');
  expect(screen.getByLabelText('Until date')).toHaveValue('');
  apply();
  expect(patch()).toEqual({ player_name: 'LeBron James', date_filter: '2026-03-01' });
});

test('Team Filter categories scope metrics and switching drops a stale selection', () => {
  renderPanel();
  fireEvent.click(screen.getByRole('button', { name: /\+ Opp. defense/ }));
  fireEvent.change(screen.getByLabelText('Defensive metric'), { target: { value: 'OPP_PTS' } });
  expect(screen.getByRole('button', { name: 'Add: Points Allowed, ranks 21–30' })).toBeEnabled();
  fireEvent.click(screen.getByRole('tab', { name: 'Play type' }));
  expect(screen.getByRole('option', { name: 'Spot-Up Points' })).toBeVisible();
  // Points per possession left the dropdown (crf04/statsplus#318).
  expect(screen.queryByRole('option', { name: 'Spot-Up' })).toBeNull();
  expect(screen.queryByRole('option', { name: 'Isolation' })).toBeNull();
  expect(screen.queryByRole('option', { name: 'Points Allowed' })).toBeNull();
  expect(screen.getByRole('button', { name: 'Pick a metric to add' })).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Defensive metric'), {
    target: { value: 'sheet:play_types:Transition:PTS' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Add: Transition Points, ranks 21–30' }));
  apply();
  expect(patch()).toEqual({
    player_name: 'LeBron James',
    'teams_against[]': ['sheet:play_types:Transition:PTS'],
    'rank_filter[]': [10],
  });
});

test('editing a Team Filter loads its rank window and replaces its existing token', () => {
  renderPanel({ 'teams_against[]': ['Transition'], 'rank_filter[]': ['12,20'] });
  fireEvent.click(screen.getByRole('button', { name: /versus Transition \(ranks 11–19\)/ }));
  const thumb = screen.getByRole('slider', { name: 'From rank' });
  fireEvent.focus(thumb);
  fireEvent.keyDown(thumb, { key: 'ArrowRight' });
  fireEvent.click(screen.getByRole('button', { name: 'Add: Transition, ranks 12–19' }));
  apply();
  expect(patch()).toEqual({
    player_name: 'LeBron James',
    'teams_against[]': ['Transition'],
    'rank_filter[]': ['12,19'],
  });
});

test('positions 1,8 display as ranks 23–30 and choosing 23–30 requests 1,8', () => {
  renderPanel({ 'teams_against[]': ['OPP_PTS'], 'rank_filter[]': ['1,8'] });
  expect(screen.getByText('Points Allowed (ranks 23–30)')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: /\+ Opp. defense/ }));
  fireEvent.click(screen.getByRole('tab', { name: 'Play type' }));
  fireEvent.change(screen.getByLabelText('Defensive metric'), {
    target: { value: 'sheet:play_types:Isolation:PTS' },
  });
  const from = screen.getByRole('slider', { name: 'From rank' });
  fireEvent.focus(from);
  for (let i = 0; i < 2; i += 1) fireEvent.keyDown(from, { key: 'ArrowRight' });
  fireEvent.click(screen.getByRole('button', { name: 'Add: Isolation Points, ranks 23–30' }));
  apply();
  expect(patch()['rank_filter[]']).toEqual(['1,8', 8]);
});

test('legacy signed rank forms remain readable and survive apply', () => {
  renderPanel({ 'teams_against[]': ['OPP_PTS', 'Isolation'], 'rank_filter[]': ['-10', '5'] });
  expect(screen.getByText('Points Allowed (ranks 1–10)')).toBeVisible();
  expect(screen.getByText('Isolation (ranks 26–30)')).toBeVisible();
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

const twoSeasons = { seasons: ['2026-27', '2025-26'], defaultSeason: '2025-26' };

test('a season select offers each season, starts on the default and applies at once', async () => {
  fetchSeasons.mockResolvedValue(twoSeasons);
  renderPanel({ game_filter: 10 });
  const select = await screen.findByRole('combobox', { name: 'Season' });
  expect(select).toHaveValue('2025-26');
  expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
    '2026-27',
    '2025-26',
  ]);

  fireEvent.change(select, { target: { value: '2026-27' } });
  expect(screen.getByTestId('season-choice')).toHaveTextContent('2026-27');
  expect(screen.getByTestId('patch')).toHaveTextContent('null');
});

test('the season select shows the season in the link and Clear all leaves it out of its patch', async () => {
  fetchSeasons.mockResolvedValue(twoSeasons);
  renderPanel({ season_filter: '2026-27', game_filter: 10 });
  expect(await screen.findByRole('combobox', { name: 'Season' })).toHaveValue('2026-27');
  fireEvent.click(screen.getByRole('button', { name: 'Clear all' }));
  expect(patch()).not.toHaveProperty('season_filter');
});

test.each([
  [
    'a single season',
    () => fetchSeasons.mockResolvedValue({ seasons: ['2025-26'], defaultSeason: '2025-26' }),
  ],
  ['no seasons', () => fetchSeasons.mockResolvedValue({ seasons: [], defaultSeason: '2025-26' })],
  ['a failed read', () => fetchSeasons.mockRejectedValue(new Error('offline'))],
])('hides the season select for %s', async (_name, arrange) => {
  arrange();
  renderPanel();
  await waitFor(() => expect(fetchSeasons).toHaveBeenCalled());
  await act(async () => {});
  expect(screen.queryByRole('combobox', { name: 'Season' })).toBeNull();
});

test('Own stat line offers USG% bounded by games that report it and emits it on a 0-100 scale', () => {
  renderPanel({}, [
    { GAME_DATE: '2026-01-01', MATCHUP: 'LAL @ BOS', PTS: 25, USG_PCT: 25 },
    { GAME_DATE: '2026-01-02', MATCHUP: 'LAL @ OKC', PTS: 10, USG_PCT: 33.3 },
    { GAME_DATE: '2026-01-03', MATCHUP: 'LAL vs. DEN', PTS: 12, USG_PCT: null },
    { GAME_DATE: '2026-01-04', MATCHUP: 'LAL vs. UTA', PTS: 14 },
    { GAME_DATE: '2026-01-05', MATCHUP: 'LAL @ MIA', PTS: 16, USG_PCT: 40 },
  ]);
  fireEvent.click(screen.getByRole('button', { name: /\+ Own stat line/ }));
  fireEvent.change(screen.getByLabelText('Stat'), { target: { value: 'USG_PCT' } });
  // null and missing values are not zeros: the minimum is 25.0, not 0.0
  expect(screen.getByRole('slider', { name: 'Minimum USG_PCT' })).toHaveAttribute(
    'aria-valuenow',
    '25',
  );
  expect(screen.getByRole('slider', { name: 'Maximum USG_PCT' })).toHaveAttribute(
    'aria-valuenow',
    '40',
  );
  expect(screen.getByText('25.0–40.0')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Add stat filter' }));
  expect(screen.getByText('USG% 25.0–40.0')).toBeVisible();
  apply();
  expect(patch()).toEqual({
    player_name: 'LeBron James',
    'self_filters[USG_PCT]': '25,40',
  });
});

test('USG% offers no range when no game reports it', () => {
  renderPanel({}, [
    { GAME_DATE: '2026-01-01', MATCHUP: 'LAL @ BOS', PTS: 25, USG_PCT: null },
    { GAME_DATE: '2026-01-02', MATCHUP: 'LAL @ OKC', PTS: 10 },
  ]);
  fireEvent.click(screen.getByRole('button', { name: /\+ Own stat line/ }));
  fireEvent.change(screen.getByLabelText('Stat'), { target: { value: 'USG_PCT' } });
  expect(screen.queryByRole('slider', { name: 'Minimum USG_PCT' })).toBeNull();
});

test('USG% keyboard steps land on the 0.1 grid when season values have two decimals', () => {
  renderPanel({}, [
    { GAME_DATE: '2026-01-01', MATCHUP: 'LAL @ BOS', PTS: 25, USG_PCT: 24.87 },
    { GAME_DATE: '2026-01-02', MATCHUP: 'LAL @ OKC', PTS: 10, USG_PCT: 33.37 },
    { GAME_DATE: '2026-01-05', MATCHUP: 'LAL @ MIA', PTS: 16, USG_PCT: 40.12 },
  ]);
  fireEvent.click(screen.getByRole('button', { name: /\+ Own stat line/ }));
  fireEvent.change(screen.getByLabelText('Stat'), { target: { value: 'USG_PCT' } });
  // bounds round outward to 24.8 and 40.2
  expect(screen.getByText('24.8–40.2')).toBeVisible();
  const min = screen.getByRole('slider', { name: 'Minimum USG_PCT' });
  const max = screen.getByRole('slider', { name: 'Maximum USG_PCT' });
  fireEvent.focus(min);
  fireEvent.keyDown(min, { key: 'ArrowRight' });
  fireEvent.keyDown(min, { key: 'ArrowRight' });
  fireEvent.focus(max);
  fireEvent.keyDown(max, { key: 'ArrowLeft' });
  fireEvent.keyDown(max, { key: 'ArrowLeft' });
  fireEvent.click(screen.getByRole('button', { name: 'Add stat filter' }));
  expect(screen.getByText('USG% 25.0–40.0')).toBeVisible();
  apply();
  expect(patch()).toEqual({ player_name: 'LeBron James', 'self_filters[USG_PCT]': '25,40' });
});
