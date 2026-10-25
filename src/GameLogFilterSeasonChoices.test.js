import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import GameLogFilter from './GameLogFilter';
import { apiClient } from './config';
import { fetchGameLogsData } from './gameLogsApi';
import { fetchSeasons } from './seasonsApi';
import { SeasonUnavailableError } from './servingSeason';

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
jest.mock('./contexts/AuthContext', () => ({
  useAuth: () => ({ isAuthenticated: true, loading: false }),
}));
jest.mock('./savedFilterSetsApi', () => ({
  fetchSavedFilterSets: jest.fn(() => Promise.resolve([])),
  subscribeSavedFilterSets: jest.fn(() => () => {}),
}));
jest.mock('./NaturalLanguageQuery', () => ({ __esModule: true, default: () => null }));
jest.mock('./PlayerSelector', () => ({ __esModule: true, default: () => null }));
jest.mock('./PlayerProfile', () => ({ __esModule: true, default: () => null }));
jest.mock('./OpposingTeamProfile', () => ({ __esModule: true, default: () => null }));
jest.mock('./ChartComponent', () => ({ __esModule: true, default: () => null }));
jest.mock('./PerformanceAverages', () => ({ __esModule: true, default: () => null }));
jest.mock('./GameLogsTable', () => ({
  __esModule: true,
  default: ({ gameLogs }) => <p>Game list of {gameLogs.length}</p>,
}));
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
const optionLabels = (select) =>
  within(select)
    .getAllByRole('option')
    .map((o) => o.textContent);

const family = (season) => ({ servedSeason: season, state: 'serving', reason: null });
const withChoices = {
  seasons: ['2025-26', '2024-25'],
  defaultSeason: '2025-26',
  choices: [
    {
      season: '2026-27',
      mode: 'unpublished',
      families: { game_logs: family('2026-27') },
      teamGames: { min: 2, max: 4 },
    },
    {
      season: '2025-26',
      mode: 'published',
      families: { game_logs: family('2025-26') },
      teamGames: null,
    },
    {
      season: '2024-25',
      mode: 'retained',
      families: { game_logs: family('2024-25') },
      teamGames: null,
    },
  ],
};
const logs = { gameLogs: [{ GAME_DATE: '2026-10-22' }], averages: [], playerId: 2544 };
const refusal = () =>
  new SeasonUnavailableError({
    response: {
      status: 503,
      headers: {},
      data: {
        error: {
          code: 'season_unavailable',
          message: 'The requested season is unavailable.',
          details: { selected_season: '2026-27', published_season: '2025-26' },
        },
      },
    },
  });

beforeEach(() => {
  apiClient.get.mockImplementation(() => new Promise(() => {}));
  fetchGameLogsData.mockResolvedValue(logs);
  fetchSeasons.mockResolvedValue(withChoices);
});
afterEach(() => jest.clearAllMocks());

test('offers 2026-27 labelled with its sample, the others as today, and starts on the default', async () => {
  renderAt('/?player_name=LeBron+James');
  const select = await screen.findByRole('combobox', { name: 'Season' });
  await waitFor(() =>
    expect(optionLabels(select)).toEqual([
      '2026-27 · early, 2–4 games per team',
      '2025-26',
      '2024-25',
    ]),
  );
  expect(select).toHaveValue('2025-26');
  expect(screen.queryByTestId('evidence-season-chip')).toBeNull();
  expect(fetchGameLogsData).toHaveBeenLastCalledWith(
    { player_name: 'LeBron James' },
    expect.anything(),
  );
});

test('an older backend without choices lists its bare seasons as today', async () => {
  fetchSeasons.mockResolvedValue({ seasons: ['2026-27', '2025-26'], defaultSeason: '2025-26' });
  renderAt('/?player_name=LeBron+James&season_filter=2023-24');
  const select = await screen.findByRole('combobox', { name: 'Season' });
  await waitFor(() => expect(optionLabels(select)).toEqual(['2023-24', '2026-27', '2025-26']));
  expect(select).toHaveValue('2023-24');
  expect(url()).toBe('/?player_name=LeBron+James&season_filter=2023-24');
  expect(screen.queryByTestId('evidence-season-chip')).toBeNull();
});

test('choosing 2026-27 keeps season_filter in the URL and names its sample in a chip', async () => {
  renderAt('/?player_name=LeBron+James');
  fireEvent.change(await screen.findByRole('combobox', { name: 'Season' }), {
    target: { value: '2026-27' },
  });

  await waitFor(() => expect(url()).toBe('/?player_name=LeBron+James&season_filter=2026-27'));
  expect(await screen.findByTestId('evidence-season-chip')).toHaveTextContent(
    'Evidence season 2026-27 · early, 2–4 games per team',
  );
  await waitFor(() =>
    expect(fetchGameLogsData).toHaveBeenLastCalledWith(
      { player_name: 'LeBron James', season_filter: '2026-27' },
      expect.anything(),
    ),
  );
  expect(await screen.findByText('Game list of 1')).toBeInTheDocument();
});

test('a published or retained season shows no chip', async () => {
  renderAt('/?player_name=LeBron+James&season_filter=2024-25');
  expect(await screen.findByRole('combobox', { name: 'Season' })).toHaveValue('2024-25');
  await screen.findByText('Game list of 1');
  expect(screen.queryByTestId('evidence-season-chip')).toBeNull();
});

test('a 503 season_unavailable says 2026-27 is not available yet and shows no game list', async () => {
  fetchGameLogsData.mockRejectedValue(refusal());
  renderAt('/?player_name=LeBron+James&season_filter=2026-27');

  const alert = await screen.findByRole('alert');
  expect(alert).toHaveTextContent(
    "2026-27 isn't available yet. CourtAI still reads 2025-26 by default.",
  );
  expect(screen.queryByText(/Game list of/)).toBeNull();

  fetchGameLogsData.mockResolvedValue(logs);
  fireEvent.click(within(alert).getByRole('button', { name: 'Show 2025-26' }));
  await waitFor(() => expect(url()).toBe('/?player_name=LeBron+James'));
  expect(await screen.findByText('Game list of 1')).toBeInTheDocument();
  expect(screen.queryByRole('alert')).toBeNull();
});

test('a linked season outside the choices falls back to the default and says so', async () => {
  renderAt('/?player_name=LeBron+James&season_filter=2027-28&game_filter=5');

  expect(
    await screen.findByText('2027-28 isn’t offered, so these are 2025-26 game logs.'),
  ).toBeInTheDocument();
  expect(url()).toBe('/?player_name=LeBron+James&game_filter=5');
  expect(screen.getByRole('combobox', { name: 'Season' })).toHaveValue('2025-26');
  await waitFor(() =>
    expect(fetchGameLogsData).toHaveBeenLastCalledWith(
      { player_name: 'LeBron James', game_filter: 5 },
      expect.anything(),
    ),
  );
  expect(await screen.findByText('Game list of 1')).toBeInTheDocument();
});
