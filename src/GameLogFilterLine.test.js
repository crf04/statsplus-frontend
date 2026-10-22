import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import GameLogFilter from './GameLogFilter';
import { apiClient } from './config';
import { decodeGameLogsResponse, fetchGameLogsData } from './gameLogsApi';

jest.mock('./config', () => ({
  apiClient: { get: jest.fn() },
  getApiUrl: (name) => `/api/${name.toLowerCase()}`,
}));
jest.mock('./gameLogsApi', () => ({
  ...jest.requireActual('./gameLogsApi'),
  fetchGameLogsData: jest.fn(),
  getRequestErrorMessage: jest.fn(() => 'request failed'),
  isRequestCancelled: jest.fn(() => false),
}));
jest.mock('./contexts/AuthContext', () => ({
  useAuth: () => ({ isAuthenticated: true, loading: false }),
}));
jest.mock('./savedFilterSetsApi', () => ({
  fetchSavedFilterSets: jest.fn(() => Promise.resolve([])),
  subscribeSavedFilterSets: jest.fn(() => () => {}),
}));
jest.mock('./NaturalLanguageQuery', () => ({ __esModule: true, default: () => null }));
jest.mock('./FilterOptions', () => ({
  __esModule: true,
  default: ({ onApplyFilters, onSeasonChange }) => (
    <>
      <button type="button" onClick={() => onApplyFilters({ game_filter: 5 })}>
        Apply test filters
      </button>
      <button type="button" onClick={() => onSeasonChange('2024-25')}>
        Choose 2024-25
      </button>
    </>
  ),
}));
jest.mock('./PlayerProfile', () => ({ __esModule: true, default: () => null }));
jest.mock('./OpposingTeamProfile', () => ({ __esModule: true, default: () => null }));
jest.mock('./ChartComponent', () => ({ __esModule: true, default: () => null }));
jest.mock('./GameLogsTable', () => ({ __esModule: true, default: () => null }));
jest.mock('./PlayerStatsCards', () => ({ __esModule: true, default: () => null }));

global.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
window.matchMedia = () => ({ matches: false });

// Opening a Saved Filter Set for the same player navigates to its query string,
// which never carries a line.
const SAVED_SET = '/?player_name=LeBron+James&location_filter=Home';

const LocationProbe = () => {
  const location = useLocation();
  const navigate = useNavigate();
  return (
    <>
      <output data-testid="location">{location.pathname + location.search}</output>
      <button type="button" onClick={() => navigate(-1)}>
        Browser back
      </button>
      <button type="button" onClick={() => navigate(SAVED_SET)}>
        Open saved set
      </button>
    </>
  );
};

const renderAt = (entries, index) =>
  render(
    <MemoryRouter initialEntries={entries} initialIndex={index}>
      <GameLogFilter />
      <LocationProbe />
    </MemoryRouter>,
  );
const url = () => screen.getByTestId('location').textContent;
const lineValue = () => screen.findByLabelText('Line Value:');
const type = async (value) => fireEvent.change(await lineValue(), { target: { value } });
const PLAYER = '/?player_name=LeBron+James';

const lebron = decodeGameLogsResponse({
  game_logs: [{ GAME_DATE: '2026-04-01', PTS: 25 }],
  season_averages: [{ PTS: 25 }, { PTS: 24.4 }],
  posted_line: {
    game_date: '2026-10-22',
    matchup: 'LAL @ PHX',
    lines: { PTS: { value: 22.5, provider: 'underdog' } },
    provider_lines: { dabble: { PTS: 21.5 }, underdog: { PTS: 22.5 } },
  },
});

beforeEach(() => {
  apiClient.get.mockImplementation(() => new Promise(() => {}));
  fetchGameLogsData.mockImplementation(() => Promise.resolve(lebron));
});

afterEach(() => jest.clearAllMocks());

const loaded = async () => waitFor(async () => expect(await lineValue()).toHaveValue('22.5'));

test('typing a Line Value writes it, as shown, without a new history entry', async () => {
  renderAt(['/', PLAYER], 1);
  await loaded();

  await type('24.50');
  await waitFor(() => expect(url()).toBe(`${PLAYER}&line=24.5`));
  expect(await lineValue()).toHaveValue('24.50');

  fireEvent.click(screen.getByRole('button', { name: 'Browser back' }));
  await waitFor(() => expect(url()).toBe('/'));
});

test.each(['', '0', '24.255'])('typing %p, which no link can carry, removes it', async (value) => {
  renderAt([`${PLAYER}&line=24.5`]);
  await waitFor(() => expect(fetchGameLogsData).toHaveBeenCalled());

  await type(value);

  await waitFor(() => expect(url()).toBe(PLAYER));
  expect(await lineValue()).toHaveValue(value);
});

test('choosing a posted source other than the default writes its line', async () => {
  renderAt([PLAYER]);
  await loaded();

  fireEvent.click(screen.getByRole('button', { name: /^Dabble 21.5/ }));
  await waitFor(() => expect(url()).toBe(`${PLAYER}&line=21.5`));

  fireEvent.click(screen.getByRole('button', { name: /^Underdog 22.5/ }));
  await waitFor(() => expect(url()).toBe(PLAYER));
  expect(await lineValue()).toHaveValue('22.5');
});

test('a chosen source that moves on a refetch moves the line in the URL', async () => {
  renderAt([PLAYER]);
  await loaded();
  fireEvent.click(screen.getByRole('button', { name: /^Dabble 21.5/ }));
  await waitFor(() => expect(url()).toBe(`${PLAYER}&line=21.5`));

  fetchGameLogsData.mockImplementation(() =>
    Promise.resolve(
      decodeGameLogsResponse({
        game_logs: [],
        posted_line: {
          lines: { PTS: { value: 22.5, provider: 'underdog' } },
          provider_lines: { dabble: { PTS: 20 }, underdog: { PTS: 22.5 } },
        },
      }),
    ),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Apply test filters' }));

  await waitFor(() => expect(url()).toBe(`${PLAYER}&game_filter=5&line=20`));
  expect(await lineValue()).toHaveValue('20.0');
});

test('a link carrying a line opens on it, as if typed', async () => {
  renderAt([`${PLAYER}&line=24.0`]);

  await waitFor(async () => expect(await lineValue()).toHaveValue('24'));
  await waitFor(() => expect(fetchGameLogsData).toHaveBeenCalled());
  expect(await lineValue()).toHaveValue('24');
  expect(screen.queryAllByRole('button', { pressed: true })).toEqual([]);
});

test.each(['line=abc', 'line=0', 'line=24.5&line=25'])(
  'an unusable %s is ignored for the default line',
  async (param) => {
    renderAt([`${PLAYER}&${param}`]);

    await loaded();
    expect(screen.queryByRole('alert')).toBeNull();
  },
);

test('applying a filter or a season keeps the line', async () => {
  renderAt([`${PLAYER}&line_type=PTS&line=24.5`]);
  await waitFor(async () => expect(await lineValue()).toHaveValue('24.5'));

  fireEvent.click(screen.getByRole('button', { name: 'Apply test filters' }));
  await waitFor(() => expect(url()).toBe(`${PLAYER}&game_filter=5&line=24.5`));
  fireEvent.click(screen.getByRole('button', { name: 'Choose 2024-25' }));
  await waitFor(() =>
    expect(url()).toBe(`${PLAYER}&season_filter=2024-25&game_filter=5&line=24.5`),
  );
  expect(await lineValue()).toHaveValue('24.5');
});

test('changing the Line Type drops the line', async () => {
  renderAt([`${PLAYER}&line=24.5`]);
  await waitFor(async () => expect(await lineValue()).toHaveValue('24.5'));

  fireEvent.change(await screen.findByRole('combobox', { name: 'Line Type:' }), {
    target: { value: 'AST' },
  });

  await waitFor(() => expect(url()).toBe(`${PLAYER}&line_type=AST`));
  expect(await lineValue()).toHaveValue('');
});

test('changing the player drops the line', async () => {
  apiClient.get.mockImplementation((path) =>
    Promise.resolve({
      data:
        path === '/api/players' ? { players: ['LeBron James', 'Stephen Curry'] } : { teams: [] },
    }),
  );
  renderAt([`${PLAYER}&line=24.5`]);
  await waitFor(async () => expect(await lineValue()).toHaveValue('24.5'));

  const input = screen.getByLabelText('Player:');
  await waitFor(() => {
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.change(input, { target: { value: 'Stephen' } });
    expect(screen.getByRole('listbox')).toBeVisible();
  });
  fireEvent.keyDown(input, { key: 'Enter' });

  await waitFor(() => expect(url()).toBe('/?player_name=Stephen+Curry'));
  await loaded();
});

test('opening a Saved Filter Set drops the line and shows the default', async () => {
  renderAt([`${PLAYER}&line=24.5`]);
  await waitFor(async () => expect(await lineValue()).toHaveValue('24.5'));

  fireEvent.click(screen.getByRole('button', { name: 'Open saved set' }));

  await waitFor(() => expect(url()).toBe(SAVED_SET));
  await loaded();
});

test('the line never reaches a request', async () => {
  renderAt([`${PLAYER}&game_filter=10&line=24.5`]);
  await waitFor(() => expect(fetchGameLogsData).toHaveBeenCalled());
  await type('30');
  fireEvent.click(screen.getByRole('button', { name: 'Apply test filters' }));
  await waitFor(() => expect(url()).toBe(`${PLAYER}&game_filter=5&line=30`));
  await waitFor(() => expect(fetchGameLogsData).toHaveBeenCalledTimes(2));

  expect(fetchGameLogsData.mock.calls.map(([params]) => params)).toEqual([
    { player_name: 'LeBron James', game_filter: 10 },
    { player_name: 'LeBron James', game_filter: 5 },
  ]);
  expect(JSON.stringify(apiClient.get.mock.calls)).not.toContain('line=');
});
