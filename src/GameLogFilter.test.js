import { clearRevisitCaches } from './revisitCache';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import GameLogFilter from './GameLogFilter';
import { apiClient } from './config';
import { useAuth } from './contexts/AuthContext';
import { fetchGameLogsData } from './gameLogsApi';
import { createSavedFilterSet, fetchSavedFilterSets } from './savedFilterSetsApi';

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
jest.mock('./contexts/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('./savedFilterSetsApi', () => ({
  fetchSavedFilterSets: jest.fn(),
  subscribeSavedFilterSets: jest.fn(() => () => {}),
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
  default: (props) => {
    if (mockRealFilterOptions) {
      const Actual = jest.requireActual('./FilterOptions').default;
      return <Actual {...props} />;
    }
    return (
      <button type="button" onClick={() => props.onApplyFilters(mockFilterPatch)}>
        Apply test filters
      </button>
    );
  },
}));
jest.mock('./PlayerSelector', () => ({
  __esModule: true,
  default: ({ setSelectedPlayer }) => (
    <button type="button" onClick={() => setSelectedPlayer('Stephen Curry')}>
      Choose Stephen Curry
    </button>
  ),
}));
// Reports itself settled only when a test asks to see the Workspace reveal.
jest.mock('./PlayerProfile', () => ({
  __esModule: true,
  default: function MockPlayerProfile({ selectedPlayer, selectedTeam, onSettled }) {
    const { useEffect } = jest.requireActual('react');
    useEffect(() => {
      if (mockRealFilterOptions) onSettled(selectedPlayer, selectedTeam);
    }, [onSettled, selectedPlayer, selectedTeam]);
    return null;
  },
}));
jest.mock('./OpposingTeamProfile', () => ({
  __esModule: true,
  default: (props) => {
    if (mockRealOpposingProfile) {
      const Actual = jest.requireActual('./OpposingTeamProfile').default;
      return <Actual {...props} />;
    }
    return (
      <div>
        <output data-testid="comparison-opponent">{props.selectedTeam}</output>
        <button onClick={() => props.setSelectedTeam('Denver Nuggets')}>Compare Denver</button>
      </div>
    );
  },
}));
jest.mock('./PerformanceAverages', () => {
  const { default: ActualPerformanceAverages } = jest.requireActual('./PerformanceAverages');
  return { __esModule: true, default: ActualPerformanceAverages };
});
jest.mock('./ChartComponent', () => ({
  __esModule: true,
  default: ({ postedLine }) => {
    const { createElement } = jest.requireActual('react');
    return createElement(
      'output',
      { 'data-testid': 'chart-posted-line' },
      postedLine?.markets?.PTS?.default.key ?? 'none',
    );
  },
}));
jest.mock('./GameLogsTable', () => ({ __esModule: true, default: () => null }));

// The real filter panel measures itself.
global.ResizeObserver = class {
  observe() {}
  disconnect() {}
};
window.matchMedia = () => ({ matches: false });

let mockAuthState;
let mockFilterPatch;
let mockParsedFilters;
let mockRealOpposingProfile;
let mockRealFilterOptions;

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

const TEAMS = ['Atlanta Hawks', 'Boston Celtics', 'Charlotte Hornets', 'Denver Nuggets'];
// The schedule names opponents by their short name, as production does.
const SHORT_NAMES = { BOS: 'Celtics', CHA: 'Hornets', SEA: 'SuperSonics' };
const nextGameAgainst = (opponent) => ({
  next_game: {
    game_id: '1',
    date: '2026-01-05',
    opponent,
    opponent_name: SHORT_NAMES[opponent],
    home: true,
  },
  opponent_ranks: [],
});
// The lists and the next-opponent read answer by endpoint; anything else
// (team stats) stays in flight.
const mockReads = ({ nextOpponent = nextGameAgainst('BOS'), teamStats } = {}) =>
  apiClient.get.mockImplementation((url, options) => {
    if (url === '/api/teams') return Promise.resolve({ data: TEAMS });
    if (url === '/api/players') return Promise.resolve({ data: [] });
    if (url === '/api/next_opponent') {
      const answer =
        typeof nextOpponent === 'function'
          ? nextOpponent(options.params.player_name)
          : nextOpponent;
      return answer instanceof Error ? Promise.reject(answer) : Promise.resolve({ data: answer });
    }
    if (url === '/api/team_stats' && teamStats) return Promise.resolve({ data: teamStats });
    return new Promise(() => {});
  });

beforeEach(() => {
  mockAuthState = { isAuthenticated: true, loading: false };
  mockFilterPatch = { game_filter: 5 };
  mockParsedFilters = { player_name: 'Stephen Curry', game_filter: 10 };
  mockRealOpposingProfile = false;
  mockRealFilterOptions = false;
  useAuth.mockImplementation(() => mockAuthState);
  apiClient.get.mockImplementation(() => new Promise(() => {}));
  fetchGameLogsData.mockImplementation(() => new Promise(() => {}));
  fetchSavedFilterSets.mockResolvedValue([]);
  createSavedFilterSet.mockResolvedValue(undefined);
});

afterEach(() => {
  jest.useRealTimers();
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

test('choosing a different player clears the filters and keeps the season', async () => {
  renderGameLogFilter([
    '/?player_name=LeBron+James&season_filter=2024-25&game_filter=5&location_filter=Home&self_filters%5BPTS%5D=20%2C60',
  ]);

  await waitFor(() => expect(fetchGameLogsData).toHaveBeenCalled());
  fireEvent.click(screen.getByRole('button', { name: 'Choose Stephen Curry' }));

  await waitFor(() =>
    expect(screen.getByTestId('location').textContent).toBe(
      '/?player_name=Stephen+Curry&season_filter=2024-25',
    ),
  );
  await waitFor(() =>
    expect(fetchGameLogsData).toHaveBeenLastCalledWith(
      { player_name: 'Stephen Curry', season_filter: '2024-25' },
      expect.anything(),
    ),
  );
});

test('choosing a player for a link with filters but no player applies those filters', async () => {
  renderGameLogFilter(['/?game_filter=5']);

  fireEvent.click(await screen.findByRole('button', { name: 'Choose Stephen Curry' }));

  await waitFor(() =>
    expect(screen.getByTestId('location').textContent).toBe(
      '/?player_name=Stephen+Curry&game_filter=5',
    ),
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

test('a date range in the URL reaches the game-log request and shows both badges', async () => {
  renderGameLogFilter(['/?player_name=LeBron+James&date_filter=2026-01-01&date_to=2026-01-31']);

  await waitFor(() => expect(fetchGameLogsData).toHaveBeenCalled());
  expect(fetchGameLogsData.mock.calls[0][0]).toEqual({
    player_name: 'LeBron James',
    date_filter: '2026-01-01',
    date_to: '2026-01-31',
  });
  expect(screen.getByText('Date <= 2026-01-31')).toBeVisible();
});

test('an end date before the start date is refused naming date_to', async () => {
  renderGameLogFilter(['/?player_name=LeBron+James&date_filter=2026-02-01&date_to=2026-01-31']);

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'This link could not be opened: date_to is not a value we can apply. No filters were applied.',
  );
  expect(fetchGameLogsData).not.toHaveBeenCalled();
});

describe('Share', () => {
  afterEach(() => {
    delete navigator.share;
    delete navigator.clipboard;
  });

  test('copies the exact Log Workspace link and confirms it', async () => {
    let clipboardText = '';
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: (text) => {
          clipboardText = text;
          return Promise.resolve();
        },
      },
    });
    renderGameLogFilter(['/?player_name=LeBron+James&game_filter=10']);

    await waitFor(() => expect(fetchGameLogsData).toHaveBeenCalled());
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Share' }));
    });

    expect(clipboardText).toBe('http://localhost/?player_name=LeBron+James&game_filter=10');
    expect(screen.getByRole('button', { name: 'Copied' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Share' })).toBeInTheDocument(), {
      timeout: 3000,
    });
  });

  test('copies the link when the native share sheet fails rather than being dismissed', async () => {
    let clipboardText = '';
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: () => Promise.reject(new DOMException('Blocked', 'NotAllowedError')),
    });
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: (text) => {
          clipboardText = text;
          return Promise.resolve();
        },
      },
    });
    renderGameLogFilter(['/?player_name=LeBron+James&game_filter=10']);

    await waitFor(() => expect(fetchGameLogsData).toHaveBeenCalled());
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Share' }));
    });

    expect(clipboardText).toBe('http://localhost/?player_name=LeBron+James&game_filter=10');
    expect(screen.getByRole('button', { name: 'Copied' })).toBeInTheDocument();
  });

  test('hands the exact link to the native share sheet when there is one', async () => {
    let shared;
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: (data) => {
        shared = data;
        return Promise.reject(new DOMException('Dismissed', 'AbortError'));
      },
    });
    const writeText = jest.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    renderGameLogFilter(['/?player_name=LeBron+James&game_filter=10']);

    await waitFor(() => expect(fetchGameLogsData).toHaveBeenCalled());
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Share' }));
    });

    expect(shared.url).toBe('http://localhost/?player_name=LeBron+James&game_filter=10');
    expect(screen.getByRole('button', { name: 'Share' })).toBeEnabled();
    expect(writeText).not.toHaveBeenCalled();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  test('offers nothing to share until the URL carries a Filter Set', async () => {
    renderGameLogFilter(['/?browse=1']);

    expect(await screen.findByRole('button', { name: 'Back to search' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Share' })).not.toBeInTheDocument();
  });

  test('offers nothing to share for a refused link or a signed-out reader', async () => {
    const refused = renderGameLogFilter(['/?player_name=LeBron+James&game_filter=abc']);
    expect(await screen.findByRole('button', { name: 'Saved Filter Sets' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Share' })).not.toBeInTheDocument();
    refused.unmount();

    mockAuthState.isAuthenticated = false;
    renderGameLogFilter(['/?player_name=LeBron+James&game_filter=10']);
    await waitFor(() => expect(screen.getByText(/Sign in to load these game logs/)).toBeVisible());
    expect(screen.queryByRole('button', { name: 'Share' })).not.toBeInTheDocument();
  });
});

test('reaches the saved list from the Query Prompt; the Workspace keeps it in the panel', async () => {
  const promptRender = renderGameLogFilter(['/']);

  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Saved Filter Sets' }));
  });
  expect(await screen.findByRole('heading', { name: 'Saved Filter Sets' })).toBeVisible();
  expect(fetchSavedFilterSets).toHaveBeenCalledTimes(1);
  promptRender.unmount();

  // Saving and the saved list are the filter panel's Saved tab now, so the
  // Workspace toolbar carries neither.
  renderGameLogFilter(['/?player_name=LeBron+James&game_filter=10']);
  await waitFor(() => expect(fetchGameLogsData).toHaveBeenCalled());
  expect(screen.queryByRole('button', { name: 'Saved Filter Sets' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Save Filter Set' })).not.toBeInTheDocument();
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

/*
 * A saved Filter Set is stored as its query string, so replaying one is the
 * URL-entry path taken from the list rather than the address bar. The opponent
 * has to survive that round trip and reach the request, or a saved "vs OKC"
 * would quietly reopen as the whole season.
 */
test('replays a saved Filter Set with its opponent still fixed', async () => {
  fetchSavedFilterSets.mockResolvedValue([
    {
      id: 3,
      name: 'LeBron vs OKC',
      queryString: 'player_name=LeBron+James&opponent_tricode=OKC',
    },
  ]);
  renderGameLogFilter(['/']);

  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Saved Filter Sets' }));
  });
  fireEvent.click(
    await screen.findByRole('button', { name: 'Open saved Filter Set LeBron vs OKC' }),
  );

  await waitFor(() =>
    expect(fetchGameLogsData).toHaveBeenCalledWith(
      expect.objectContaining({ player_name: 'LeBron James', opponent_tricode: 'OKC' }),
      expect.anything(),
    ),
  );
  expect(screen.getByTestId('location')).toHaveTextContent(
    '/?player_name=LeBron+James&opponent_tricode=OKC',
  );
});

test('a refused link, which has no panel, keeps the way out to the saved list', async () => {
  renderGameLogFilter(['/?player_name=LeBron+James&game_filter=0']);

  expect(await screen.findByRole('alert')).toHaveTextContent('game_filter');
  expect(screen.queryByRole('button', { name: 'Save Filter Set' })).not.toBeInTheDocument();
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Saved Filter Sets' }));
  });
  expect(await screen.findByRole('heading', { name: 'Saved Filter Sets' })).toBeVisible();
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

test('returning to a full Filter Set reuses results and reapplying it refreshes', async () => {
  clearRevisitCaches();
  mockAuthState.currentUser = { uid: 'alice' };
  fetchGameLogsData.mockResolvedValue({ gameLogs: [], averages: [], nextGame: null });
  renderGameLogFilter(['/gamelogs?player_name=Stephen+Curry&game_filter=10']);
  const countFiltered = () =>
    fetchGameLogsData.mock.calls.filter(([params]) => params.game_filter).length;
  await waitFor(() => expect(countFiltered()).toBe(1));
  fireEvent.click(screen.getByRole('button', { name: 'Apply test filters' }));
  await waitFor(() => expect(countFiltered()).toBe(2));
  fireEvent.click(screen.getByRole('button', { name: 'Browser back' }));
  await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('game_filter=10'));
  expect(countFiltered()).toBe(2);
  mockFilterPatch = { game_filter: 10 };
  fireEvent.click(screen.getByRole('button', { name: 'Apply test filters' }));
  await waitFor(() => expect(countFiltered()).toBe(3));
});

test.each([
  { isAuthenticated: false, loading: false },
  { isAuthenticated: true, loading: true },
])('unchanged Apply waits for settled authentication: %j', async (authState) => {
  mockAuthState = authState;
  fetchGameLogsData.mockRejectedValue(new Error('unauthenticated'));

  mockFilterPatch = { game_filter: 10 };
  renderGameLogFilter(['/?player_name=Stephen+Curry&game_filter=10']);
  await act(async () =>
    fireEvent.click(screen.getByRole('button', { name: 'Apply test filters' })),
  );
  expect(fetchGameLogsData).not.toHaveBeenCalled();
  expect(screen.queryByText('request failed')).not.toBeInTheDocument();
});

test('unchanged Apply refreshes logs while preserving the comparison opponent', async () => {
  mockFilterPatch = { game_filter: 10 };
  mockReads();
  fetchGameLogsData.mockResolvedValue({ gameLogs: [], averages: [], nextGame: null });
  renderGameLogFilter(['/?player_name=Stephen+Curry&game_filter=10']);
  await waitFor(() =>
    expect(screen.getByTestId('comparison-opponent')).toHaveTextContent('Boston Celtics'),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Compare Denver' }));
  const before = fetchGameLogsData.mock.calls.length;
  await act(async () =>
    fireEvent.click(screen.getByRole('button', { name: 'Apply test filters' })),
  );
  expect(fetchGameLogsData).toHaveBeenCalledTimes(before + 1);
  expect(screen.getByTestId('comparison-opponent')).toHaveTextContent('Denver Nuggets');
});

test('unchanged Apply recovers from an initial failure with a default comparison opponent', async () => {
  mockFilterPatch = { game_filter: 10 };
  mockReads();
  fetchGameLogsData.mockRejectedValue(new Error('initial failure'));
  renderGameLogFilter(['/?player_name=Stephen+Curry&game_filter=10']);
  await screen.findByText('request failed');
  expect(screen.getByTestId('comparison-opponent')).toBeEmptyDOMElement();
  fetchGameLogsData.mockResolvedValue({ gameLogs: [], averages: [], nextGame: null });
  await act(async () =>
    fireEvent.click(screen.getByRole('button', { name: 'Apply test filters' })),
  );
  expect(screen.queryByText('request failed')).not.toBeInTheDocument();
  expect(screen.getByTestId('comparison-opponent')).toHaveTextContent('Boston Celtics');
});

describe('the Opposing Team Profile opens on the next opponent', () => {
  const nextOpponentCalls = () =>
    apiClient.get.mock.calls.filter(([url]) => url === '/api/next_opponent');

  beforeEach(() => {
    mockRealOpposingProfile = true;
    fetchGameLogsData.mockResolvedValue({ gameLogs: [], averages: [], nextGame: null });
  });

  test('the team select and the team-stats request name the next opponent, not the first team', async () => {
    mockReads({ nextOpponent: nextGameAgainst('CHA') });
    renderGameLogFilter(['/?player_name=Stephen+Curry']);

    await waitFor(() =>
      expect(screen.getAllByRole('combobox')[0]).toHaveValue('Charlotte Hornets'),
    );
    expect(apiClient.get).toHaveBeenCalledWith(
      '/api/team_stats',
      expect.objectContaining({
        params: expect.objectContaining({ team: 'Charlotte Hornets' }),
      }),
    );
    expect(apiClient.get).not.toHaveBeenCalledWith(
      '/api/team_stats',
      expect.objectContaining({
        params: expect.objectContaining({ team: 'Atlanta Hawks' }),
      }),
    );
  });

  test.each([
    ['has no next game', { next_game: null, opponent_ranks: [] }],
    ['names a team outside the list', nextGameAgainst('SEA')],
    ['fails', new Error('boom')],
  ])('falls back to the first team when the read %s', async (_label, nextOpponent) => {
    mockReads({ nextOpponent });
    renderGameLogFilter(['/?player_name=Stephen+Curry']);

    // An empty select already shows its first option, so wait for the request
    // that proves the fallback was chosen rather than for the displayed value.
    await waitFor(() =>
      expect(apiClient.get).toHaveBeenCalledWith(
        '/api/team_stats',
        expect.objectContaining({
          params: expect.objectContaining({ team: 'Atlanta Hawks' }),
        }),
      ),
    );
    expect(screen.getAllByRole('combobox')[0]).toHaveValue('Atlanta Hawks');
  });

  test('sends one next-opponent request per player load, with the real filter panel mounted', async () => {
    mockRealFilterOptions = true;
    mockReads({ nextOpponent: nextGameAgainst('CHA') });
    renderGameLogFilter(['/?player_name=Stephen+Curry']);

    await waitFor(() =>
      expect(screen.getAllByRole('combobox')[0]).toHaveValue('Charlotte Hornets'),
    );
    await act(async () => {});
    expect(nextOpponentCalls()).toHaveLength(1);
    expect(nextOpponentCalls()[0][1].params).toEqual({ player_name: 'Stephen Curry' });
  });

  test('a team picked by hand survives an unchanged Apply', async () => {
    mockFilterPatch = { game_filter: 10 };
    mockReads({ nextOpponent: nextGameAgainst('CHA') });
    renderGameLogFilter(['/?player_name=Stephen+Curry&game_filter=10']);
    await waitFor(() =>
      expect(screen.getAllByRole('combobox')[0]).toHaveValue('Charlotte Hornets'),
    );
    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'Denver Nuggets' } });
    await act(async () =>
      fireEvent.click(screen.getByRole('button', { name: 'Apply test filters' })),
    );

    expect(screen.getAllByRole('combobox')[0]).toHaveValue('Denver Nuggets');
    expect(nextOpponentCalls()).toHaveLength(1);
  });

  test('a team picked by hand survives a filter change for the same player', async () => {
    mockFilterPatch = { game_filter: 5 };
    mockReads({ nextOpponent: nextGameAgainst('CHA') });
    renderGameLogFilter(['/?player_name=Stephen+Curry&game_filter=10']);
    await waitFor(() =>
      expect(screen.getAllByRole('combobox')[0]).toHaveValue('Charlotte Hornets'),
    );
    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'Denver Nuggets' } });

    fireEvent.click(screen.getByRole('button', { name: 'Apply test filters' }));
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('game_filter=5'));
    await waitFor(() => expect(fetchGameLogsData).toHaveBeenCalledTimes(2));
    await act(async () => {});

    expect(screen.getAllByRole('combobox')[0]).toHaveValue('Denver Nuggets');
    expect(nextOpponentCalls()).toHaveLength(1);
  });

  test('a team picked by hand survives browser Back to the same player', async () => {
    mockReads({ nextOpponent: nextGameAgainst('CHA') });
    renderGameLogFilter(
      ['/?player_name=Stephen+Curry&game_filter=10', '/?player_name=Stephen+Curry&game_filter=5'],
      1,
    );
    await waitFor(() =>
      expect(screen.getAllByRole('combobox')[0]).toHaveValue('Charlotte Hornets'),
    );
    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'Denver Nuggets' } });

    fireEvent.click(screen.getByRole('button', { name: 'Browser back' }));
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('game_filter=10'));
    await waitFor(() => expect(fetchGameLogsData).toHaveBeenCalledTimes(2));
    await act(async () => {});

    expect(screen.getAllByRole('combobox')[0]).toHaveValue('Denver Nuggets');
    expect(nextOpponentCalls()).toHaveLength(1);
  });

  test("a different player gets that player's next opponent, not the previous team", async () => {
    mockReads({
      nextOpponent: (player) => nextGameAgainst(player === 'Stephen Curry' ? 'CHA' : 'BOS'),
    });
    renderGameLogFilter(['/?player_name=Stephen+Curry']);
    await waitFor(() =>
      expect(screen.getAllByRole('combobox')[0]).toHaveValue('Charlotte Hornets'),
    );
    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'Denver Nuggets' } });

    mockParsedFilters = { player_name: 'LeBron James' };
    fireEvent.click(screen.getByRole('button', { name: 'Apply parsed query' }));

    await waitFor(() => expect(screen.getAllByRole('combobox')[0]).toHaveValue('Boston Celtics'));
    expect(nextOpponentCalls().map(([, options]) => options.params.player_name)).toEqual([
      'Stephen Curry',
      'LeBron James',
    ]);
  });

  test('the Workspace stays behind its loading state until the default opponent is chosen', async () => {
    let answer;
    mockRealFilterOptions = true;
    mockReads({ teamStats: {} });
    const reads = apiClient.get.getMockImplementation();
    apiClient.get.mockImplementation((url, options) =>
      url === '/api/next_opponent'
        ? new Promise((resolve) => {
            answer = () => resolve({ data: nextGameAgainst('CHA') });
          })
        : reads(url, options),
    );
    renderGameLogFilter(['/?player_name=Stephen+Curry']);

    // The logs and every other read have answered; the default opponent waits
    // on the next-opponent read alone.
    await waitFor(() => expect(fetchGameLogsData).toHaveBeenCalled());
    await act(async () => {});
    expect(screen.getByText('Loading game logs…')).toBeVisible();
    expect(screen.getAllByRole('combobox')[0]).toHaveValue('');
    expect(apiClient.get).not.toHaveBeenCalledWith('/api/team_stats', expect.anything());
    await act(async () => answer());
    await waitFor(() =>
      expect(screen.getAllByRole('combobox')[0]).toHaveValue('Charlotte Hornets'),
    );
    await waitFor(() => expect(screen.queryByText('Loading game logs…')).not.toBeInTheDocument());
  });

  test.each([
    ['answers', nextGameAgainst('CHA')],
    ['has no next game', { next_game: null, opponent_ranks: [] }],
    ['fails', new Error('boom')],
  ])(
    'the Workspace reveals once the read %s and everything else has settled',
    async (_label, nextOpponent) => {
      mockRealFilterOptions = true;
      mockReads({ nextOpponent, teamStats: {} });
      renderGameLogFilter(['/?player_name=Stephen+Curry']);

      await waitFor(() => expect(screen.queryByText('Loading game logs…')).not.toBeInTheDocument());
      expect(screen.getAllByRole('combobox')[0]).not.toHaveValue('');
    },
  );

  test('the Workspace stays hidden when the logs answer last and the opponent stats are still pending', async () => {
    let answerLogs;
    let answerStats;
    mockRealFilterOptions = true;
    mockReads();
    const reads = apiClient.get.getMockImplementation();
    apiClient.get.mockImplementation((url, options) =>
      url === '/api/team_stats'
        ? new Promise((resolve) => {
            answerStats = () => resolve({ data: {} });
          })
        : reads(url, options),
    );
    // Only the load at the URL's own filter is held back; the Workspace's
    // first request is not what this test is about.
    fetchGameLogsData.mockImplementation((params) =>
      params.game_filter
        ? new Promise((resolve) => {
            answerLogs = () => resolve({ gameLogs: [], averages: [], nextGame: null });
          })
        : Promise.resolve({ gameLogs: [], averages: [], nextGame: null }),
    );
    renderGameLogFilter(['/?player_name=Stephen+Curry&game_filter=10']);

    // The next-opponent read has answered first and the logs finish last.
    await act(async () => {});
    expect(screen.getByText('Loading game logs…')).toBeVisible();
    await act(async () => answerLogs());
    expect(screen.getAllByRole('combobox')[0]).toHaveValue('Boston Celtics');
    expect(screen.getByText('Loading game logs…')).toBeVisible();
    await act(async () => answerStats());
    await waitFor(() => expect(screen.queryByText('Loading game logs…')).not.toBeInTheDocument());
  });

  test('a team picked after the first game-log read failed survives the retry', async () => {
    mockRealFilterOptions = true;
    mockFilterPatch = { game_filter: 10 };
    mockReads({ teamStats: {} });
    fetchGameLogsData.mockRejectedValue(new Error('initial failure'));
    renderGameLogFilter(['/?player_name=Stephen+Curry&game_filter=10']);
    await screen.findByText('request failed');
    await waitFor(() => expect(screen.queryByText('Loading game logs…')).not.toBeInTheDocument());

    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'Denver Nuggets' } });
    fetchGameLogsData.mockResolvedValue({ gameLogs: [], averages: [], nextGame: null });
    await act(async () =>
      fireEvent.click(screen.getByRole('button', { name: 'Apply', exact: true })),
    );
    expect(screen.getAllByRole('combobox')[0]).toHaveValue('Denver Nuggets');
  });
});

test('a rate_limited game-logs read shows the backend message, once', async () => {
  const { getRequestErrorMessage } = require('./gameLogsApi');
  getRequestErrorMessage.mockImplementationOnce(
    jest.requireActual('./gameLogsApi').getRequestErrorMessage,
  );
  jest.useFakeTimers({ advanceTimers: true });
  mockFilterPatch = { game_filter: 10 };
  fetchGameLogsData.mockRejectedValue(
    Object.assign(new Error('Request failed with status code 429'), {
      response: {
        status: 429,
        headers: { 'retry-after': '3', 'x-request-id': '77070cec-3f5e-4b7a-9d0e-5a1c2b3d4e5f' },
        data: {
          error: {
            code: 'rate_limited',
            message: 'Too many requests. Try again in 3 seconds.',
          },
        },
      },
    }),
  );
  renderGameLogFilter(['/?player_name=Stephen+Curry&game_filter=10']);
  await screen.findByText('Too many requests. Try again in 3 seconds.');
  await act(async () => {
    jest.advanceTimersByTime(10000);
  });
  expect(fetchGameLogsData).toHaveBeenCalledTimes(1);
});

test('hides the sample size while the next request is in flight', async () => {
  const logs = (count) => Array.from({ length: count }, (_, index) => ({ GAME_ID: `${index}` }));
  const averages = [
    { MIN: 30, PTS: 20 },
    { MIN: 34, PTS: 25 },
  ];
  fetchGameLogsData.mockResolvedValueOnce({
    gameLogs: logs(3),
    averages,
    seasonGameCount: 60,
    nextGame: null,
  });
  renderGameLogFilter(['/?player_name=Nikola+Jokic']);
  expect(await screen.findByText('3 of 60 games')).toBeVisible();

  let resolveNext;
  fetchGameLogsData.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolveNext = resolve;
      }),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Apply test filters' }));
  await waitFor(() => expect(fetchGameLogsData).toHaveBeenCalledTimes(2));
  expect(screen.queryByText(/of 60 games/)).not.toBeInTheDocument();

  await act(async () =>
    resolveNext({ gameLogs: logs(5), averages, seasonGameCount: 60, nextGame: null }),
  );
  expect(screen.getByText('5 of 60 games')).toBeVisible();
});

test('shows the headshot for the player each response names, and not a stale one', async () => {
  const averages = [
    { MIN: 30, PTS: 20 },
    { MIN: 34, PTS: 25 },
  ];
  const response = (playerId) => ({
    gameLogs: [],
    averages,
    seasonGameCount: 60,
    nextGame: null,
    playerId,
  });
  fetchGameLogsData.mockResolvedValueOnce(response(203999));
  renderGameLogFilter(['/?player_name=Nikola+Jokic']);
  expect(await screen.findByRole('img', { name: 'Nikola Jokic' })).toHaveAttribute(
    'src',
    'https://cdn.nba.com/headshots/nba/latest/260x190/203999.png',
  );

  const pending = [];
  fetchGameLogsData.mockImplementation(
    () =>
      new Promise((resolve) => {
        pending.push(resolve);
      }),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Apply test filters' }));
  await waitFor(() => expect(pending).toHaveLength(1));
  fireEvent.click(screen.getByRole('button', { name: 'Apply test filters' }));
  await waitFor(() => expect(pending).toHaveLength(2));

  // The newer response carries no id; the superseded one arriving late must not
  // put an id back.
  await act(async () => pending[1](response(null)));
  await act(async () => pending[0](response(203999)));

  expect(screen.queryByRole('img', { name: 'Nikola Jokic' })).not.toBeInTheDocument();
  expect(screen.getByText('NJ')).toBeVisible();
});

test('the next request drops the posted line of the one before until it answers', async () => {
  const averages = [
    { MIN: 30, PTS: 20 },
    { MIN: 34, PTS: 25 },
  ];
  fetchGameLogsData.mockResolvedValueOnce({
    gameLogs: [],
    averages,
    seasonGameCount: 60,
    nextGame: null,
    postedLine: {
      gameDate: '2026-10-21',
      matchup: 'DEN vs GSW',
      markets: {
        PTS: {
          default: { kind: 'provider', key: 'prizepicks', line: 27.5, over: null, under: null },
          sources: [],
        },
      },
    },
  });
  renderGameLogFilter(['/?player_name=Nikola+Jokic']);
  await waitFor(() =>
    expect(screen.getByTestId('chart-posted-line')).toHaveTextContent('prizepicks'),
  );

  fetchGameLogsData.mockRejectedValueOnce(new Error('down'));
  fireEvent.click(screen.getByRole('button', { name: 'Apply test filters' }));
  expect(await screen.findByRole('alert')).toBeVisible();
  expect(screen.getByTestId('chart-posted-line')).toHaveTextContent('none');
});
