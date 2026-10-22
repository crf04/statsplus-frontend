import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import GameLogFilter from './GameLogFilter';
import { apiClient } from './config';
import { fetchGameLogsData } from './gameLogsApi';

// The real panel and Query Prompt, so the Line Type is exercised beside the
// draft edits and Parsed Queries it must not disturb.
jest.mock('./config', () => ({
  apiClient: { get: jest.fn(), post: jest.fn() },
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
const lineTypeSelect = () => screen.findByRole('combobox', { name: 'Line Type:' });
const PLAYER = '/?player_name=LeBron+James';
// The panel's unfiltered season read is a request of its own; these are the
// requests for the Filter Set on screen.
const lastTenRequests = () =>
  fetchGameLogsData.mock.calls.filter(([params]) => params.game_filter === 10);

beforeEach(() => {
  apiClient.get.mockImplementation(() => new Promise(() => {}));
  fetchGameLogsData.mockImplementation(() => new Promise(() => {}));
});

afterEach(() => jest.clearAllMocks());

test('changing the Line Type keeps unapplied filter edits and requests nothing', async () => {
  renderAt(`${PLAYER}&game_filter=10`);
  await lineTypeSelect();
  await waitFor(() => expect(lastTenRequests()).toHaveLength(1));
  fireEvent.click(screen.getByRole('button', { name: 'Remove last' }));
  expect(screen.getByRole('button', { name: 'Apply 1 change' })).toBeInTheDocument();

  fireEvent.change(await lineTypeSelect(), { target: { value: 'REB' } });
  await waitFor(() => expect(url()).toBe(`${PLAYER}&game_filter=10&line_type=REB`));

  expect(screen.getByRole('button', { name: 'Apply 1 change' })).toBeInTheDocument();
  expect(lastTenRequests()).toHaveLength(1);
});

test('a Line Type chosen while a Parsed Query is in flight survives its arrival', async () => {
  let answer;
  fetchGameLogsData.mockResolvedValue({ gameLogs: [], averages: [], nextGame: null });
  apiClient.post.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        answer = resolve;
      }),
  );
  renderAt(`${PLAYER}&line_type=REB`);
  await act(async () => {});
  fireEvent.click(screen.getByRole('button', { name: 'Open search' }));
  const input = await screen.findByPlaceholderText('Ask about your favorite player');
  fireEvent.change(input, { target: { value: 'LeBron last 5' } });
  fireEvent.submit(input.closest('form'));
  expect(answer).toBeDefined();

  fireEvent.change(await lineTypeSelect(), { target: { value: 'AST' } });
  await waitFor(() => expect(url()).toBe(`${PLAYER}&line_type=AST`));
  await act(async () => answer({ data: { player_name: 'LeBron James', game_count: 5 } }));

  await waitFor(() => expect(url()).toBe(`${PLAYER}&game_filter=5&line_type=AST`));
});
