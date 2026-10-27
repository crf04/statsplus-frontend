import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import GameLogFilter from './GameLogFilter';
import { apiClient } from './config';
import { fetchGameLogsData } from './gameLogsApi';
import { fetchSeasons } from './seasonsApi';

// The real Player Profile, so its own read is observed while /seasons is pending.
jest.mock('./config', () => ({
  apiClient: { get: jest.fn() },
  getApiUrl: (name) => `/api/${name.toLowerCase()}`,
}));
jest.mock('./gameLogsApi', () => ({
  ...jest.requireActual('./gameLogsApi'),
  fetchGameLogsData: jest.fn(),
  isRequestCancelled: jest.fn(() => false),
}));
jest.mock('./seasonsApi', () => ({ fetchSeasons: jest.fn() }));
let mockSignedIn = true;
jest.mock('./contexts/AuthContext', () => ({
  useAuth: () => ({ isAuthenticated: mockSignedIn, loading: false }),
}));
const teamStatsRequests = () =>
  apiClient.get.mock.calls
    .filter(([path]) => path === '/api/team_stats')
    .map(([, options]) => options.params);
jest.mock('./savedFilterSetsApi', () => ({
  fetchSavedFilterSets: jest.fn(() => Promise.resolve([])),
  subscribeSavedFilterSets: jest.fn(() => () => {}),
}));
jest.mock('./NaturalLanguageQuery', () => ({ __esModule: true, default: () => null }));
jest.mock('./PlayerSelector', () => ({ __esModule: true, default: () => null }));
jest.mock('./PlaystyleComparisonChart', () => () => null);
jest.mock('./AssistProfileChart', () => () => null);
jest.mock('./TwoThreeAssistChart', () => () => null);
jest.mock('./ChartComponent', () => ({ __esModule: true, default: () => null }));
jest.mock('./PerformanceAverages', () => ({ __esModule: true, default: () => null }));
jest.mock('./GameLogsTable', () => ({ __esModule: true, default: () => null }));
jest.mock('./PlayerStatsCards', () => ({ __esModule: true, default: () => null }));

global.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
window.matchMedia = () => ({ matches: false });

const withChoices = {
  seasons: ['2025-26', '2024-25'],
  defaultSeason: '2025-26',
  choices: [
    {
      season: '2026-27',
      mode: 'unpublished',
      families: { game_logs: { servedSeason: '2026-27', state: 'serving', reason: null } },
      teamGames: { min: 2, max: 4 },
    },
    {
      season: '2025-26',
      mode: 'published',
      families: { game_logs: { servedSeason: '2025-26', state: 'serving', reason: null } },
      teamGames: null,
    },
  ],
};
// The Opposing Team Profile's read; the Player Profile's comparison read is Playtypes.
const opponentRequests = () =>
  apiClient.get.mock.calls
    .filter(
      ([path, options]) => path === '/api/team_stats' && options.params.category === 'Traditional',
    )
    .map(([, options]) => options.params);
const teamStatsPaths = () =>
  apiClient.get.mock.calls.filter(([path]) => path === '/api/team_stats');
const profileRequests = () =>
  apiClient.get.mock.calls
    .filter(([path]) => path === '/api/player_profile')
    .map(([, options]) => options.params);

beforeEach(() => {
  jest.useFakeTimers({ now: new Date('2026-10-27T16:00:00Z'), advanceTimers: true });
  apiClient.get.mockImplementation((path) =>
    Promise.resolve({
      data:
        path === '/api/players'
          ? ['LeBron James']
          : path === '/api/next_opponent'
            ? { next_game: null, opponent_ranks: [] }
            : path === '/api/player_profile'
              ? [{ PLAY_TYPE: 'Isolation' }]
              : [],
    }),
  );
  fetchGameLogsData.mockResolvedValue({
    gameLogs: [{ GAME_DATE: '2026-10-22' }],
    averages: [],
    playerId: 2544,
  });
});
afterEach(() => {
  mockSignedIn = true;
  jest.useRealTimers();
  jest.clearAllMocks();
});

test('while /seasons is pending the Player Profile neither reads nor shows, then reads 2026-27 once', async () => {
  let answerSeasons;
  fetchSeasons.mockReturnValue(new Promise((resolve) => (answerSeasons = resolve)));
  render(
    <MemoryRouter initialEntries={['/?player_name=LeBron+James']}>
      <GameLogFilter />
    </MemoryRouter>,
  );
  await waitFor(() =>
    expect(apiClient.get.mock.calls.map(([path]) => path)).toContain('/api/players'),
  );
  await act(async () => {});
  expect(profileRequests()).toEqual([]);
  expect(screen.queryByText('Player Profile')).toBeNull();

  await act(async () => answerSeasons(withChoices));
  await screen.findByText('Player Profile');
  await act(async () => {});
  expect(profileRequests()).toEqual([
    { player_name: 'LeBron James', category: 'Playtypes', season: '2026-27' },
  ]);
});

test('a signed-out reader, who never reads /seasons, still sees the Player Profile', async () => {
  mockSignedIn = false;
  render(
    <MemoryRouter initialEntries={['/?player_name=LeBron+James']}>
      <GameLogFilter />
    </MemoryRouter>,
  );
  expect(await screen.findByText('Player Profile')).toBeInTheDocument();
  expect(fetchSeasons).not.toHaveBeenCalled();
});

test('while /seasons is pending the Opposing Team Profile neither reads nor shows, then reads 2026-27 once', async () => {
  let answerSeasons;
  fetchSeasons.mockReturnValue(new Promise((resolve) => (answerSeasons = resolve)));
  render(
    <MemoryRouter initialEntries={['/?player_name=LeBron+James']}>
      <GameLogFilter />
    </MemoryRouter>,
  );
  await waitFor(() =>
    expect(apiClient.get.mock.calls.map(([path]) => path)).toContain('/api/players'),
  );
  await act(async () => {});
  expect(teamStatsPaths()).toEqual([]);
  expect(screen.queryByText('Opposing Team Profile')).toBeNull();

  await act(async () => answerSeasons(withChoices));
  await screen.findByText('Opposing Team Profile');
  await waitFor(() => expect(opponentRequests()).not.toEqual([]));
  await act(async () => {});
  expect(opponentRequests()).toEqual([
    { category: 'Traditional', team: 'Atlanta Hawks', date: null, season: '2026-27' },
  ]);
});

// Signed out there is no team list, so the card shows but reads nothing; with
// no choice it would send no season (OpposingTeamProfile.test.js).
test('a signed-out reader, who never reads /seasons, still sees the Opposing Team Profile', async () => {
  mockSignedIn = false;
  render(
    <MemoryRouter initialEntries={['/?player_name=LeBron+James']}>
      <GameLogFilter />
    </MemoryRouter>,
  );
  expect(await screen.findByText('Opposing Team Profile')).toBeInTheDocument();
  await act(async () => {});
  expect(fetchSeasons).not.toHaveBeenCalled();
  expect(teamStatsPaths()).toEqual([]);
});

test('a link that names its season still waits for /seasons, then each profile reads that season once', async () => {
  let answerSeasons;
  fetchSeasons.mockReturnValue(new Promise((resolve) => (answerSeasons = resolve)));
  render(
    <MemoryRouter initialEntries={['/?player_name=LeBron+James&season_filter=2026-27']}>
      <GameLogFilter />
    </MemoryRouter>,
  );
  await waitFor(() =>
    expect(apiClient.get.mock.calls.map(([path]) => path)).toContain('/api/players'),
  );
  await act(async () => {});
  expect(profileRequests()).toEqual([]);
  expect(teamStatsPaths()).toEqual([]);

  await act(async () => answerSeasons(withChoices));
  await screen.findByText('Opposing Team Profile');
  await waitFor(() => expect(opponentRequests()).not.toEqual([]));
  await act(async () => {});
  expect(profileRequests()).toEqual([
    { player_name: 'LeBron James', category: 'Playtypes', season: '2026-27' },
  ]);
  expect(opponentRequests()).toEqual([
    { category: 'Traditional', team: 'Atlanta Hawks', date: null, season: '2026-27' },
  ]);
});

test('after signing out no profile read carries the signed-in Evidence season', async () => {
  fetchSeasons.mockResolvedValue(withChoices);
  const page = () => (
    <MemoryRouter initialEntries={['/?player_name=LeBron+James']}>
      <GameLogFilter />
    </MemoryRouter>
  );
  const { rerender } = render(page());
  await screen.findByText('Opposing Team Profile');
  await waitFor(() => expect(opponentRequests()).not.toEqual([]));
  await act(async () => {});
  const signedInReads = apiClient.get.mock.calls.length;

  mockSignedIn = false;
  rerender(page());
  await act(async () => {});
  fireEvent.change(screen.getByDisplayValue('Traditional'), { target: { value: 'Assists' } });
  await act(async () => {});
  const signedOutReads = apiClient.get.mock.calls
    .slice(signedInReads)
    .filter(([path]) => path === '/api/team_stats' || path === '/api/player_profile')
    .map(([, options]) => options.params);
  expect(signedOutReads).toContainEqual(expect.objectContaining({ category: 'Assists' }));
  expect(signedOutReads.filter((params) => 'season' in params)).toEqual([]);
});
