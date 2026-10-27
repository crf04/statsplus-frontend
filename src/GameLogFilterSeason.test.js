import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import GameLogFilter from './GameLogFilter';
import { apiClient } from './config';
import { fetchGameLogsData } from './gameLogsApi';
import { fetchSeasons } from './seasonsApi';

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
jest.mock('./seasonsApi', () => ({ fetchSeasons: jest.fn() }));
jest.mock('./contexts/AuthContext', () => ({
  useAuth: () => ({ isAuthenticated: true, loading: false }),
}));
jest.mock('./savedFilterSetsApi', () => ({
  fetchSavedFilterSets: jest.fn(() => Promise.resolve([])),
  subscribeSavedFilterSets: jest.fn(() => () => {}),
}));
let mockParsed;
jest.mock('./NaturalLanguageQuery', () => ({
  __esModule: true,
  default: ({ onFiltersApplied }) => (
    <button type="button" onClick={() => onFiltersApplied(mockParsed)}>
      Apply parsed query
    </button>
  ),
}));
jest.mock('./PlayerSelector', () => ({ __esModule: true, default: () => null }));
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

const LocationProbe = () => {
  const location = useLocation();
  return <output data-testid="location">{location.pathname + location.search}</output>;
};

const renderAt = (entry) =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <GameLogFilter />
      <LocationProbe />
    </MemoryRouter>,
  );
const url = () => screen.getByTestId('location').textContent;

beforeEach(() => {
  mockParsed = { season_filter: '2026-27' };
  apiClient.get.mockImplementation(() => new Promise(() => {}));
  fetchGameLogsData.mockImplementation(() => new Promise(() => {}));
  fetchSeasons.mockResolvedValue({ seasons: ['2026-27', '2025-26'], defaultSeason: '2025-26' });
});

afterEach(() => jest.clearAllMocks());

test('choosing a season rewrites the URL beside the other filters', async () => {
  renderAt('/?player_name=LeBron+James&game_filter=10&location_filter=Home');
  fireEvent.change(await screen.findByRole('combobox', { name: 'Season' }), {
    target: { value: '2026-27' },
  });

  await waitFor(() =>
    expect(url()).toBe(
      '/?player_name=LeBron+James&season_filter=2026-27&location_filter=Home&game_filter=10',
    ),
  );
  expect(screen.getByRole('combobox', { name: 'Season' })).toHaveValue('2026-27');
  await waitFor(() =>
    expect(fetchGameLogsData).toHaveBeenLastCalledWith(
      expect.objectContaining({ player_name: 'LeBron James', season_filter: '2026-27' }),
      expect.anything(),
    ),
  );
});

test('a season can be chosen before any player, and is never sent as a player', async () => {
  renderAt('/?browse=1');
  fireEvent.change(await screen.findByRole('combobox', { name: 'Season' }), {
    target: { value: '2026-27' },
  });

  await waitFor(() => expect(url()).toBe('/?season_filter=2026-27'));
  expect(screen.getByRole('combobox', { name: 'Season' })).toHaveValue('2026-27');
});

test('Clear all empties the other filters from the URL and keeps the season', async () => {
  renderAt('/?player_name=LeBron+James&season_filter=2026-27&game_filter=10');
  expect(await screen.findByRole('combobox', { name: 'Season' })).toHaveValue('2026-27');
  fireEvent.click(screen.getByRole('button', { name: 'Clear all' }));

  await waitFor(() => expect(url()).toBe('/?player_name=LeBron+James&season_filter=2026-27'));
  expect(screen.getByRole('combobox', { name: 'Season' })).toHaveValue('2026-27');
});

test('with no player, a season is still written beside the other filters and nothing is requested', async () => {
  renderAt('/?game_filter=10&location_filter=Home');
  fireEvent.change(await screen.findByRole('combobox', { name: 'Season' }), {
    target: { value: '2026-27' },
  });

  await waitFor(() =>
    expect(url()).toBe('/?season_filter=2026-27&location_filter=Home&game_filter=10'),
  );
  expect(fetchGameLogsData).not.toHaveBeenCalled();
});

test('a parsed query carrying only a season, with no player, is refused and requests nothing', async () => {
  renderAt('/?season_filter=2026-27');
  fireEvent.click(await screen.findByRole('button', { name: 'Apply parsed query' }));

  await screen.findByText('Choose a player before applying these filters.');
  expect(url()).toBe('/?season_filter=2026-27');
  expect(fetchGameLogsData).not.toHaveBeenCalled();
});
