import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useHomeTonight } from './useHomeTonight';
import HomeTicker from './HomeTicker';
import HomeTonight from './HomeTonight';
import { apiClient } from '../config';

jest.mock('../config', () => ({
  apiClient: { get: jest.fn() },
  getApiUrl: (name) =>
    ({
      SLATE: '/api/games/slate',
      SLATE_EDGES: '/api/games/slate/edges',
    })[name],
}));
jest.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ currentUser: null, isAuthenticated: false, loading: false }),
}));

// A signed-out visitor's home page, as the home route draws it.
const Home = () => {
  const tonight = useHomeTonight(true, null);
  return (
    <MemoryRouter>
      {tonight.games && <HomeTicker slateDate={tonight.slateDate} games={tonight.games} />}
      {tonight.games && (
        <HomeTonight
          games={tonight.games}
          spotlight={tonight.spotlight}
          targets={tonight.targets}
          slateDate={tonight.slateDate}
          onUseQuery={() => {}}
        />
      )}
    </MemoryRouter>
  );
};

const team = (team_id, tricode) => ({
  team_id,
  tricode,
  name: tricode,
  targetable_player_count: 5,
});
const SLATE = {
  slate_date: '2026-10-29',
  fallback: null,
  freshness: {
    schedule: { retrieved_at: '2026-10-29T10:00:00Z', status: 'fresh' },
    pool: { status: 'fresh', retrieved_at: '2026-10-29T10:00:00Z' },
  },
  games: [
    {
      game_id: '0022600101',
      away_team: team(1610612737, 'ATL'),
      home_team: team(1610612753, 'ORL'),
      scheduled_at: '2026-10-29T23:00:00Z',
      status: { state: 'scheduled' },
      preseason: false,
    },
  ],
};
// Dyson Daniels' PTS Matchup in each season, as production read it on 2026-10-29.
const edges = (value) => {
  const daniels = {
    game_id: '0022600101',
    canonical_id: 1630700,
    name: 'Dyson Daniels',
    tricode: 'ATL',
    opponent: 'ORL',
    season_scoring: 14.1,
    value,
    reason: null,
  };
  return {
    slate_date: '2026-10-29',
    games: [
      {
        game_id: '0022600101',
        effects: [{ ...daniels, thin: false }],
        scores: [{ canonical_id: 1630700, value }],
      },
    ],
    spotlight: { best: null, toughest: daniels },
  };
};
const EDGES = { '2025-26': edges(-0.04), '2026-27': edges(-0.06) };

const refusal = (status, code) => () =>
  Object.assign(new Error(`Request failed with status code ${status}`), {
    response: { status, data: { error: { code, message: 'Season 2026-27 is refused.' } } },
  });

// The backend: the season named on a read, or the Published one with none.
const serve = ({ edgesFor = (season) => EDGES[season] } = {}) =>
  apiClient.get.mockImplementation(async (url, { params = {} } = {}) => {
    if (url === '/api/games/slate') return { data: SLATE };
    return { data: edgesFor(params.season ?? '2025-26') };
  });

const seasonsAsked = (path) =>
  apiClient.get.mock.calls
    .filter(([url]) => url === path)
    .map(([, { params }]) => params.season ?? 'default');

const danielsCell = () => screen.findByRole('link', { name: /ATL at ORL Matchup/ });

beforeEach(() => {
  jest.useFakeTimers({ now: new Date('2026-10-29T16:00:00Z'), advanceTimers: true });
  window.localStorage.clear();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

test("a signed-out visitor sees today's season's Matchup Scores", async () => {
  serve();
  render(<Home />);

  expect((await danielsCell()).getAttribute('aria-label')).toMatch(/Daniels −6%$/);
  expect(screen.getByRole('article', { name: 'Toughest: Dyson Daniels' })).toHaveTextContent(
    '−6.0%',
  );
  expect(seasonsAsked('/api/games/slate/edges')).toEqual(['2026-27']);
  expect(seasonsAsked('/api/games/slate')).toEqual(['2026-27']);
});

test.each([
  ['unavailable', refusal(503, 'season_unavailable')],
  ['after the game', refusal(400, 'season_after_game')],
])('a season the backend refuses (%s) is read again on the default', async (_name, refuse) => {
  serve({
    edgesFor: (season) => {
      if (season === '2026-27') throw refuse();
      return EDGES[season];
    },
  });
  render(<Home />);

  expect((await danielsCell()).getAttribute('aria-label')).toMatch(/Daniels −4%$/);
  expect(screen.getByRole('article', { name: 'Toughest: Dyson Daniels' })).toHaveTextContent(
    '−4.0%',
  );
  expect(seasonsAsked('/api/games/slate/edges')).toEqual(['2026-27', 'default']);
  expect(seasonsAsked('/api/games/slate')).toEqual(['2026-27']);
});

test("a paint stored before home read today's season is not shown", () => {
  apiClient.get.mockReturnValue(new Promise(() => {}));
  window.localStorage.setItem(
    'courtai.homeTonight.v2',
    JSON.stringify({
      games: [
        {
          gameId: '0022600101',
          scheduledAt: '2026-10-29T23:00:00Z',
          away: { tricode: 'ATL' },
          home: { tricode: 'ORL' },
          effects: [{ canonicalId: 1630700, name: 'Dyson Daniels', value: -0.04 }],
          scores: [[1630700, -0.04]],
        },
      ],
      spotlight: { best: null, toughest: null },
      slateDate: '2026-10-29',
      fallback: null,
    }),
  );
  render(<Home />);

  expect(screen.queryByRole('navigation', { name: "Today's games" })).not.toBeInTheDocument();
});
