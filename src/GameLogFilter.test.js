import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import GameLogFilter from './GameLogFilter';
import { apiClient } from './config';
import { useAuth } from './contexts/AuthContext';
import { fetchGameLogsData } from './gameLogsApi';
import { createSavedFilterSet, fetchSavedFilterSets } from './savedFilterSetsApi';

jest.mock('./config', () => ({
  apiClient: { get: jest.fn() },
  getApiUrl: (name) => `/api/${name.toLowerCase()}`,
}));
jest.mock('./gameLogsApi', () => ({
  fetchGameLogsData: jest.fn(),
  getRequestErrorMessage: jest.fn(() => 'request failed'),
  isRequestCancelled: jest.fn(() => false),
}));
jest.mock('./contexts/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('./savedFilterSetsApi', () => ({
  fetchSavedFilterSets: jest.fn(),
  createSavedFilterSet: jest.fn(),
  renameSavedFilterSet: jest.fn(),
  deleteSavedFilterSet: jest.fn(),
}));
jest.mock('./NaturalLanguageQuery', () => ({
  __esModule: true,
  default: ({ inWorkspace, onFiltersApplied, onOpenSavedFilterSets }) => (
    <div data-testid="query-prompt">
      {String(inWorkspace)}
      <button type="button" onClick={() => onFiltersApplied(mockParsedFilters)}>
        Apply parsed query
      </button>
      {onOpenSavedFilterSets && !inWorkspace && (
        <button type="button" onClick={onOpenSavedFilterSets}>
          Saved Filter Sets
        </button>
      )}
    </div>
  ),
}));
jest.mock('./FilterOptions', () => ({
  __esModule: true,
  default: ({ onApplyFilters }) => (
    <button type="button" onClick={() => onApplyFilters(mockFilterPatch)}>
      Apply test filters
    </button>
  ),
}));
jest.mock('./PlayerSelector', () => ({ __esModule: true, default: () => null }));
jest.mock('./PlayerProfile', () => ({ __esModule: true, default: () => null }));
jest.mock('./OpposingTeamProfile', () => ({ __esModule: true, default: () => null }));
jest.mock('./PerformanceAverages', () => ({ __esModule: true, default: () => null }));
jest.mock('./ChartComponent', () => ({ __esModule: true, default: () => null }));
jest.mock('./GameLogsTable', () => ({ __esModule: true, default: () => null }));
jest.mock('./PlayerStatsCards', () => ({ __esModule: true, default: () => null }));

let mockAuthState;
let mockFilterPatch;
let mockParsedFilters;

const LocationProbe = () => {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <>
      <output data-testid="location">
        {location.pathname}
        {location.search}
      </output>
      <button type="button" onClick={() => navigate(-1)}>
        Browser back
      </button>
    </>
  );
};

const renderGameLogFilter = (initialEntries, initialIndex) =>
  render(
    <MemoryRouter initialEntries={initialEntries} initialIndex={initialIndex}>
      <GameLogFilter />
      <LocationProbe />
    </MemoryRouter>,
  );

beforeEach(() => {
  mockAuthState = { isAuthenticated: true, loading: false };
  mockFilterPatch = { game_filter: 5 };
  mockParsedFilters = { player_name: 'Stephen Curry', game_filter: 10 };
  useAuth.mockImplementation(() => mockAuthState);
  apiClient.get.mockImplementation(() => new Promise(() => {}));
  fetchGameLogsData.mockImplementation(() => new Promise(() => {}));
  fetchSavedFilterSets.mockResolvedValue([]);
  createSavedFilterSet.mockResolvedValue(undefined);
});

afterEach(() => {
  jest.clearAllMocks();
});

test('pushes an applied filter so browser Back returns to the previous filter URL', async () => {
  renderGameLogFilter(['/?player_name=LeBron+James']);

  await waitFor(() => expect(fetchGameLogsData).toHaveBeenCalled());
  fireEvent.click(screen.getByRole('button', { name: 'Apply test filters' }));

  await waitFor(() =>
    expect(screen.getByTestId('location')).toHaveTextContent(
      '/?player_name=LeBron+James&game_filter=5',
    ),
  );

  fireEvent.click(screen.getByRole('button', { name: 'Browser back' }));
  await waitFor(() =>
    expect(screen.getByTestId('location')).toHaveTextContent('/?player_name=LeBron+James'),
  );
});

test('replaces the URL with a parsed query Filter Set', async () => {
  renderGameLogFilter(['/?player_name=LeBron+James&game_filter=5']);

  await waitFor(() => expect(fetchGameLogsData).toHaveBeenCalled());
  fireEvent.click(screen.getByRole('button', { name: 'Apply parsed query' }));

  await waitFor(() =>
    expect(screen.getByTestId('location')).toHaveTextContent(
      '/?player_name=Stephen+Curry&game_filter=10',
    ),
  );
});

test('a missing player reports an error without navigating', async () => {
  renderGameLogFilter(['/?game_filter=10']);

  fireEvent.click(screen.getByRole('button', { name: 'Apply test filters' }));

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Choose a player before applying these filters.',
  );
  expect(screen.getByTestId('location')).toHaveTextContent('/?game_filter=10');
  expect(fetchGameLogsData).not.toHaveBeenCalled();
});

test('strips only the browse sentinel from a refused raw query', async () => {
  renderGameLogFilter(['/?browse=1&game_filter=0&utm_source=twitter']);

  await waitFor(() =>
    expect(screen.getByTestId('location')).toHaveTextContent('/?game_filter=0&utm_source=twitter'),
  );
  expect(screen.getByTestId('location')).not.toHaveTextContent('browse');
  expect(fetchGameLogsData).not.toHaveBeenCalled();
  expect(screen.getByRole('alert')).toHaveTextContent('game_filter');
});

test('does not push when applying leaves the raw query string unchanged', async () => {
  mockFilterPatch = { game_filter: 10 };
  const rendered = renderGameLogFilter(['/', '/?player_name=LeBron+James&game_filter=10'], 1);

  await waitFor(() => expect(fetchGameLogsData).toHaveBeenCalled());
  fireEvent.click(screen.getByRole('button', { name: 'Apply test filters' }));
  fireEvent.click(screen.getByRole('button', { name: 'Browser back' }));

  await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/'));
  rendered.unmount();
});

test('uses the raw query string when deciding whether an apply changed anything', async () => {
  mockFilterPatch = { game_filter: 10 };
  renderGameLogFilter(['/', '/?game_filter=10&player_name=LeBron+James'], 1);

  await waitFor(() => expect(fetchGameLogsData).toHaveBeenCalled());
  fireEvent.click(screen.getByRole('button', { name: 'Apply test filters' }));

  await waitFor(() =>
    expect(screen.getByTestId('location')).toHaveTextContent(
      '/?player_name=LeBron+James&game_filter=10',
    ),
  );
});

test('keeps a URL-driven request held until authentication settles', async () => {
  mockAuthState.isAuthenticated = false;
  const rendered = renderGameLogFilter(['/?player_name=LeBron+James&game_filter=10']);

  await waitFor(() => expect(screen.getByText(/Sign in to load these game logs/)).toBeVisible());
  expect(screen.getByTestId('location')).toHaveTextContent(
    '/?player_name=LeBron+James&game_filter=10',
  );
  expect(fetchGameLogsData).not.toHaveBeenCalled();

  mockAuthState.isAuthenticated = true;
  rendered.rerender(
    <MemoryRouter initialEntries={['/?player_name=LeBron+James&game_filter=10']}>
      <GameLogFilter />
      <LocationProbe />
    </MemoryRouter>,
  );

  await waitFor(() => expect(fetchGameLogsData).toHaveBeenCalledTimes(1));
  expect(screen.getByTestId('location')).toHaveTextContent(
    '/?player_name=LeBron+James&game_filter=10',
  );
});

test('keeps a refused link unchanged, refuses a panel apply, and accepts a parsed query', async () => {
  renderGameLogFilter(['/?player_name=LeBron+James&game_filter=0']);

  expect(await screen.findByRole('alert')).toHaveTextContent('game_filter');
  expect(screen.getByTestId('location')).toHaveTextContent(
    '/?player_name=LeBron+James&game_filter=0',
  );
  expect(screen.queryByRole('button', { name: 'Apply test filters' })).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Apply parsed query' }));

  await waitFor(() =>
    expect(screen.getByTestId('location')).toHaveTextContent(
      '/?player_name=Stephen+Curry&game_filter=10',
    ),
  );
});

test('saves the Log Workspace URL exactly as it stands', async () => {
  renderGameLogFilter(['/?player_name=LeBron+James&game_filter=10']);

  await waitFor(() => expect(fetchGameLogsData).toHaveBeenCalled());
  fireEvent.click(screen.getByRole('button', { name: 'Save Filter Set' }));
  fireEvent.change(await screen.findByLabelText('Name'), {
    target: { value: 'LeBron last 10' },
  });
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  });

  expect(createSavedFilterSet).toHaveBeenCalledWith({
    name: 'LeBron last 10',
    queryString: 'player_name=LeBron+James&game_filter=10',
  });
});

test('reaches the saved list from the Query Prompt and from the Log Workspace', async () => {
  const promptRender = renderGameLogFilter(['/']);

  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Saved Filter Sets' }));
  });
  expect(await screen.findByRole('heading', { name: 'Saved Filter Sets' })).toBeVisible();
  expect(fetchSavedFilterSets).toHaveBeenCalledTimes(1);
  promptRender.unmount();

  renderGameLogFilter(['/?player_name=LeBron+James']);
  await waitFor(() => expect(fetchGameLogsData).toHaveBeenCalled());
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Saved Filter Sets' }));
  });
  expect(await screen.findByRole('heading', { name: 'Saved Filter Sets' })).toBeVisible();
});

test('offers no save affordance and no saved list while signed out', async () => {
  mockAuthState.isAuthenticated = false;
  renderGameLogFilter(['/?player_name=LeBron+James&game_filter=10']);

  await waitFor(() => expect(screen.getByText(/Sign in to load these game logs/)).toBeVisible());
  expect(screen.queryByRole('button', { name: 'Save Filter Set' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Saved Filter Sets' })).not.toBeInTheDocument();
  expect(fetchSavedFilterSets).not.toHaveBeenCalled();
});

test('a saved link we can no longer honour opens with the existing URL-entry refusal', async () => {
  fetchSavedFilterSets.mockResolvedValue([
    { id: 1, name: 'Saved before the rules changed', queryString: 'game_filter=0' },
  ]);
  renderGameLogFilter(['/']);

  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Saved Filter Sets' }));
  });
  fireEvent.click(
    await screen.findByRole('button', {
      name: 'Open saved Filter Set Saved before the rules changed',
    }),
  );

  expect(await screen.findByRole('alert')).toHaveTextContent('game_filter');
  expect(screen.getByTestId('location')).toHaveTextContent('/?game_filter=0');
  expect(fetchGameLogsData).not.toHaveBeenCalled();
});

test('offers nothing to save until the URL carries a Filter Set', async () => {
  renderGameLogFilter(['/?browse=1']);

  expect(await screen.findByRole('button', { name: 'Saved Filter Sets' })).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Save Filter Set' })).not.toBeInTheDocument();
});

test('names the tab after the player the URL shows, and hands the default back', async () => {
  const { unmount } = renderGameLogFilter(['/?player_name=LeBron+James&game_filter=10']);

  await waitFor(() => expect(document.title).toBe('LeBron James Game Logs | CourtAI'));

  fireEvent.click(screen.getByRole('button', { name: 'Apply parsed query' }));
  await waitFor(() => expect(document.title).toBe('Stephen Curry Game Logs | CourtAI'));

  unmount();
  expect(document.title).toBe('CourtAI | NBA Game Log Analytics');
});

test('does not name a tab after a link it refuses', async () => {
  renderGameLogFilter(['/?player_name=LeBron+James&game_filter=0']);

  expect(await screen.findByRole('alert')).toHaveTextContent('game_filter');
  expect(document.title).toBe('CourtAI | NBA Game Log Analytics');
});
