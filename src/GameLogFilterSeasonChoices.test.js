import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import GameLogFilter from './GameLogFilter';
import { apiClient } from './config';
import { fetchGameLogsData } from './gameLogsApi';
import { fetchSeasons } from './seasonsApi';
import { SeasonUnavailableError } from './servingSeason';
import { fetchSavedFilterSets } from './savedFilterSetsApi';
import { publishedOnlySeasons } from './seasonChoicesFixture';

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
// A Parsed Query naming only the player, which on a player_name-only URL is an unchanged apply.
jest.mock('./NaturalLanguageQuery', () => ({
  __esModule: true,
  default: ({ onFiltersApplied }) => (
    <button type="button" onClick={() => onFiltersApplied({ player_name: 'LeBron James' })}>
      Ask again
    </button>
  ),
}));
jest.mock('./PlayerSelector', () => ({ __esModule: true, default: () => null }));
jest.mock('./PlayerProfile', () => ({
  __esModule: true,
  default: ({ seasonChoice }) => (
    <output aria-label="Profile season">{seasonChoice?.season ?? 'default'}</output>
  ),
}));
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

// The panel's unfiltered season read, then the Workspace's own read.
const requests = () => fetchGameLogsData.mock.calls.map(([params]) => params);
const seasonSelect = () => screen.findByRole('combobox', { name: 'Season' });

beforeEach(() => {
  // A 2026-27 Slate date, so 2026-27 is not after today's season.
  jest.useFakeTimers({ now: new Date('2026-10-27T16:00:00Z'), advanceTimers: true });
  apiClient.get.mockImplementation(() => new Promise(() => {}));
  fetchGameLogsData.mockResolvedValue(logs);
  fetchSeasons.mockResolvedValue(withChoices);
});
afterEach(() => {
  jest.useRealTimers();
  jest.clearAllMocks();
});

test('with 2026-27 offered and no season_filter, the first read and the Season control are 2026-27', async () => {
  renderAt('/?player_name=LeBron+James');
  const select = await seasonSelect();
  await waitFor(() =>
    expect(optionLabels(select)).toEqual([
      '2026-27 · early, 2–4 games per team',
      '2025-26',
      '2024-25',
    ]),
  );
  await waitFor(() => expect(select).toHaveValue('2026-27'));
  expect(requests()).toEqual([
    { player_name: 'LeBron James', season_filter: '2026-27' },
    { player_name: 'LeBron James', season_filter: '2026-27' },
  ]);
  expect(url()).toBe('/?player_name=LeBron+James');
  expect(screen.getByTestId('evidence-season-chip')).toHaveTextContent(
    'Evidence season 2026-27 · early, 2–4 games per team',
  );
});

test('an unchanged apply re-reads the page season', async () => {
  renderAt('/?player_name=LeBron+James');
  await screen.findByText('Game list of 1');
  fetchGameLogsData.mockClear();
  fireEvent.click(screen.getByRole('button', { name: 'Ask again' }));
  await waitFor(() => expect(requests()).toHaveLength(1));
  expect(requests()).toEqual([{ player_name: 'LeBron James', season_filter: '2026-27' }]);
});

test('an unchanged apply while /seasons is pending waits for the season', async () => {
  let answerSeasons;
  fetchSeasons.mockReturnValue(new Promise((resolve) => (answerSeasons = resolve)));
  renderAt('/?player_name=LeBron+James');
  fireEvent.click(await screen.findByRole('button', { name: 'Ask again' }));
  await act(async () => {});
  expect(requests()).toEqual([]);

  await act(async () => answerSeasons(withChoices));
  await screen.findByText('Game list of 1');
  expect(requests()).toEqual([
    { player_name: 'LeBron James', season_filter: '2026-27' },
    { player_name: 'LeBron James', season_filter: '2026-27' },
  ]);
});

test('on a 2025-26 Slate date, 2026-27 offered is not the default', async () => {
  jest.setSystemTime(new Date('2026-09-12T16:00:00Z'));
  renderAt('/?player_name=LeBron+James');
  await screen.findByText('Game list of 1');
  expect(requests()).toEqual([{ player_name: 'LeBron James' }, { player_name: 'LeBron James' }]);
  expect(await seasonSelect()).toHaveValue('2025-26');
});

test.each([
  ['only 2025-26 is offered', () => fetchSeasons.mockResolvedValue(publishedOnlySeasons)],
  ['the seasons read fails', () => fetchSeasons.mockRejectedValue(new Error('seasons down'))],
])('when %s, the request is as before', async (_name, arrange) => {
  arrange();
  renderAt('/?player_name=LeBron+James');
  await screen.findByText('Game list of 1');
  expect(requests()).toEqual([{ player_name: 'LeBron James' }, { player_name: 'LeBron James' }]);
  expect(screen.queryByTestId('evidence-season-chip')).toBeNull();
});

test('a link naming season_filter=2025-26 keeps it and reads it at once', async () => {
  renderAt('/?player_name=LeBron+James&season_filter=2025-26&game_filter=5');
  await screen.findByText('Game list of 1');
  expect(requests()).toEqual([
    { player_name: 'LeBron James', season_filter: '2025-26' },
    { player_name: 'LeBron James', season_filter: '2025-26', game_filter: 5 },
  ]);
  expect(await seasonSelect()).toHaveValue('2025-26');
  expect(url()).toBe('/?player_name=LeBron+James&season_filter=2025-26&game_filter=5');
});

test('with no season_filter nothing is read until /seasons answers; a linked season is', async () => {
  fetchSeasons.mockReturnValue(new Promise(() => {}));
  renderAt('/?player_name=LeBron+James&game_filter=5');
  await act(async () => {});
  expect(requests()).toEqual([]);

  renderAt('/?player_name=LeBron+James&season_filter=2025-26&game_filter=5');
  await waitFor(() =>
    expect(requests()).toEqual([
      { player_name: 'LeBron James', season_filter: '2025-26' },
      { player_name: 'LeBron James', season_filter: '2025-26', game_filter: 5 },
    ]),
  );
});

test('a saved Filter Set naming season_filter=2025-26 keeps it; one naming none reads 2026-27', async () => {
  fetchSavedFilterSets.mockResolvedValue([
    { id: 1, name: 'Last season', queryString: 'player_name=LeBron+James&season_filter=2025-26' },
    { id: 2, name: 'Home', queryString: 'player_name=LeBron+James&location_filter=Home' },
  ]);
  renderAt('/?player_name=LeBron+James');
  await screen.findByText('Game list of 1');

  fireEvent.click(await screen.findByRole('tab', { name: /^Saved/ }));
  fireEvent.click(await screen.findByRole('button', { name: 'Open saved Filter Set Last season' }));
  await waitFor(() => expect(url()).toBe('/?player_name=LeBron+James&season_filter=2025-26'));
  await waitFor(() =>
    expect(requests().at(-1)).toEqual({ player_name: 'LeBron James', season_filter: '2025-26' }),
  );

  fireEvent.click(screen.getByRole('tab', { name: /^Saved/ }));
  fireEvent.click(await screen.findByRole('button', { name: 'Open saved Filter Set Home' }));
  await waitFor(() => expect(url()).toBe('/?player_name=LeBron+James&location_filter=Home'));
  await waitFor(() =>
    expect(requests().at(-1)).toEqual({
      player_name: 'LeBron James',
      location_filter: 'Home',
      season_filter: '2026-27',
    }),
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

test('choosing 2025-26 writes season_filter and survives a reload; choosing 2026-27 removes it', async () => {
  const { unmount } = renderAt('/?player_name=LeBron+James');
  await screen.findByText('Game list of 1');
  fireEvent.change(await seasonSelect(), { target: { value: '2025-26' } });
  await waitFor(() => expect(url()).toBe('/?player_name=LeBron+James&season_filter=2025-26'));
  await waitFor(() =>
    expect(requests().at(-1)).toEqual({ player_name: 'LeBron James', season_filter: '2025-26' }),
  );
  expect(screen.queryByTestId('evidence-season-chip')).toBeNull();
  unmount();

  fetchGameLogsData.mockClear();
  renderAt('/?player_name=LeBron+James&season_filter=2025-26');
  await screen.findByText('Game list of 1');
  expect(requests()).toEqual([
    { player_name: 'LeBron James', season_filter: '2025-26' },
    { player_name: 'LeBron James', season_filter: '2025-26' },
  ]);
  expect(await seasonSelect()).toHaveValue('2025-26');

  fireEvent.change(await seasonSelect(), { target: { value: '2026-27' } });
  await waitFor(() => expect(url()).toBe('/?player_name=LeBron+James'));
  await waitFor(() =>
    expect(requests().at(-1)).toEqual({ player_name: 'LeBron James', season_filter: '2026-27' }),
  );
});

test('a published or retained season shows no chip', async () => {
  renderAt('/?player_name=LeBron+James&season_filter=2024-25');
  expect(await screen.findByRole('combobox', { name: 'Season' })).toHaveValue('2024-25');
  await screen.findByText('Game list of 1');
  expect(screen.queryByTestId('evidence-season-chip')).toBeNull();
});

test('a 503 season_unavailable says 2026-27 is not available yet and shows no game list', async () => {
  fetchGameLogsData.mockRejectedValue(refusal());
  renderAt('/?player_name=LeBron+James');

  const alert = await screen.findByRole('alert');
  expect(alert).toHaveTextContent(
    "2026-27 isn't available yet. CourtAI still reads 2025-26 by default.",
  );
  expect(screen.queryByText(/Game list of/)).toBeNull();

  fetchGameLogsData.mockResolvedValue(logs);
  fireEvent.click(within(alert).getByRole('button', { name: 'Show 2025-26' }));
  await waitFor(() => expect(url()).toBe('/?player_name=LeBron+James&season_filter=2025-26'));
  expect(await screen.findByText('Game list of 1')).toBeInTheDocument();
  expect(screen.queryByRole('alert')).toBeNull();
});

test('a linked season outside the choices falls back to the default and says so', async () => {
  renderAt('/?player_name=LeBron+James&season_filter=2027-28&game_filter=5');

  expect(
    await screen.findByText('2027-28 isn’t offered, so these are 2026-27 game logs.'),
  ).toBeInTheDocument();
  expect(url()).toBe('/?player_name=LeBron+James&game_filter=5');
  await waitFor(() =>
    expect(screen.getByRole('combobox', { name: 'Season' })).toHaveValue('2026-27'),
  );
  await waitFor(() =>
    expect(fetchGameLogsData).toHaveBeenLastCalledWith(
      { player_name: 'LeBron James', game_filter: 5, season_filter: '2026-27' },
      expect.anything(),
    ),
  );
  expect(await screen.findByText('Game list of 1')).toBeInTheDocument();
});

test('a season-only link outside the choices keeps the Workspace open with its notice', async () => {
  renderAt('/?season_filter=2027-28');

  expect(
    await screen.findByText('2027-28 isn’t offered, so these are 2026-27 game logs.'),
  ).toBeInTheDocument();
  expect(url()).toBe('/?browse=1');
  expect(screen.getByRole('button', { name: 'Back to search' })).toBeInTheDocument();
});

test('a refusal names its published season and offers it when the seasons read fails', async () => {
  fetchSeasons.mockRejectedValue(new Error('seasons down'));
  fetchGameLogsData.mockRejectedValue(refusal());
  renderAt('/?player_name=LeBron+James&season_filter=2026-27');

  const alert = await screen.findByRole('alert');
  expect(alert).toHaveTextContent(
    "2026-27 isn't available yet. CourtAI still reads 2025-26 by default.",
  );

  fetchGameLogsData.mockResolvedValue(logs);
  fireEvent.click(within(alert).getByRole('button', { name: 'Show 2025-26' }));
  await waitFor(() => expect(url()).toBe('/?player_name=LeBron+James'));
  expect(await screen.findByText('Game list of 1')).toBeInTheDocument();
});

// The Player Profile reads the Workspace's season as its Evidence season
// (crf04/statsplus#330), named only when it is not the default.
test.each([
  ['no season', '', '2026-27'],
  ['the Published Season', '&season_filter=2025-26', 'default'],
  ['2026-27', '&season_filter=2026-27', '2026-27'],
  ['a retained season', '&season_filter=2024-25', '2024-25'],
])('with %s the Player Profile reads %s', async (_name, query, expected) => {
  renderAt(`/?player_name=LeBron+James${query}`);
  await screen.findByText('Game list of 1');
  await waitFor(() => expect(screen.getByLabelText('Profile season')).toHaveTextContent(expected));
});

test('without choices the Player Profile names no season', async () => {
  fetchSeasons.mockResolvedValue({ seasons: ['2025-26', '2024-25'], defaultSeason: '2025-26' });
  renderAt('/?player_name=LeBron+James&season_filter=2024-25');
  await screen.findByText('Game list of 1');
  expect(screen.getByLabelText('Profile season')).toHaveTextContent('default');
});
