import { render, screen, waitFor } from '@testing-library/react';
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
      TARGETS: '/api/user/targets',
    })[name],
}));
jest.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ currentUser: null, isAuthenticated: false, loading: false }),
}));

// The home page as the home route draws it, signed out unless given an account.
const Home = ({ account = null }) => {
  const tonight = useHomeTonight(true, account);
  return (
    <MemoryRouter>
      {tonight.games && <HomeTicker slateDate={tonight.slateDate} games={tonight.games} />}
      {tonight.games && (
        <HomeTonight
          games={tonight.games}
          spotlight={tonight.spotlight}
          targets={tonight.targets}
          slateDate={tonight.slateDate}
          trailing={tonight.trailing}
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
// Today's season still scores team defense from 2025-26; the default has nothing trailing.
const SLATES = {
  '2025-26': SLATE,
  '2026-27': {
    ...SLATE,
    trailing: [{ family: 'team_defense', serving_season: '2025-26', rule: 'ready' }],
  },
};
const TRAILING_NOTE = 'Scores use 2025-26 team defense until ready.';

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

// A Target on ORL that fires for Daniels; its card shows his Slate Edges score.
const RESOLVED = {
  success: true,
  slate_date: '2026-10-29',
  targets: [
    {
      target: {
        id: 7,
        opponent: 'ORL',
        title: 'ORL vs Corner 3 ≥ 40%',
        note: null,
        created_at: '2026-10-20T15:12:00Z',
        qualifiers: [
          { base: 'shot_zones', slice_key: 'Corner 3', comparator: 'at_or_above', threshold: 0.4 },
        ],
      },
      game: {
        game_id: '0022600101',
        scheduled_at: '2026-10-29T23:00:00Z',
        status: { state: 'scheduled', label: 'Scheduled' },
        away: { team_id: 1610612737, tricode: 'ATL', name: 'ATL' },
        home: { team_id: 1610612753, tricode: 'ORL', name: 'ORL' },
        opponent: { team_id: 1610612753, tricode: 'ORL', name: 'ORL' },
        opposing_team: { team_id: 1610612737, tricode: 'ATL', name: 'ATL' },
      },
      context: [
        {
          base: 'shot_zones',
          slice_key: 'Corner 3',
          label: 'Corner 3',
          availability: {
            season: { status: 'available', unavailable_reason: null },
            last_15: { status: 'available', unavailable_reason: null },
          },
          metrics: [],
        },
      ],
      availability: {
        status: 'available',
        source: 'player_pool',
        context: 'current',
        unavailable_reason: null,
      },
      players: [
        {
          canonical_id: 1630700,
          name: 'Dyson Daniels',
          tricode: 'ATL',
          season_scoring: 14.1,
          thin: false,
          shares: [{ share: 0.44, league_average_share: 0.2 }],
        },
      ],
    },
  ],
};

// The backend: the season named on a read, or the Published one with none.
const serve = ({
  slateFor = (season) => SLATES[season],
  edgesFor = (season) => EDGES[season],
} = {}) =>
  apiClient.get.mockImplementation(async (url, { params = {} } = {}) => {
    const season = params.season ?? '2025-26';
    if (url === '/api/games/slate') return { data: slateFor(season) };
    if (url === '/api/user/targets/resolve') return { data: RESOLVED };
    return { data: edgesFor(season) };
  });

const seasonsAsked = (path) =>
  apiClient.get.mock.calls
    .filter(([url]) => url === path)
    .map(([, { params }]) => params.season ?? 'default');

const refuse2026 = (refuse, answer) => (season) => {
  if (season === '2026-27') throw refuse();
  return answer(season);
};

const targetScore = async () =>
  (await screen.findByRole('link', { name: /vs ORL/ })).querySelector('.home-target-score');

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
  expect(screen.getByRole('note')).toHaveTextContent(TRAILING_NOTE);
  expect(seasonsAsked('/api/games/slate/edges')).toEqual(['2026-27']);
  expect(seasonsAsked('/api/games/slate')).toEqual(['2026-27']);
});

test.each([
  ['unavailable', refusal(503, 'season_unavailable')],
  ['after the game', refusal(400, 'season_after_game')],
])('Edges refusing the season (%s) reads both again on the default', async (_name, refuse) => {
  serve({ edgesFor: refuse2026(refuse, (season) => EDGES[season]) });
  render(<Home />);

  expect((await danielsCell()).getAttribute('aria-label')).toMatch(/Daniels −4%$/);
  expect(screen.getByRole('article', { name: 'Toughest: Dyson Daniels' })).toHaveTextContent(
    '−4.0%',
  );
  expect(screen.queryByRole('note')).not.toBeInTheDocument();
  expect(seasonsAsked('/api/games/slate/edges')).toEqual(['2026-27', 'default']);
  expect(seasonsAsked('/api/games/slate')).toEqual(['2026-27', 'default']);
});

test('a Slate refusing the season reads both again on the default', async () => {
  serve({ slateFor: refuse2026(refusal(503, 'season_unavailable'), (season) => SLATES[season]) });
  render(<Home />);

  expect((await danielsCell()).getAttribute('aria-label')).toMatch(/Daniels −4%$/);
  expect(screen.getByRole('article', { name: 'Toughest: Dyson Daniels' })).toHaveTextContent(
    '−4.0%',
  );
  expect(screen.queryByRole('note')).not.toBeInTheDocument();
  expect(seasonsAsked('/api/games/slate')).toEqual(['2026-27', 'default']);
  expect(seasonsAsked('/api/games/slate/edges')).toEqual(['2026-27', 'default']);
});

test("a signed-in reader's Target card shows today's season's score, and Targets name no season", async () => {
  serve();
  render(<Home account="reader-a" />);

  expect(await targetScore()).toHaveTextContent('−6%');
  expect(seasonsAsked('/api/user/targets/resolve')).toEqual(['default']);
});

test('an Edges read that fails for another reason is not read again and shows no ticker or Tonight', async () => {
  serve({
    edgesFor: () => {
      throw Object.assign(new Error('Request failed with status code 500'), {
        response: { status: 500, data: {} },
      });
    },
  });
  render(<Home />);

  await waitFor(() => expect(console.warn).toHaveBeenCalled());
  expect(screen.queryByRole('navigation', { name: "Today's games" })).not.toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'Tonight' })).not.toBeInTheDocument();
  expect(seasonsAsked('/api/games/slate/edges')).toEqual(['2026-27']);
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
