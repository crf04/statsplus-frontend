import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import GameLogFilter from './GameLogFilter';
import { apiClient } from './config';
import { fetchGameLogsData } from './gameLogsApi';

// The Workspace waits for /seasons before reading; only the Published Season is offered.
jest.mock('./seasonsApi', () => ({
  fetchSeasons: () => Promise.resolve({ seasons: ['2025-26'], defaultSeason: '2025-26' }),
}));
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

const LocationProbe = () => {
  const location = useLocation();
  const navigate = useNavigate();
  return (
    <>
      <output data-testid="location">{location.pathname + location.search}</output>
      <button type="button" onClick={() => navigate(-1)}>
        Browser back
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
const lineTypeSelect = () => screen.findByRole('combobox', { name: 'Line Type:' });
const PLAYER = '/?player_name=LeBron+James';

beforeEach(() => {
  apiClient.get.mockImplementation(() => new Promise(() => {}));
  fetchGameLogsData.mockImplementation(() => new Promise(() => {}));
});

afterEach(() => jest.clearAllMocks());

test('a link carrying line_type opens on that stat', async () => {
  renderAt([`${PLAYER}&line_type=REB`]);

  expect(await lineTypeSelect()).toHaveValue('REB');
});

test('choosing a Line Type writes it to the URL without a new history entry', async () => {
  renderAt(['/', PLAYER], 1);

  fireEvent.change(await lineTypeSelect(), { target: { value: 'AST' } });
  await waitFor(() => expect(url()).toBe(`${PLAYER}&line_type=AST`));

  fireEvent.click(screen.getByRole('button', { name: 'Browser back' }));
  await waitFor(() => expect(url()).toBe('/'));
});

test('the default Line Type is omitted from the URL', async () => {
  renderAt([`${PLAYER}&line_type=REB`]);

  fireEvent.change(await lineTypeSelect(), { target: { value: 'PTS' } });

  await waitFor(() => expect(url()).toBe(PLAYER));
});

test('applying a filter keeps the chosen Line Type', async () => {
  renderAt([`${PLAYER}&line_type=REB`]);

  fireEvent.click(await screen.findByRole('button', { name: 'Apply test filters' }));

  await waitFor(() => expect(url()).toBe(`${PLAYER}&game_filter=5&line_type=REB`));
  expect(await lineTypeSelect()).toHaveValue('REB');
});

test('choosing a season keeps the chosen Line Type', async () => {
  renderAt([`${PLAYER}&line_type=REB`]);

  fireEvent.click(await screen.findByRole('button', { name: 'Choose 2024-25' }));

  await waitFor(() => expect(url()).toBe(`${PLAYER}&season_filter=2024-25&line_type=REB`));
});

test('removing the browse sentinel keeps the Line Type', async () => {
  renderAt([`${PLAYER}&browse=1&line_type=REB`]);

  await waitFor(() => expect(url()).toBe(`${PLAYER}&line_type=REB`));
});

test.each(['line_type=XYZ', 'line_type=REB&line_type=AST', 'line_type='])(
  'an unusable value (%s) shows the default and still loads the Filter Set',
  async (param) => {
    renderAt([`${PLAYER}&game_filter=10&${param}`]);

    expect(await lineTypeSelect()).toHaveValue('PTS');
    await waitFor(() =>
      expect(fetchGameLogsData).toHaveBeenCalledWith(
        { player_name: 'LeBron James', game_filter: 10 },
        expect.anything(),
      ),
    );
    expect(screen.queryByRole('alert')).toBeNull();
  },
);

test('the Line Type never reaches a request', async () => {
  renderAt([`${PLAYER}&game_filter=10&line_type=REB`]);

  await waitFor(() => expect(fetchGameLogsData).toHaveBeenCalled());
  fireEvent.change(await lineTypeSelect(), { target: { value: 'AST' } });
  await waitFor(() => expect(url()).toContain('line_type=AST'));

  const sent = JSON.stringify([fetchGameLogsData.mock.calls, apiClient.get.mock.calls]);
  expect(sent).not.toContain('line_type');
});
