import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import GameLogFilter from './GameLogFilter';
import { apiClient } from './config';

jest.mock('react-chartjs-2', () => ({ Bar: () => null }));
jest.mock('./chartSetup', () => ({}));
jest.mock('./MetricsDashboardRow', () => ({ __esModule: true, default: () => null }));
jest.mock('./AppliedFilters', () => ({ __esModule: true, default: () => null }));
jest.mock('./seasonsApi', () => ({
  fetchSeasons: () => Promise.resolve({ seasons: ['2025-26'], defaultSeason: '2025-26' }),
}));
jest.mock('./config', () => ({
  apiClient: { get: jest.fn() },
  getApiUrl: (name) => `/api/${name.toLowerCase()}`,
}));
jest.mock('./contexts/AuthContext', () => ({
  useAuth: () => ({ isAuthenticated: true, loading: false }),
}));
jest.mock('./savedFilterSetsApi', () => ({
  fetchSavedFilterSets: jest.fn(() => Promise.resolve([])),
  subscribeSavedFilterSets: jest.fn(() => () => {}),
}));
jest.mock('./NaturalLanguageQuery', () => ({ __esModule: true, default: () => null }));
jest.mock('./FilterOptions', () => ({ __esModule: true, default: () => null }));
jest.mock('./PlayerProfile', () => ({ __esModule: true, default: () => null }));
jest.mock('./OpposingTeamProfile', () => ({ __esModule: true, default: () => null }));
jest.mock('./GameLogsTable', () => ({ __esModule: true, default: () => null }));
jest.mock('./PlayerStatsCards', () => ({ __esModule: true, default: () => null }));

global.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
window.matchMedia = () => ({ matches: false });

const GAME_LOGS = {
  game_logs: [
    { GAME_DATE: '2026-01-05', MATCHUP: 'GSW vs. BOS', MIN: 34, PTS: 31, REB: 6, FGA: 20, FG3A: 9 },
  ],
  averages: [{ PTS: 31, REB: 6, MIN: 34 }],
  season_averages: [{ PTS: 27.5, REB: 5.2, MIN: 33 }],
  opponent_ranks: {
    PTS: { label: 'Points Allowed', ranks: { BOS: 27 } },
    REB: { label: 'Rebounds Allowed', ranks: { BOS: 9 } },
  },
};

const gameLogReads = () => apiClient.get.mock.calls.filter(([url]) => url === '/api/game_logs');
const rankRow = () =>
  screen.getByRole('region', { name: 'Picked game' }).querySelector('.game-strip-rank')
    ?.textContent;

beforeEach(() => {
  apiClient.get.mockImplementation((url) =>
    url === '/api/game_logs' ? Promise.resolve({ data: GAME_LOGS }) : new Promise(() => {}),
  );
});

afterEach(() => jest.clearAllMocks());

test("the game strip reads the response's opponent rank for the chosen Line Type, without a refetch", async () => {
  render(
    <MemoryRouter initialEntries={['/?player_name=Stephen+Curry&game_filter=10']}>
      <GameLogFilter />
    </MemoryRouter>,
  );

  await waitFor(() => expect(rankRow()).toBe('BOS 27th PTS allowed'));

  fireEvent.change(await screen.findByRole('combobox', { name: 'Line Type:' }), {
    target: { value: 'REB' },
  });

  await waitFor(() => expect(rankRow()).toBe('BOS 9th REB allowed'));
  expect(gameLogReads()).toHaveLength(1);
});
