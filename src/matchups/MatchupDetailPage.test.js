import { execFileSync } from 'node:child_process';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter as Router, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { createTarget, fetchDietBaselines, fetchTargetPreview } from '../targets/targetsApi';
import { fetchMatchup, fetchMatchupSelection } from './matchupApi';
import { payload as rawMatchupPayload } from './matchupPayloadFixture';
import { bookName, categoryLabel } from './displayConfig';
import MatchupDetailPage from './MatchupDetailPage';
import { fetchSeasons } from '../seasonsApi';
import { legacySeasons, publishedOnlySeasons, unpublishedSeasons } from '../seasonChoicesFixture';
import { seasonRefusalOr } from '../servingSeason';

// The Matchup settings ride the URL, and a router renders each navigation in a
// transition. user-event 13 fires its clicks outside act, so a transition
// would land after the assertions that follow a click.
const MemoryRouter = (props) => <Router useTransitions={false} {...props} />;

jest.mock('../contexts/AuthContext');
jest.mock('./matchupApi');
jest.mock('../seasonsApi', () => ({ fetchSeasons: jest.fn() }));
jest.mock('../targets/targetsApi', () => ({
  createTarget: jest.fn(),
  fetchDietBaselines: jest.fn(),
  fetchTargetPreview: jest.fn(),
}));

const value = (allowedPer48, percentVsLeagueAverage, sigmaDeviation, rank) => ({
  allowedPer48,
  percentVsLeagueAverage,
  sigmaDeviation,
  rank,
});
const defensiveColumns = {
  OPP_TOV: {
    season: { per48: 14.2, percentVsLeagueAverage: 8 },
    last15: { per48: 12.9, percentVsLeagueAverage: -3 },
  },
  OPP_STL: {
    season: { per48: 7.1, percentVsLeagueAverage: -5 },
    last15: { per48: 7.8, percentVsLeagueAverage: 4 },
  },
  OPP_BLK: {
    season: { per48: 5.4, percentVsLeagueAverage: 11 },
    last15: { per48: 4.7, percentVsLeagueAverage: -2 },
  },
};
const score = (season, last15 = season) => ({
  season: {
    components: { playTypes: { value: season, thin: false } },
    blend: { value: season, thin: false },
    missingInputs: [],
  },
  last15: {
    components: { playTypes: { value: last15, thin: false } },
    blend: { value: last15, thin: false },
    missingInputs: [],
  },
});

const matchup = {
  game: {
    gameId: 'game-1',
    away: { teamId: 1, tricode: 'LAL' },
    home: { teamId: 2, tricode: 'BOS' },
    scheduledAt: '2026-01-16T00:30:00.000Z',
    status: 'scheduled',
    statusLabel: 'Scheduled',
    preseason: false,
  },
  experience: { mode: 'current', playerSource: 'player_pool', sections: null },
  league: {
    surfaceAvailability: Object.fromEntries(
      ['playTypes', 'shotZones', 'shotTypes', 'assistLocations', 'traditional'].map((base) => [
        base,
        {
          season: { status: 'available', unavailableReason: null },
          last15: { status: 'available', unavailableReason: null },
        },
      ]),
    ),
  },
  teams: [
    {
      teamId: 1,
      tricode: 'LAL',
      name: 'Los Angeles Lakers',
      defenseSheet: {
        playTypes: [],
        // Either team's sheet can be read, so either team's rows are
        // capturable; the opponent a Target names is whichever sheet is open.
        shotZones: [
          {
            key: 'Corner 3:FGA',
            sliceKey: 'Corner 3',
            label: 'Corner three',
            markets: ['REB'],
            season: value(9.4, 7, 1.1, 24),
            last15: value(9.1, 5, 0.9, 21),
          },
        ],
      },
      defensiveColumns,
    },
    {
      teamId: 2,
      tricode: 'BOS',
      name: 'Boston Celtics',
      defenseSheet: {
        playTypes: [
          {
            // A sheet row's key pairs the slice with a stat, so a Qualifier
            // written from `key` would name a slice the diet has never heard of.
            key: 'Transition:PTS',
            sliceKey: 'Transition',
            label: 'Transition PTS',
            markets: ['PTS', 'FGA'],
            season: value(18.4, 12.34, 1.4, 27),
            last15: value(15.2, -8.26, -1.1, 5),
          },
          {
            key: 'Isolation:PTS',
            sliceKey: 'Isolation',
            label: 'Isolation PTS',
            markets: ['PTS'],
            season: value(8.1, 2, 0.4, 16),
            last15: value(8.4, 4, 0.5, 18),
          },
        ],
        shotZones: [
          {
            key: 'Above the Break 3:FGA',
            sliceKey: 'Above the Break 3',
            label: 'Above the Break 3 FGA',
            markets: ['FGA', 'FG3A'],
            season: value(10.2, -11, -1.3, 3),
            last15: value(11, -6, -0.7, 9),
          },
        ],
        // Traditional is a team-only base with no diet counterpart, so its rows
        // are the ones a Qualifier can never be written from.
        traditional: [
          {
            key: 'OPP_TOV',
            sliceKey: 'OPP_TOV',
            label: 'OPP TOV',
            markets: ['TOV'],
            season: value(14.2, 8, 1.2, 26),
            last15: value(12.9, -3, -1.1, 6),
          },
        ],
      },
      defensiveColumns,
    },
  ],
  players: [
    {
      id: 1630559,
      name: 'Austin Reaves',
      teamId: 1,
      tricode: 'LAL',
      postedMarkets: ['PTS', 'FG3A'],
      statCategories: ['PTS', 'FG3A'],
      playerSource: 'player_pool',
      focalGameLine: null,
      provenance: { prizepicks: ['PTS', 'FG3A'], underdog: ['PTS'] },
      // PrizePicks posts his points without a number; Underdog's is the line.
      lines: { underdog: { PTS: 21.5 } },
      seasonScoring: 20.1,
      last10Minutes: [32, 35, 34],
      injuryBadgeRef: 'injury-1',
      dietShares: {
        playTypes: [
          {
            key: 'Transition',
            season: {
              share: 0.18,
              volumePerGame: 4,
              sigmaDeviation: 1.2,
              leagueAverageShare: 0.094,
            },
          },
        ],
      },
      scores: { PTS: score(0.21, 0.03), FG3A: score(0.07, 0.02) },
    },
    {
      id: 2544,
      name: 'LeBron James',
      teamId: 1,
      tricode: 'LAL',
      postedMarkets: ['PTS', 'FGA'],
      statCategories: ['PTS', 'FGA'],
      playerSource: 'player_pool',
      focalGameLine: null,
      provenance: { prizepicks: ['PTS', 'FGA'], underdog: ['PTS'] },
      // The books disagree on his points; no book has posted his FGA number.
      lines: { prizepicks: { PTS: 27.5 }, underdog: { PTS: 26.5 } },
      seasonScoring: 25.4,
      last10Minutes: [35, 36, 38],
      injuryBadgeRef: null,
      dietShares: {
        playTypes: [
          {
            key: 'Transition',
            season: { share: 0.19, volumePerGame: 5, sigmaDeviation: 1.3 },
          },
        ],
      },
      scores: { PTS: score(0.12, -0.01), FGA: score(0.04, 0.02) },
    },
    {
      id: 1628369,
      name: 'Jayson Tatum',
      teamId: 2,
      tricode: 'BOS',
      postedMarkets: ['REB'],
      statCategories: ['REB'],
      playerSource: 'player_pool',
      focalGameLine: null,
      provenance: { prizepicks: ['REB'] },
      lines: {},
      seasonScoring: 27.2,
      last10Minutes: [36, 37, 38],
      injuryBadgeRef: null,
      dietShares: {
        playTypes: [],
        // Under the display gate, so no chip renders. The league average is
        // published on the fact either way, and capture reads it either way.
        shotZones: [
          {
            key: 'Corner 3',
            season: {
              share: 0.14,
              volumePerGame: 3.4,
              sigmaDeviation: 0.4,
              leagueAverageShare: 0.128,
            },
          },
        ],
      },
      scores: { REB: score(0.08) },
    },
  ],
  injuries: {
    status: 'fresh',
    unavailableReason: null,
    retrievedAt: '2026-01-15T11:55:00Z',
    source: 'rotowire',
    sourceUrl: 'https://example.com/injuries',
    teams: [
      {
        tricode: 'LAL',
        entries: [
          {
            id: 'injury-1',
            playerName: 'Austin Reaves',
            status: null,
            rawStatus: 'Game-time decision',
            reason: 'Left calf soreness',
            sourceUrl: 'https://example.com/austin',
          },
        ],
      },
    ],
  },
  freshness: {
    schedule: { status: 'fresh', retrievedAt: '2026-01-15T10:00:00Z' },
    pool: { status: 'fresh', retrievedAt: '2026-01-15T11:50:00Z', providers: [] },
    stats: { status: 'fresh', retrievedAt: '2026-01-15T10:00:00Z' },
    injuries: { status: 'fresh', retrievedAt: '2026-01-15T11:55:00Z' },
  },
};

// `fetchMatchup` resolves the decoded Matchup with the response it decoded,
// which the player sheet's matchup card reads. A hand-built Matchup has no
// response, so its scores are restated in the response's shape.
const snakeKey = (key) => key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
const responseWindow = (window) => ({
  components: Object.fromEntries(
    Object.entries(window.components).map(([base, cell]) => [snakeKey(base), cell]),
  ),
  blend: window.blend,
  missing_inputs: window.missingInputs ?? [],
});
const fetched = (decoded) => ({
  ...decoded,
  response: decoded.response ?? {
    players: decoded.players.map((player) => ({
      canonical_id: player.id,
      name: player.name,
      scores: Object.fromEntries(
        Object.entries(player.scores).map(([market, windows]) => [
          market,
          { season: responseWindow(windows.season), last_15: responseWindow(windows.last15) },
        ]),
      ),
      season_averages: player.seasonAverages ?? {},
    })),
    teams: decoded.teams.map((team) => ({ tricode: team.tricode })),
  },
});
const decodeFetched = (raw) => ({
  ...jest.requireActual('./matchupApi').decodeMatchup(raw),
  response: raw,
});

beforeEach(() => {
  jest.clearAllMocks();
  useAuth.mockReturnValue({ isAuthenticated: true, loading: false });
  fetchSeasons.mockResolvedValue(legacySeasons);
  fetchMatchup.mockResolvedValue(fetched(matchup));
  fetchTargetPreview.mockResolvedValue(capturePreview);
  fetchDietBaselines.mockResolvedValue({ shares: {} });
  fetchMatchupSelection.mockResolvedValue({
    playerId: 2544,
    h2h: {
      thin: true,
      rows: [
        {
          date: '2025-12-25',
          matchup: 'LAL vs. BOS',
          minutes: 36,
          stats: { PTS: 31, FGA: 19 },
          deltas: { PTS: 0.083, FGA: 0.018 },
          average: false,
        },
        {
          date: null,
          matchup: 'AVG',
          minutes: 36,
          stats: { PTS: 31, FGA: 19 },
          deltas: { PTS: 0.083, FGA: 0.018 },
          average: true,
        },
      ],
    },
    archetype: { thin: false, rows: [] },
  });
});

test('links every displayed player name to that player’s game logs', async () => {
  render(
    <MemoryRouter initialEntries={['/matchups/game-1']}>
      <Routes>
        <Route path="/matchups/:gameId" element={<MatchupDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );

  const lebronCard = await screen.findByRole('article', { name: 'LeBron James player' });
  const reavesCard = screen.getByRole('article', { name: 'Austin Reaves player' });
  const lebronLink = within(lebronCard).getByRole('link', { name: 'LeBron James game logs' });
  const reavesLink = within(reavesCard).getByRole('link', { name: 'Austin Reaves game logs' });
  expect(lebronLink).toHaveAttribute('href', '/?player_name=LeBron+James&season_filter=2025-26');
  expect(reavesLink).toHaveAttribute('href', '/?player_name=Austin+Reaves&season_filter=2025-26');
  // The name is the link: no second "Game logs" label on the card.
  expect(lebronLink).toHaveTextContent('LeBron James');
  expect(within(lebronCard).getByRole('heading', { level: 3 })).toContainElement(lebronLink);
  expect(within(lebronCard).queryByText('Game logs')).not.toBeInTheDocument();
});

test('shows the matchup-detail preseason caveat only for preseason games', async () => {
  const regular = render(
    <MemoryRouter initialEntries={['/matchups/game-1']}>
      <Routes>
        <Route path="/matchups/:gameId" element={<MatchupDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
  await screen.findByRole('heading', { name: 'What BOS allows' });
  expect(screen.queryByRole('note', { name: 'Preseason matchup caveat' })).not.toBeInTheDocument();
  regular.unmount();

  fetchMatchup.mockResolvedValueOnce(
    fetched({
      ...matchup,
      game: { ...matchup.game, preseason: true },
    }),
  );
  render(
    <MemoryRouter initialEntries={['/matchups/game-1']}>
      <Routes>
        <Route path="/matchups/:gameId" element={<MatchupDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );

  expect(await screen.findByRole('note', { name: 'Preseason matchup caveat' })).toHaveTextContent(
    'Preseason matchup — current-season samples may be limited.',
  );
});

test('toggles delivered windows and applies a two-sided sigma filter without refetching', async () => {
  renderMatchup();

  expect(await screen.findByRole('heading', { name: 'What BOS allows' })).toBeVisible();
  // The page opens on PTS, which hides the attempts-only Above-the-break slice.
  await userEvent.click(screen.getByRole('button', { name: 'All' }));
  expect(sheetRowNames()).toEqual(['Transition', 'Above-the-break 3s', 'Turnovers forced']);
  expect(sheetRow('Transition')).toHaveTextContent('+12%');

  await userEvent.click(screen.getByRole('button', { name: 'Last 15' }));
  expect(sheetRow('Transition')).toHaveTextContent('−8%');
  expect(fetchMatchup).toHaveBeenCalledTimes(1);

  await userEvent.click(screen.getByRole('button', { name: 'Season' }));
  await userEvent.click(screen.getByRole('button', { name: 'All deviations' }));
  expect(sheetRowNames()).toEqual([
    'Transition',
    'Isolation',
    'Above-the-break 3s',
    'Turnovers forced',
  ]);
  expect(sheetRow('Isolation')).toHaveTextContent('+2%');
  // Two-sided: −1.3σ clears the 1σ floor as readily as +1.4σ does.
  await userEvent.click(screen.getByRole('button', { name: 'At least 1 sigma' }));
  expect(sheetRowNames()).toContain('Above-the-break 3s');
  await userEvent.click(screen.getByRole('button', { name: 'At least 2 sigma' }));
  expect(sheetRowNames()).toEqual([]);
  expect(screen.getByText('No Defense Sheet rows match these controls.')).toBeVisible();
  expect(fetchMatchup).toHaveBeenCalledTimes(1);
});

test('lists who leans on a slice above league, most first, and leaves off those below', async () => {
  const candidate = JSON.parse(JSON.stringify(matchup));
  candidate.players.forEach((player, index) => {
    player.teamId = 1;
    player.statCategories = ['PTS'];
    player.dietShares.playTypes = [
      {
        key: 'Transition',
        season: {
          share: [0.31, 0.05, 0.37][index],
          volumePerGame: 1,
          leagueAverageShare: 0.25,
          sigmaDeviation: [0.6, -2, 1.2][index],
        },
      },
    ];
  });
  fetchMatchup.mockResolvedValueOnce(fetched(candidate));
  renderMatchup();

  const leans = await screen.findByRole('list', { name: 'Players leaning on Transition' });
  expect(
    within(leans)
      .getAllByRole('listitem')
      .map((item) => item.textContent),
  ).toEqual(['Jayson Tatum 37%', 'Austin Reaves 31%']);
  // LeBron leans on it 2σ less than league: a soft spot is not his.
  expect(within(leans).queryByText('LeBron James')).not.toBeInTheDocument();
});

test('lists who leans on a slice in a market they are scored in with no line (statsplus#457)', async () => {
  const candidate = JSON.parse(JSON.stringify(matchup));
  candidate.players.forEach((player, index) => {
    player.teamId = 1;
    player.statCategories = ['REB'];
    player.scores.PTS = matchup.players[0].scores.PTS;
    player.dietShares.playTypes = [
      {
        key: 'Transition',
        season: {
          share: [0.31, 0.05, 0.37][index],
          volumePerGame: 1,
          leagueAverageShare: 0.25,
          sigmaDeviation: [0.6, -2, 1.2][index],
        },
      },
    ];
  });
  fetchMatchup.mockResolvedValueOnce(fetched(candidate));
  renderMatchup();

  const leans = await screen.findByRole('list', { name: 'Players leaning on Transition' });
  expect(
    within(leans)
      .getAllByRole('listitem')
      .map((item) => item.textContent),
  ).toEqual(['Jayson Tatum 37%', 'Austin Reaves 31%']);
});

test('a selection highlights only the slices his delivered Season Diet Share leans on', async () => {
  const candidate = JSON.parse(JSON.stringify(matchup));
  candidate.players.find((player) => player.id === 2544).dietShares.playTypes[0].season = {
    share: 0.02,
    volumePerGame: 5,
  };
  fetchMatchup.mockResolvedValueOnce(fetched(candidate));
  render(
    <MemoryRouter initialEntries={['/matchups/game-1?player=2544']}>
      <Routes>
        <Route path="/matchups/:gameId" element={<MatchupDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
  await screen.findByRole('heading', { name: 'LeBron James', level: 2 });
  expect(screen.getByText(/displayed Season Diet Share inputs/)).toBeVisible();
  expect(screen.queryByText(/Diet Share inputs for the current window/)).not.toBeInTheDocument();
  expect(
    within(screen.getByRole('group', { name: 'Market' })).getByRole('button', { name: 'PTS' }),
  ).toHaveAttribute('aria-pressed', 'true');
  expect(sheetRow('Transition')).not.toHaveClass('selection-why');
  await userEvent.click(screen.getByRole('button', { name: 'Last 15' }));
  expect(sheetRow('Transition')).not.toHaveClass('selection-why');
});

test('names an unavailable surface window while leaving available surfaces usable', async () => {
  const candidate = JSON.parse(JSON.stringify(matchup));
  candidate.league.surfaceAvailability.playTypes.last15 = {
    status: 'unavailable',
    unavailableReason: 'provider_unsupported',
  };
  candidate.teams.forEach((team) => {
    team.defenseSheet.playTypes.forEach((row) => {
      row.last15 = null;
    });
  });
  const lebron = candidate.players.find((player) => player.id === 2544);
  lebron.postedMarkets.push('AST');
  lebron.statCategories.push('AST');
  lebron.provenance.prizepicks.push('AST');
  lebron.scores.AST = score(0.05);
  candidate.teams.find((team) => team.tricode === 'BOS').defenseSheet.assistLocations = [
    {
      key: 'AtRimAssists',
      sliceKey: 'AtRimAssists',
      label: 'AtRimAssists',
      markets: ['AST'],
      season: value(11, 13, 1.5, 28),
      last15: value(10, 9, 1.1, 24),
    },
  ];
  fetchMatchup.mockResolvedValueOnce(fetched(candidate));
  renderMatchup();
  await screen.findByRole('heading', { name: 'What BOS allows' });
  await userEvent.click(screen.getByRole('button', { name: 'Last 15' }));
  expect(
    screen.getByText('Play types unavailable for Last 15: provider_unsupported.'),
  ).toBeVisible();

  await userEvent.click(screen.getByRole('button', { name: 'AST' }));
  expect(
    screen.queryByText('Play types unavailable for Last 15: provider_unsupported.'),
  ).not.toBeInTheDocument();
  expect(sheetRowNames()).toEqual(['At the rim']);
});

test('renders one relevant traditional unavailability notice for All and specific markets', async () => {
  const candidate = JSON.parse(JSON.stringify(matchup));
  candidate.league.surfaceAvailability.traditional.last15 = {
    status: 'unavailable',
    unavailableReason: 'not_stored',
  };
  candidate.teams.forEach((team) => {
    team.defenseSheet.traditional = [
      {
        key: 'OPP_REB',
        sliceKey: 'OPP_REB',
        label: 'OPP REB',
        markets: ['REB'],
        season: value(45, -8, -1.2, 4),
        last15: null,
      },
      {
        key: 'OPP_TOV',
        sliceKey: 'OPP_TOV',
        label: 'OPP TOV',
        markets: ['TOV'],
        season: value(14.8, 10, 1.3, 25),
        last15: null,
      },
    ];
    Object.values(team.defensiveColumns).forEach((column) => {
      column.last15 = null;
    });
  });
  const lebron = candidate.players.find((player) => player.id === 2544);
  lebron.postedMarkets.push('TOV', 'AST');
  lebron.statCategories.push('TOV', 'AST');
  lebron.provenance.prizepicks.push('TOV', 'AST');
  lebron.scores.TOV = {
    season: {
      components: { traditional: { value: 0.03, thin: false } },
      blend: null,
      missingInputs: [],
    },
    last15: {
      components: { traditional: { value: 0.02, thin: false } },
      blend: null,
      missingInputs: [],
    },
  };
  lebron.scores.AST = score(0.05);
  fetchMatchup.mockResolvedValueOnce(fetched(candidate));
  renderMatchup();
  await screen.findByRole('heading', { name: 'What BOS allows' });
  await userEvent.click(screen.getByRole('button', { name: 'All' }));
  await userEvent.click(screen.getByRole('button', { name: 'Last 15' }));
  expect(screen.getAllByText('Box score unavailable for Last 15: not_stored.')).toHaveLength(1);

  await userEvent.click(screen.getByRole('button', { name: 'TOV' }));
  expect(screen.getAllByText('Box score unavailable for Last 15: not_stored.')).toHaveLength(1);

  await userEvent.click(screen.getByRole('button', { name: 'AST' }));
  expect(
    screen.queryByText('Box score unavailable for Last 15: not_stored.'),
  ).not.toBeInTheDocument();
});

test('explains a withheld Last-15 window in a sentence instead of a raw reason', async () => {
  const candidate = JSON.parse(JSON.stringify(matchup));
  candidate.league.surfaceAvailability.traditional.last15 = {
    status: 'unavailable',
    unavailableReason: 'insufficient_governed_games',
  };
  fetchMatchup.mockResolvedValueOnce(fetched(candidate));
  render(
    <MemoryRouter initialEntries={['/matchups/game-1']}>
      <Routes>
        <Route path="/matchups/:gameId" element={<MatchupDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
  await screen.findByRole('heading', { name: 'What BOS allows' });
  await userEvent.click(screen.getByRole('button', { name: 'All' }));
  await userEvent.click(screen.getByRole('button', { name: 'Last 15' }));
  expect(
    screen.getByText(
      'Box score unavailable for Last 15: Last 15 has not opened yet; it opens once every team has played 15 games.',
    ),
  ).toBeVisible();
  expect(screen.queryByText(/insufficient_governed_games/)).not.toBeInTheDocument();
});

test('explains a Last-15 window still on the previous season in a sentence', async () => {
  const candidate = JSON.parse(JSON.stringify(matchup));
  candidate.league.surfaceAvailability.traditional.last15 = {
    status: 'unavailable',
    unavailableReason: 'window_not_ready',
  };
  fetchMatchup.mockResolvedValueOnce(fetched(candidate));
  render(
    <MemoryRouter initialEntries={['/matchups/game-1']}>
      <Routes>
        <Route path="/matchups/:gameId" element={<MatchupDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
  await screen.findByRole('heading', { name: 'What BOS allows' });
  await userEvent.click(screen.getByRole('button', { name: 'All' }));
  await userEvent.click(screen.getByRole('button', { name: 'Last 15' }));
  expect(
    screen.getByText(
      'Box score unavailable for Last 15: Last 15 has not opened yet; it opens once every team has played 15 games.',
    ),
  ).toBeVisible();
  expect(screen.queryByText(/window_not_ready/)).not.toBeInTheDocument();
});

test('names an unavailable OPP_REB window without hiding other traditional markets', async () => {
  const candidate = JSON.parse(JSON.stringify(matchup));
  candidate.teams.find((team) => team.tricode === 'BOS').defenseSheet.traditional = [
    {
      key: 'OPP_REB',
      sliceKey: 'OPP_REB',
      label: 'OPP REB',
      markets: ['REB'],
      season: value(45, -8, -1.2, 4),
      last15: null,
    },
    {
      key: 'OPP_TOV',
      sliceKey: 'OPP_TOV',
      label: 'OPP TOV',
      markets: ['TOV'],
      season: value(14.8, 10, 1.3, 25),
      last15: value(13.4, 5, 1.1, 22),
    },
  ];
  const lebron = candidate.players.find((player) => player.id === 2544);
  lebron.postedMarkets.push('REB', 'TOV');
  lebron.statCategories.push('REB', 'TOV');
  lebron.provenance.prizepicks.push('REB', 'TOV');
  fetchMatchup.mockResolvedValueOnce(fetched(candidate));
  renderMatchup();
  await screen.findByRole('heading', { name: 'What BOS allows' });
  await userEvent.click(screen.getByRole('button', { name: 'All' }));
  expect(sheetRow('Rebounds')).toHaveTextContent('−8%');
  await userEvent.click(screen.getByRole('button', { name: 'Last 15' }));

  expect(screen.getByText('Opponent rebounds unavailable for Last 15.')).toBeVisible();
  expect(sheetRowNames()).toContain('Turnovers forced');
  expect(sheetRowNames()).not.toContain('Rebounds');
  expect(screen.queryByText('No Defense Sheet rows match these controls.')).not.toBeInTheDocument();

  await userEvent.click(screen.getByRole('button', { name: 'REB' }));
  expect(screen.getAllByText('Opponent rebounds unavailable for Last 15.')).toHaveLength(1);
  expect(sheetRowNames()).toEqual([]);
  expect(screen.queryByText('No Defense Sheet rows match these controls.')).not.toBeInTheDocument();

  await userEvent.click(screen.getByRole('button', { name: 'TOV' }));
  expect(screen.queryByText('Opponent rebounds unavailable for Last 15.')).not.toBeInTheDocument();
  expect(sheetRowNames()).toEqual(['Turnovers forced']);
});

test('names every Traditional row a Last 15 window lacks', async () => {
  const candidate = JSON.parse(JSON.stringify(matchup));
  const row = (key, markets, last15) => ({
    key,
    sliceKey: key,
    label: key,
    markets,
    season: value(45, 12, 1.4, 25),
    last15,
  });
  candidate.teams.find((team) => team.tricode === 'BOS').defenseSheet.traditional = [
    row('OPP_PTS', ['PTS', 'PA', 'PR', 'PRA'], null),
    row('OPP_AST', ['AST', 'PA', 'RA', 'PRA'], null),
    row('OPP_FTM', ['FTM'], null),
    row('OPP_TOV', ['TOV'], value(13.4, 5, 1.1, 22)),
  ];
  const lebron = candidate.players.find((player) => player.id === 2544);
  lebron.postedMarkets.push('AST', 'FTM', 'TOV');
  lebron.statCategories.push('AST', 'FTM', 'TOV');
  lebron.provenance.prizepicks.push('AST', 'FTM', 'TOV');
  fetchMatchup.mockResolvedValueOnce(fetched(candidate));
  renderMatchup();
  await screen.findByRole('heading', { name: 'What BOS allows' });
  await userEvent.click(screen.getByRole('button', { name: 'All' }));
  expect(sheetRowNames()).toEqual(expect.arrayContaining(['Points', 'Assists', 'FT made']));
  await userEvent.click(screen.getByRole('button', { name: 'Last 15' }));

  expect(
    screen.getByText('Opponent points, assists, and FT made unavailable for Last 15.'),
  ).toBeVisible();
  expect(sheetRowNames()).toContain('Turnovers forced');
  expect(sheetRowNames()).not.toContain('Assists');

  await userEvent.click(screen.getByRole('button', { name: 'AST' }));
  expect(screen.getByText('Opponent assists unavailable for Last 15.')).toBeVisible();
  expect(sheetRowNames()).toEqual([]);
  expect(screen.queryByText('No Defense Sheet rows match these controls.')).not.toBeInTheDocument();

  await userEvent.click(screen.getByRole('button', { name: 'TOV' }));
  expect(screen.queryByText(/unavailable for Last 15\./)).not.toBeInTheDocument();
  expect(sheetRowNames()).toEqual(['Turnovers forced']);
});

test('renders governed traditional sheet rows without duplicate defensive columns', async () => {
  const candidate = JSON.parse(JSON.stringify(matchup));
  candidate.teams.find((team) => team.tricode === 'BOS').defenseSheet.traditional = [
    ['OPP_REB', ['REB', 'PR', 'RA', 'PRA'], 45, -1.2],
    ['OPP_TOV', ['TOV'], 15.8, 1.3],
    ['OPP_STL', ['STL', 'STKS'], 6.9, -1.1],
    ['OPP_BLK', ['BLK', 'STKS'], 5.8, 1.4],
  ].map(([key, markets, allowed, sigma], index) => ({
    key,
    sliceKey: key,
    label: key.replace('_', ' '),
    markets,
    season: value(allowed, 8 - index, sigma, 22),
    last15: value(allowed - 0.5, 4, sigma, 18),
  }));
  fetchMatchup.mockResolvedValueOnce(fetched(candidate));
  renderMatchup();
  await screen.findByRole('heading', { name: 'What BOS allows' });
  await userEvent.click(screen.getByRole('button', { name: 'All' }));

  const boxScore = screen.getByRole('region', { name: 'Box score' });
  expect(
    within(boxScore)
      .getAllByRole('article')
      .map((row) => row.getAttribute('aria-label')),
  ).toEqual(['Rebounds', 'Turnovers forced', 'Steals', 'Blocks']);
  expect(within(boxScore).queryByText(/OPP/)).not.toBeInTheDocument();
});

test('shows the Rebound Types section for REB and not for PTS', async () => {
  const candidate = JSON.parse(JSON.stringify(matchup));
  candidate.league.surfaceAvailability.reboundTypes = {
    season: { status: 'available', unavailableReason: null },
    last15: { status: 'available', unavailableReason: null },
  };
  candidate.teams.find((team) => team.tricode === 'BOS').defenseSheet.reboundTypes = [
    ['DefTwoPtRebounds', 22.1, 9, 1.4, 25],
    ['DefThreePtRebounds', 9.3, -12, -1.5, 4],
    ['FTDefRebounds', 1.2, 5, 1.1, 18],
    ['OffTwoPtRebounds', 7.4, 14, 1.6, 27],
    ['OffThreePtRebounds', 3.1, 6, 1.2, 19],
    ['FTOffRebounds', 0.8, -7, -1.3, 12],
  ].map(([key, allowed, percent, sigma, rank]) => ({
    key,
    sliceKey: key,
    label: key,
    markets: ['REB', 'PR', 'RA', 'PRA'],
    season: value(allowed, percent, sigma, rank),
    last15: value(allowed, percent, sigma, rank),
  }));
  const lebron = candidate.players.find((player) => player.id === 2544);
  lebron.postedMarkets.push('REB');
  lebron.statCategories.push('REB');
  lebron.provenance.prizepicks.push('REB');
  const reboundShare = (share, volumePerGame) => [
    {
      key: 'OffTwoPtRebounds',
      season: { share, volumePerGame, sigmaDeviation: 1.8, leagueAverageShare: 0.05 },
    },
  ];
  // LeBron clears both floors; Austin leans nearly as far but boards under one a game, so his lean is shown thin.
  const austin = candidate.players.find((player) => player.id === 1630559);
  austin.postedMarkets.push('REB');
  austin.statCategories.push('REB');
  austin.provenance.prizepicks.push('REB');
  austin.scores.REB = austin.scores.PTS;
  austin.dietShares.reboundTypes = reboundShare(0.3, 0.6);
  lebron.scores.REB = lebron.scores.PTS;
  lebron.dietShares.reboundTypes = reboundShare(0.38, 2.4);
  fetchMatchup.mockResolvedValueOnce(fetched(candidate));
  renderMatchup();
  await screen.findByRole('heading', { name: 'What BOS allows' });

  await userEvent.click(screen.getByRole('button', { name: 'REB' }));
  const section = screen.getByRole('region', { name: 'Rebound Types' });
  expect(
    within(section)
      .getAllByRole('article')
      .map((row) => row.getAttribute('aria-label')),
  ).toEqual([
    'OREB off 2PT misses',
    'DREB off 2PT misses',
    'OREB off 3PT misses',
    'DREB off FT misses',
    'OREB off FT misses',
    'DREB off 3PT misses',
  ]);
  expect(within(section).getByRole('article', { name: 'OREB off 2PT misses' })).toHaveTextContent(
    '+14%',
  );
  const leans = within(section).getByRole('list', {
    name: 'Players leaning on OREB off 2PT misses',
  });
  const items = within(leans).getAllByRole('listitem');
  expect(items.map((item) => item.textContent)).toEqual([
    'Austin Reaves 30% · thin',
    'LeBron James 38%',
  ]);
  expect(items[0]).toHaveAttribute(
    'title',
    '30% of his rebounds · thin sample (0.6 rebounds per game)',
  );
  expect(items[1]).toHaveAttribute('title', '38% of his rebounds');
  expect(
    within(section).queryByRole('button', { name: /Save .* as a Target/ }),
  ).not.toBeInTheDocument();

  await userEvent.click(screen.getByRole('button', { name: 'PTS' }));
  expect(screen.queryByRole('region', { name: 'Rebound Types' })).not.toBeInTheDocument();
});

test('an unavailable Rebound Types base explains itself for REB and stays silent for PTS', async () => {
  const candidate = JSON.parse(JSON.stringify(matchup));
  candidate.league.surfaceAvailability.reboundTypes = {
    season: { status: 'available', unavailableReason: null },
    last15: { status: 'missing', unavailableReason: 'window_not_ready' },
  };
  candidate.teams.find((team) => team.tricode === 'BOS').defenseSheet.reboundTypes = [];
  const lebron = candidate.players.find((player) => player.id === 2544);
  lebron.postedMarkets.push('REB');
  lebron.statCategories.push('REB');
  lebron.provenance.prizepicks.push('REB');
  fetchMatchup.mockResolvedValueOnce(fetched(candidate));
  renderMatchup();
  await screen.findByRole('heading', { name: 'What BOS allows' });

  await userEvent.click(screen.getByRole('button', { name: 'Last 15' }));
  await userEvent.click(screen.getByRole('button', { name: 'REB' }));
  expect(screen.getByRole('heading', { name: 'Rebound Types' })).toBeVisible();
  expect(
    screen.getByText(
      'Rebound Types unavailable for Last 15: Last 15 has not opened yet; it opens once every team has played 15 games.',
    ),
  ).toBeVisible();

  await userEvent.click(screen.getByRole('button', { name: 'PTS' }));
  expect(screen.queryByRole('heading', { name: 'Rebound Types' })).not.toBeInTheDocument();
  expect(screen.queryByText(/Rebound Types unavailable/)).not.toBeInTheDocument();
});

test('an inactive Rebound Types publication reads as not published yet', async () => {
  const candidate = JSON.parse(JSON.stringify(matchup));
  candidate.league.surfaceAvailability.reboundTypes = {
    season: { status: 'missing', unavailableReason: 'publication_inactive' },
    last15: { status: 'missing', unavailableReason: 'publication_inactive' },
  };
  candidate.teams.find((team) => team.tricode === 'BOS').defenseSheet.reboundTypes = [];
  const lebron = candidate.players.find((player) => player.id === 2544);
  lebron.postedMarkets.push('REB');
  lebron.statCategories.push('REB');
  lebron.provenance.prizepicks.push('REB');
  fetchMatchup.mockResolvedValueOnce(fetched(candidate));
  renderMatchup();
  await screen.findByRole('heading', { name: 'What BOS allows' });

  await userEvent.click(screen.getByRole('button', { name: 'REB' }));
  expect(
    screen.getByText('Rebound Types unavailable for Season: Not published yet.'),
  ).toBeVisible();
  expect(screen.queryByText(/publication_inactive/)).not.toBeInTheDocument();
});

test('lists play types by points only, never by possessions', async () => {
  const candidate = JSON.parse(JSON.stringify(matchup));
  const boston = candidate.teams.find((team) => team.tricode === 'BOS');
  // Isolation's points sit near league; its possessions would not.
  boston.defenseSheet.playTypes.push({
    key: 'Isolation:POSS',
    sliceKey: 'Isolation',
    label: 'Isolation POSS',
    markets: ['PTS'],
    season: value(14.9, 31, 1.6, 28),
    last15: value(13.1, 6, 0.9, 22),
  });
  fetchMatchup.mockResolvedValueOnce(fetched(candidate));
  renderMatchup();
  await screen.findByRole('heading', { name: 'What BOS allows' });
  const playTypeRows = () =>
    within(screen.getByRole('region', { name: 'Play types' }))
      .getAllByRole('article')
      .map((row) => row.getAttribute('aria-label'));
  expect(playTypeRows()).toEqual(['Transition']);
  expect(screen.getByText(/1 close to average hidden\./)).toBeVisible();

  await userEvent.click(screen.getByRole('button', { name: 'All deviations' }));
  expect(playTypeRows()).toEqual(['Transition', 'Isolation']);
  // One Points measure per slice: the possession row's +31% never shows.
  expect(sheetRow('Isolation')).toHaveTextContent('+2%');
  expect(sheetRow('Isolation')).not.toHaveTextContent('31%');
});

test('renders a reading with no league comparison without a direction or a guessed percent', async () => {
  const candidate = JSON.parse(JSON.stringify(matchup));
  const boston = candidate.teams.find((team) => team.tricode === 'BOS');
  boston.defenseSheet.playTypes[0].season = value(7.5, null, 1.4, 1);
  fetchMatchup.mockResolvedValueOnce(fetched(candidate));
  renderMatchup();
  await screen.findByRole('heading', { name: 'What BOS allows' });
  await userEvent.click(screen.getByRole('button', { name: 'All deviations' }));
  const transition = sheetRow('Transition');
  const cell = within(transition).getByTitle(
    '7.5 per 48 · +1.4σ · rank 1 of 30 (30 allows the most) · vs league: unavailable (not comparable)',
  );
  expect(within(cell).getByText('—')).toHaveClass('tone-flat');
  expect(transition).not.toHaveTextContent('null');
  // With no comparison it cannot be the softest spot, so it reads last.
  expect(sheetRowNames().slice(0, 2)).toEqual(['Isolation', 'Transition']);
});

test('sorts a player with no season scoring last and explains zero-component offensive scores', async () => {
  const candidate = JSON.parse(JSON.stringify(matchup));
  const lebron = candidate.players.find((player) => player.id === 2544);
  lebron.seasonScoring = null;
  lebron.scores.FGA.last15 = { components: {}, blend: null, missingInputs: [] };
  fetchMatchup.mockResolvedValueOnce(fetched(candidate));
  renderMatchup('/matchups/game-1?player=2544');
  await screen.findByRole('article', { name: 'LeBron James player' });
  expect(railNames()).toEqual(['Austin Reaves', 'LeBron James']);
  // No season average to stand his line beside.
  const row = screen.getByRole('article', { name: 'LeBron James player' });
  expect(row.querySelector('.rail-row-value b')).toHaveTextContent('27.5');
  expect(row).not.toHaveTextContent('avg');
  await userEvent.click(screen.getByRole('button', { name: 'Last 15' }));
  expect(screen.getByText('No score components were computable for FGA in Last 15.')).toBeVisible();
});

test('a late selection response cannot replace a newer player selection', async () => {
  let resolveFirst;
  const first = new Promise((resolve) => {
    resolveFirst = resolve;
  });
  const logRow = (pts, delta) => ({
    date: '2025-12-25',
    matchup: 'LAL vs. BOS',
    minutes: 33,
    stats: { PTS: pts, FG3A: 7, FGA: 18 },
    deltas: { PTS: delta, FG3A: 0.01, FGA: 0.01 },
    average: false,
  });
  const austin = {
    playerId: 1630559,
    h2h: { thin: false, rows: [logRow(44, 0.444)] },
    archetype: { thin: false, rows: [] },
  };
  fetchMatchupSelection.mockImplementation((_gameId, playerId) =>
    playerId === 2544 ? first : Promise.resolve(austin),
  );
  render(
    <MemoryRouter initialEntries={['/matchups/game-1?player=2544']}>
      <Routes>
        <Route path="/matchups/:gameId" element={<MatchupDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
  await screen.findByRole('heading', { name: 'LeBron James', level: 2 });
  await userEvent.click(
    within(screen.getByRole('article', { name: 'Austin Reaves player' })).getByRole('button', {
      name: 'Open selection card',
    }),
  );
  expect(await screen.findByRole('heading', { name: 'Austin Reaves', level: 2 })).toBeVisible();
  expect((await screen.findAllByText('+0.444')).length).toBeGreaterThan(0);
  // LeBron's request settles after Austin's: his logs must not replace Austin's.
  await act(async () =>
    resolveFirst({
      playerId: 2544,
      h2h: { thin: false, rows: [logRow(77, 0.777)] },
      archetype: { thin: false, rows: [] },
    }),
  );
  expect(screen.getByRole('heading', { name: 'Austin Reaves', level: 2 })).toBeVisible();
  expect(screen.getAllByText('+0.444').length).toBeGreaterThan(0);
  expect(screen.queryByText('+0.777')).not.toBeInTheDocument();
  expect(screen.queryByText('Loading selection logs…')).not.toBeInTheDocument();
});

test('orders the rail by season scoring in every stat and scopes tabs to the displayed side', async () => {
  renderMatchup();
  await screen.findByRole('heading', { name: 'What BOS allows' });
  expect(screen.queryByRole('button', { name: 'REB' })).not.toBeInTheDocument();
  expect(railNames()).toEqual(['LeBron James', 'Austin Reaves']);
  // FG3A would put Austin first by Matchup Score; the order stays season scoring.
  await userEvent.click(screen.getByRole('button', { name: 'FG3A' }));
  expect(railNames()).toEqual(['Austin Reaves']);
  await userEvent.click(screen.getByRole('button', { name: 'PTS' }));
  expect(railNames()).toEqual(['LeBron James', 'Austin Reaves']);
  expect(screen.queryByRole('button', { name: 'Matchup Score' })).not.toBeInTheDocument();
  expect(screen.queryByRole('group', { name: 'Player rail sort' })).not.toBeInTheDocument();

  await userEvent.click(screen.getByRole('button', { name: /^LAL defense/ }));
  expect(await screen.findByRole('button', { name: 'REB' })).toBeVisible();
  expect(screen.queryByRole('button', { name: 'FGA' })).not.toBeInTheDocument();
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'All', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    ),
  );
});

test('the team switch heads the sidebar and the stat strip sits last on the sheet', async () => {
  render(
    <MemoryRouter initialEntries={['/matchups/game-1']}>
      <Routes>
        <Route path="/matchups/:gameId" element={<MatchupDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
  await screen.findByRole('heading', { name: 'What BOS allows' });
  const teamTabs = screen.getByRole('group', { name: 'Defense team' });
  const sidebar = document.querySelector('.matchup-sidebar');
  // The injury line heads the sidebar, then the team switch.
  expect(sidebar.firstElementChild).toBe(screen.getByRole('region', { name: 'Injury report' }));
  expect(sidebar.children[1]).toBe(teamTabs);
  const tabs = within(teamTabs).getAllByRole('button');
  expect(tabs.map((tab) => tab.textContent)).toEqual([
    'LAL defensevs BOS players',
    'BOS defensevs LAL players',
  ]);
  expect(tabs[1]).toHaveAttribute('aria-pressed', 'true');

  const controls = screen.getByRole('region', { name: 'Defense Sheet controls' });
  expect(within(controls).queryByRole('button', { name: /defense/ })).not.toBeInTheDocument();
  const groups = within(controls).getAllByRole('group');
  expect(groups.map((group) => group.getAttribute('aria-label'))).toEqual([
    'Stat window',
    'Deviation filter',
    'Market',
  ]);
});

// The decoder guarantees unique team ids, not unique tricodes, so the tabs
// must follow ids: with a tricode collision each tab still reaches its own
// team and flips the rail to the other side's players.
test('team tabs follow team ids when both teams share a tricode', async () => {
  const candidate = JSON.parse(JSON.stringify(matchup));
  candidate.game.away = { ...candidate.game.away, teamId: 1, tricode: 'LAL' };
  candidate.game.home = { ...candidate.game.home, teamId: 2, tricode: 'LAL' };
  candidate.teams = candidate.teams.map((team) => ({ ...team, tricode: 'LAL' }));
  fetchMatchup.mockResolvedValueOnce(fetched(candidate));
  render(
    <MemoryRouter initialEntries={['/matchups/game-1']}>
      <Routes>
        <Route path="/matchups/:gameId" element={<MatchupDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
  const rail = await screen.findByRole('complementary', { name: 'Targetable players' });
  const tabs = within(screen.getByRole('group', { name: 'Defense team' })).getAllByRole('button');
  expect(tabs).toHaveLength(2);
  const railNames = () =>
    within(rail)
      .getAllByRole('article', { name: /player/i })
      .map((article) => article.getAttribute('aria-label'));
  const pressedIndex = tabs.findIndex((tab) => tab.getAttribute('aria-pressed') === 'true');
  expect(pressedIndex).not.toBe(-1);
  const before = railNames();
  await userEvent.click(tabs[1 - pressedIndex]);
  expect(tabs[1 - pressedIndex]).toHaveAttribute('aria-pressed', 'true');
  expect(tabs[pressedIndex]).toHaveAttribute('aria-pressed', 'false');
  const after = railNames();
  expect(after).not.toEqual(before);
  expect(after.some((name) => before.includes(name))).toBe(false);
});

test('renders raw injury statuses and keeps the signed-out shell honest', async () => {
  const { unmount } = render(
    <MemoryRouter initialEntries={['/matchups/game-1']}>
      <Routes>
        <Route path="/matchups/:gameId" element={<MatchupDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
  const toggle = await screen.findByRole('button', {
    name: 'Injuries · 1 Game-time decision Show',
  });
  expect(toggle).toHaveAttribute('aria-expanded', 'false');
  expect(document.getElementById('injury-line-names')).toBeNull();
  await userEvent.click(toggle);
  expect(toggle).toHaveAttribute('aria-expanded', 'true');
  expect(toggle).toHaveTextContent('Hide');
  const names = document.getElementById('injury-line-names');
  expect(names).toHaveTextContent(
    /^LALGame-time decision Austin Reavesfresh · as of .* · rotowire$/,
  );
  expect(within(names).getByRole('link', { name: 'rotowire' })).toHaveAttribute(
    'href',
    'https://example.com/injuries',
  );
  expect(screen.queryByText('Left calf soreness')).not.toBeInTheDocument();
  await userEvent.click(toggle);
  expect(document.getElementById('injury-line-names')).toBeNull();

  unmount();
  useAuth.mockReturnValue({ isAuthenticated: false, loading: false });
  fetchMatchup.mockClear();
  render(
    <MemoryRouter initialEntries={['/matchups/game-1']}>
      <Routes>
        <Route path="/matchups/:gameId" element={<MatchupDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
  expect(screen.getByRole('heading', { name: 'Sign in to view this matchup' })).toBeVisible();
  expect(screen.getByRole('button', { name: 'Sign up free' })).toBeEnabled();
  await waitFor(() => expect(fetchMatchup).not.toHaveBeenCalled());
});

test('opens and deep-links the selection card while market flips reuse delivered logs', async () => {
  render(
    <MemoryRouter initialEntries={['/matchups/game-1?player=2544']}>
      <Routes>
        <Route path="/matchups/:gameId" element={<MatchupDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
  expect(await screen.findByRole('heading', { name: 'LeBron James', level: 2 })).toBeVisible();
  expect(screen.getByRole('region', { name: 'Matchup Score' })).toHaveTextContent(
    'PTS Matchup Score+12.0%',
  );
  expect((await screen.findAllByText('+0.083')).length).toBeGreaterThan(0);
  expect(screen.queryByText('Archetype sample')).not.toBeInTheDocument();
  expect(screen.getByText('Transition').closest('article')).toHaveClass('selection-why');
  await userEvent.click(
    within(screen.getByRole('group', { name: 'Selection log stat' })).getByRole('button', {
      name: 'FGA',
    }),
  );
  expect((await screen.findAllByText('+0.018')).length).toBeGreaterThan(0);
  expect(fetchMatchupSelection).toHaveBeenCalledTimes(1);
});

test('each strip tab carries its Matchup Score, green up and red down', async () => {
  const candidate = JSON.parse(JSON.stringify(matchup));
  const lebron = candidate.players.find((player) => player.id === 2544);
  lebron.scores.FGA.season.blend.value = -0.043;
  fetchMatchup.mockResolvedValueOnce(fetched(candidate));
  renderMatchup('/matchups/game-1?player=2544');
  await screen.findByRole('heading', { name: 'LeBron James', level: 2 });

  const strip = within(screen.getByRole('group', { name: 'Selection log stat' }));
  const score = (name) => strip.getByRole('button', { name }).querySelector('small');
  expect(score('PTS')).toHaveTextContent('+12.0%');
  expect(score('PTS')).toHaveClass('pmc-up');
  expect(score('FGA')).toHaveTextContent('−4.3%');
  expect(score('FGA')).toHaveClass('pmc-down');
});

test('filtered to a combo market, the Defense Sheet lists the shot make rows that feed its points', async () => {
  const candidate = JSON.parse(JSON.stringify(matchup));
  const boston = candidate.teams.find((team) => team.tricode === 'BOS');
  boston.defenseSheet.shotZones = [
    ['Restricted Area:FGM', 'Restricted Area', ['PTS', 'PA', 'PR', 'PRA']],
    ['Corner 3:FGM', 'Corner 3', ['PTS', '3PM', 'PA', 'PR', 'PRA']],
    ['Corner 3:FGA', 'Corner 3', ['FGA', 'FG3A']],
  ].map(([key, sliceKey, markets]) => ({
    key,
    sliceKey,
    label: key,
    markets,
    season: value(9, 5, 1, 20),
    last15: value(9, 5, 1, 20),
  }));
  boston.defenseSheet.shotTypes = [
    ['Pullups:FG2M', 'Pullups', ['PTS', 'PA', 'PR', 'PRA']],
    ['Catch and Shoot:FG3M', 'Catch and Shoot', ['3PM', 'PTS', 'PA', 'PR', 'PRA']],
  ].map(([key, sliceKey, markets]) => ({
    key,
    sliceKey,
    label: key,
    markets,
    season: value(5, 5, 1, 20),
    last15: value(5, 5, 1, 20),
  }));
  candidate.players.find((player) => player.id === 2544).statCategories.push('PRA', 'PR', 'PA');
  fetchMatchup.mockResolvedValueOnce(fetched(candidate));

  renderMatchup();
  await screen.findByRole('heading', { name: 'What BOS allows' });

  for (const combo of ['PRA', 'PR', 'PA']) {
    await userEvent.click(screen.getByRole('button', { name: combo }));
    for (const slice of ['Restricted area', 'Corner 3s', 'Pull-up 2s', 'Catch-and-shoot 3s']) {
      expect(sheetRow(slice)).toBeVisible();
    }
    // Corner 3 attempts feed no combo but still show, at full strength, beside the makes.
    const cells = within(sheetRow('Corner 3s')).getAllByTitle(/per 48/);
    expect(cells.map((cell) => cell.className)).toEqual(['sheet-cell', 'sheet-cell']);
  }
});

test('the Defense Sheet leaves out catch-and-shoot 2s and under-10-ft 3s', async () => {
  const candidate = JSON.parse(JSON.stringify(matchup));
  const boston = candidate.teams.find((team) => team.tricode === 'BOS');
  boston.defenseSheet.shotTypes = [
    'Catch and Shoot:FG3A',
    'Catch and Shoot:FG2A',
    'Pullups:FG3A',
    'Pullups:FG2A',
    'Less Than 10 ft:FG2A',
    'Less Than 10 ft:FG3A',
  ].map((key) => ({
    key,
    sliceKey: key.split(':')[0],
    label: key,
    markets: ['PTS'],
    season: value(9, 5, 1, 20),
    last15: value(9, 5, 1, 20),
  }));
  fetchMatchup.mockResolvedValueOnce(fetched(candidate));

  renderMatchup();
  const sheet = (await screen.findByRole('heading', { name: 'What BOS allows' })).closest(
    'section',
  );
  const shotTypes = within(sheet)
    .getByRole('heading', { name: 'Shot types', level: 3 })
    .closest('section');
  expect(
    within(shotTypes)
      .getAllByRole('article')
      .map((row) => row.getAttribute('aria-label')),
  ).toEqual(['Catch-and-shoot 3s', 'Pull-up 3s', 'Pull-up 2s', 'Under 10 ft 2s']);
});

test('decoded shot-type Points rows leave the rendered Shot types section unchanged', async () => {
  const rawWindow = {
    allowed_per_48: 9,
    percent_vs_league_average: 5,
    sigma_deviation: 1,
    rank: 20,
  };
  const rawRow = (key, markets) => ({
    key,
    label: key,
    markets,
    season: rawWindow,
    last_15: rawWindow,
  });
  const decodeBostonShotTypes = (withPoints) => {
    const raw = JSON.parse(JSON.stringify(rawMatchupPayload));
    raw.teams[1].defense_sheet.shot_types = [
      rawRow('Catch and Shoot:FG3A', ['FGA', 'FG3A']),
      rawRow('Catch and Shoot:FG3M', ['3PM', 'PTS', 'PA', 'PR', 'PRA']),
      rawRow('Pullups:FG3A', ['FGA', 'FG3A']),
      rawRow('Pullups:FG3M', ['3PM', 'PTS', 'PA', 'PR', 'PRA']),
      rawRow('Pullups:FG2M', ['PTS', 'PA', 'PR', 'PRA']),
      ...(withPoints
        ? ['Catch and Shoot', 'Pullups', 'Less Than 10 ft'].map((slice) =>
            rawRow(`${slice}:PTS`, ['PTS', 'PA', 'PR', 'PRA']),
          )
        : []),
    ];
    raw.league.defense_sheet.shot_types = raw.teams[1].defense_sheet.shot_types.map(({ key }) => ({
      key,
      season: { average_allowed_per_48: 9, sigma: 1 },
      last_15: { average_allowed_per_48: 9, sigma: 1 },
    }));
    return jest.requireActual('./matchupApi').decodeMatchup(raw).teams[1].defenseSheet.shotTypes;
  };
  const renderedRows = async (withPoints) => {
    const candidate = JSON.parse(JSON.stringify(matchup));
    candidate.teams.find((team) => team.tricode === 'BOS').defenseSheet.shotTypes =
      decodeBostonShotTypes(withPoints);
    fetchMatchup.mockResolvedValueOnce(fetched(candidate));
    const { unmount } = renderMatchup();
    const sheet = (await screen.findByRole('heading', { name: 'What BOS allows' })).closest(
      'section',
    );
    const shotTypes = within(sheet)
      .getByRole('heading', { name: 'Shot types', level: 3 })
      .closest('section');
    const rows = within(shotTypes)
      .getAllByRole('article')
      .map((row) => row.getAttribute('aria-label'));
    const text = shotTypes.textContent;
    unmount();
    return { rows, text };
  };

  const without = await renderedRows(false);
  const withPoints = await renderedRows(true);
  expect(without.rows).toEqual(['Catch-and-shoot 3s', 'Pull-up 3s', 'Pull-up 2s']);
  expect(withPoints.rows).toEqual(['Catch-and-shoot 3s', 'Pull-up 3s', 'Pull-up 2s']);
  expect(withPoints.text).toBe(without.text);
});

test('the Selection card highlights the shot make rows behind a combo market for his Diet', async () => {
  const candidate = JSON.parse(JSON.stringify(matchup));
  const boston = candidate.teams.find((team) => team.tricode === 'BOS');
  const row = (key, sliceKey, markets) => ({
    key,
    sliceKey,
    label: key,
    markets,
    season: value(9, 5, 1, 20),
    last15: value(9, 5, 1, 20),
  });
  boston.defenseSheet.shotZones = [
    row('Restricted Area:FGM', 'Restricted Area', ['PTS', 'PA', 'PR', 'PRA']),
    row('Corner 3:FGM', 'Corner 3', ['PTS', '3PM', 'PA', 'PR', 'PRA']),
  ];
  boston.defenseSheet.shotTypes = [
    row('Pullups:FG2M', 'Pullups', ['PTS', 'PA', 'PR', 'PRA']),
    row('Catch and Shoot:FG3M', 'Catch and Shoot', ['3PM', 'PTS', 'PA', 'PR', 'PRA']),
  ];
  const lebron = candidate.players.find((player) => player.id === 2544);
  const share = { share: 0.3, volumePerGame: 5.1, sigmaDeviation: 1.2 };
  lebron.dietShares.shotZones = [
    { key: 'Restricted Area', season: share },
    { key: 'Corner 3', season: share },
  ];
  const split = { ...share, shotValues: { 2: share, 3: share } };
  lebron.dietShares.shotTypes = [
    { key: 'Pullups', season: split },
    { key: 'Catch and Shoot', season: split },
  ];
  lebron.statCategories.push('PRA', 'PR', 'PA');
  for (const combo of ['PRA', 'PR', 'PA']) lebron.scores[combo] = score(0.08, 0.02);
  fetchMatchup.mockResolvedValueOnce(fetched(candidate));

  renderMatchup('/matchups/game-1?player=2544');
  await screen.findByRole('heading', { name: 'LeBron James', level: 2 });

  const tabs = screen.getByRole('group', { name: 'Market' });
  for (const combo of ['PRA', 'PR', 'PA']) {
    await userEvent.click(within(tabs).getByRole('button', { name: combo }));
    for (const slice of ['Restricted area', 'Corner 3s', 'Pull-up 2s', 'Catch-and-shoot 3s']) {
      expect(sheetRow(slice)).toHaveClass('selection-why');
    }
  }
});

test('pull-up 3s and pull-up 2s each list who leans on that shot, with its own share', async () => {
  const candidate = JSON.parse(JSON.stringify(matchup));
  const boston = candidate.teams.find((team) => team.tricode === 'BOS');
  boston.defenseSheet.shotTypes = ['Pullups:FG3A', 'Pullups:FG2A'].map((key) => ({
    key,
    sliceKey: 'Pullups',
    label: key,
    markets: ['PTS'],
    season: value(9, 5, 1, 20),
    last15: value(9, 5, 1, 20),
  }));
  const lean = (share, sigmaDeviation) => ({ share, volumePerGame: 4, sigmaDeviation });
  const pullUps = (twos, threes) => [
    {
      key: 'Pullups',
      season: { ...lean(0.4, 1.5), shotValues: twos && { 2: twos, 3: threes } },
    },
  ];
  const [reaves, lebron, tatum] = [1630559, 2544, 1628369].map((id) =>
    candidate.players.find((player) => player.id === id),
  );
  // Reaves leans on pull-up threes, LeBron on pull-up twos; Tatum's split is missing.
  reaves.dietShares.shotTypes = pullUps(lean(0.1, -0.5), lean(0.3, 1.4));
  lebron.dietShares.shotTypes = pullUps(lean(0.28, 1.2), lean(0.12, -0.3));
  tatum.dietShares.shotTypes = pullUps(null, null);
  for (const player of [reaves, lebron, tatum]) player.statCategories = ['PTS'];
  fetchMatchup.mockResolvedValueOnce(fetched(candidate));

  renderMatchup();
  await screen.findByRole('heading', { name: 'What BOS allows' });

  expect(
    within(sheetRow('Pull-up 3s')).getByRole('list', { name: 'Players leaning on Pull-up 3s' }),
  ).toHaveTextContent(/^Austin Reaves 30%$/);
  expect(
    within(sheetRow('Pull-up 2s')).getByRole('list', { name: 'Players leaning on Pull-up 2s' }),
  ).toHaveTextContent(/^LeBron James 28%$/);
});

test('a shot value row reads the whole shot type floor, not its own attempts', async () => {
  const candidate = JSON.parse(JSON.stringify(matchup));
  const boston = candidate.teams.find((team) => team.tricode === 'BOS');
  boston.defenseSheet.shotTypes = [
    {
      key: 'Pullups:FG3A',
      sliceKey: 'Pullups',
      label: 'Pullups:FG3A',
      markets: ['PTS'],
      season: value(9, 5, 1, 20),
      last15: value(9, 5, 1, 20),
    },
  ];
  const lean = (share, volumePerGame) => ({ share, volumePerGame, sigmaDeviation: 2 });
  const reaves = candidate.players.find((player) => player.id === 1630559);
  const lebron = candidate.players.find((player) => player.id === 2544);
  reaves.dietShares.shotTypes = [
    {
      key: 'Pullups',
      season: { ...lean(0.4, 6), shotValues: { 2: lean(0.2, 3), 3: lean(0.2, 3) } },
    },
  ];
  lebron.dietShares.shotTypes = [
    {
      key: 'Pullups',
      // More pull-up threes than Austin, but 3.5 shot-type attempts in all.
      season: { ...lean(0.4, 3.5), shotValues: { 2: lean(0.1, 0.5), 3: lean(0.3, 3) } },
    },
  ];
  for (const player of [reaves, lebron]) player.statCategories = ['PTS'];
  fetchMatchup.mockResolvedValueOnce(fetched(candidate));

  renderMatchup();
  await screen.findByRole('heading', { name: 'What BOS allows' });

  expect(
    within(sheetRow('Pull-up 3s')).getByRole('list', { name: 'Players leaning on Pull-up 3s' }),
  ).toHaveTextContent(/^Austin Reaves 20%$/);
});

test('joins suffixed sheet rows to bare governed Diet slice identities', async () => {
  const candidate = JSON.parse(JSON.stringify(matchup));
  const defense = candidate.teams.find((team) => team.tricode === 'BOS').defenseSheet;
  defense.shotZones = [
    {
      key: 'Restricted Area:FGA',
      sliceKey: 'Restricted Area',
      label: 'Restricted Area FGA',
      markets: ['FGA', 'FG2A'],
      season: value(23, 10, 1.2, 25),
      last15: value(21, -7, -1.1, 7),
    },
  ];
  defense.shotTypes = [
    {
      key: 'Catch and Shoot:FG3A',
      sliceKey: 'Catch and Shoot',
      label: 'Catch and Shoot FG3A',
      markets: ['FGA', 'FG3A'],
      season: value(17, 9, 1.1, 23),
      last15: value(16, 8, 1.2, 22),
    },
  ];
  const lebron = candidate.players.find((player) => player.id === 2544);
  lebron.dietShares.shotZones = [
    { key: 'Restricted Area', season: { share: 0.27, volumePerGame: 5.1, sigmaDeviation: 1.1 } },
  ];
  lebron.dietShares.shotTypes = [
    {
      key: 'Catch and Shoot',
      season: {
        share: 0.36,
        volumePerGame: 4.2,
        sigmaDeviation: 1.2,
        shotValues: {
          2: { share: 0.02, volumePerGame: 0.2, sigmaDeviation: -0.4 },
          3: { share: 0.34, volumePerGame: 4.0, sigmaDeviation: 1.3 },
        },
      },
    },
  ];
  fetchMatchup.mockResolvedValueOnce(fetched(candidate));
  renderMatchup('/matchups/game-1?player=2544');
  await screen.findByRole('heading', { name: 'LeBron James', level: 2 });
  await userEvent.click(
    within(screen.getByRole('group', { name: 'Market' })).getByRole('button', { name: 'FGA' }),
  );

  expect(sheetRow('Restricted area')).toHaveClass('selection-why');
  expect(sheetRow('Catch-and-shoot 3s')).toHaveClass('selection-why');
  expect(
    within(sheetRow('Restricted area')).getByRole('list', {
      name: 'Players leaning on Restricted area',
    }),
  ).toHaveTextContent(/^LeBron James 27%$/);
  expect(
    within(sheetRow('Catch-and-shoot 3s')).getByRole('list', {
      name: 'Players leaning on Catch-and-shoot 3s',
    }),
  ).toHaveTextContent(/^LeBron James 34%$/);
});

test('player switches clamp the card stat and team toggles remain user-controlled', async () => {
  const empty = (playerId) => ({
    playerId,
    h2h: { thin: false, rows: [] },
    archetype: { thin: false, rows: [] },
  });
  fetchMatchupSelection.mockImplementation((_gameId, playerId) => Promise.resolve(empty(playerId)));
  render(
    <MemoryRouter initialEntries={['/matchups/game-1?player=2544']}>
      <Routes>
        <Route path="/matchups/:gameId" element={<MatchupDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
  await screen.findByRole('heading', { name: 'LeBron James', level: 2 });
  await userEvent.click(
    within(screen.getByRole('group', { name: 'Selection log stat' })).getByRole('button', {
      name: 'FGA',
    }),
  );
  await userEvent.click(
    within(screen.getByRole('article', { name: 'Austin Reaves player' })).getByRole('button', {
      name: 'Open selection card',
    }),
  );
  await screen.findByRole('heading', { name: 'Austin Reaves', level: 2 });
  // The clamp runs in an effect, so it lands a render after the heading. Waiting
  // on the heading alone would sample the stat before the clamp is applied.
  await waitFor(() =>
    expect(
      within(screen.getByRole('group', { name: 'Selection log stat' })).getByRole('button', {
        name: 'PTS',
      }),
    ).toHaveAttribute('aria-pressed', 'true'),
  );
  await userEvent.click(screen.getByRole('button', { name: /^LAL defense/ }));
  expect(screen.getByRole('button', { name: /^LAL defense/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  expect(screen.getByRole('heading', { name: 'Austin Reaves', level: 2 })).toBeVisible();
  expect(screen.getByText(/not opposing the viewed Defense Sheet/)).toBeVisible();
});

test('the card follows later sheet-stat changes but keeps a stat chosen on the card', async () => {
  renderMatchup();
  await screen.findByRole('heading', { name: 'What BOS allows' });
  const sheetMarkets = within(screen.getByRole('group', { name: 'Market' }));
  await userEvent.click(
    within(screen.getByRole('article', { name: 'LeBron James player' })).getByRole('button', {
      name: 'Open selection card',
    }),
  );
  await screen.findByRole('group', { name: 'Selection log stat' });
  const pressed = () =>
    within(screen.getByRole('group', { name: 'Selection log stat' }))
      .getAllByRole('button')
      .filter((button) => button.getAttribute('aria-pressed') === 'true')
      .map((button) => button.getAttribute('aria-label'));
  expect(pressed()).toEqual(['PTS']);

  // A later sheet stat he has carries into the card.
  await userEvent.click(sheetMarkets.getByRole('button', { name: 'FGA' }));
  // The card follows in an effect, so it lands a render after the click.
  await waitFor(() => expect(pressed()).toEqual(['FGA']));
  await userEvent.click(sheetMarkets.getByRole('button', { name: 'PTS' }));
  await waitFor(() => expect(pressed()).toEqual(['PTS']));

  // A stat chosen on the card survives sheet stats he does not have, and All.
  await userEvent.click(
    within(screen.getByRole('group', { name: 'Selection log stat' })).getByRole('button', {
      name: 'FGA',
    }),
  );
  expect(sheetMarkets.getByRole('button', { name: 'PTS' })).toHaveAttribute('aria-pressed', 'true');
  await userEvent.click(sheetMarkets.getByRole('button', { name: 'FG3A' }));
  await act(async () => {});
  expect(pressed()).toEqual(['FGA']);
  await userEvent.click(sheetMarkets.getByRole('button', { name: 'All' }));
  await act(async () => {});
  expect(pressed()).toEqual(['FGA']);
  expect(fetchMatchupSelection).toHaveBeenCalledTimes(1);
});

const historicalSection = (status, source, context, unavailableReason = null) => ({
  status,
  source,
  context,
  unavailableReason,
  collectedAt: null,
});

const historicalMatchup = () => {
  const candidate = JSON.parse(JSON.stringify(matchup));
  candidate.experience = {
    mode: 'historical',
    playerSource: 'game_logs',
    sections: {
      schedule: historicalSection('available', 'event_catalog', 'completed_season_catalog'),
      participants: historicalSection('available', 'player_game_logs', 'completed_season'),
      seasonDefense: historicalSection('available', 'team_matchup_publication', 'completed_season'),
      last15Defense: historicalSection('unavailable', null, null, 'no_point_in_time_snapshot'),
      injuries: historicalSection('unavailable', null, null, 'no_pregame_snapshot'),
    },
  };
  // The production red signal: no stats_tables marker and no archived pool.
  candidate.freshness.stats = { status: 'missing', retrievedAt: null };
  candidate.freshness.pool = { status: 'unavailable', retrievedAt: null, providers: [] };
  candidate.players.forEach((player, index) => {
    player.playerSource = 'game_logs';
    player.postedMarkets = [];
    player.provenance = {};
    player.lines = {};
    player.injuryBadgeRef = null;
    player.focalGameLine = {
      gameId: 'game-1',
      gameDate: '2026-03-29',
      matchup: 'LAL @ BOS',
      minutes: 30 + index,
      stats: Object.fromEntries(
        player.statCategories.map((category, offset) => [category, 10 + offset]),
      ),
    };
  });
  return candidate;
};

const sheetRegion = () => screen.getByRole('region', { name: /^What [A-Z]+ allows$/ });
const sheetRow = (name) => within(sheetRegion()).getByRole('article', { name });
const sheetRowNames = () =>
  within(sheetRegion())
    .queryAllByRole('article')
    .map((row) => row.getAttribute('aria-label'));
const railNames = () =>
  screen
    .getAllByRole('article', { name: / player$/ })
    .map((row) => row.getAttribute('aria-label').replace(/ player$/, ''));
// Locale time strings may separate "9:30" from "AM" with a narrow space.
const normalized = (element) => element.textContent.replace(/\s+/g, ' ');

const LocationProbe = () => {
  const { pathname, search } = useLocation();
  return <output data-testid="location">{pathname + search}</output>;
};

const renderMatchup = (path = '/matchups/game-1') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/matchups/:gameId" element={<MatchupDetailPage />} />
        <Route path="/targets/:targetId" element={<p>One Target</p>} />
      </Routes>
      <LocationProbe />
    </MemoryRouter>,
  );

test('keeps the live Defense Sheet gated on missing legacy stats freshness', async () => {
  const candidate = JSON.parse(JSON.stringify(matchup));
  candidate.freshness.stats = { status: 'missing', retrievedAt: null };
  fetchMatchup.mockResolvedValueOnce(fetched(candidate));
  renderMatchup();

  expect(await screen.findByRole('heading', { name: 'What BOS allows' })).toBeVisible();
  expect(screen.getByText('Defense Sheet unavailable because stats are missing.')).toBeVisible();
  expect(screen.queryByText('Transition')).not.toBeInTheDocument();
});

test('renders Season defense from its own Surface while legacy stats freshness is missing', async () => {
  fetchMatchup.mockResolvedValueOnce(fetched(historicalMatchup()));
  renderMatchup();

  expect(await screen.findByRole('heading', { name: 'What BOS allows' })).toBeVisible();
  expect(sheetRow('Transition')).toBeVisible();
  expect(
    screen.queryByText('Defense Sheet unavailable because stats are missing.'),
  ).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Last 15' })).toBeDisabled();
});

test('labels the historical rail Players in game and switches it with the defense team', async () => {
  fetchMatchup.mockResolvedValueOnce(fetched(historicalMatchup()));
  renderMatchup();

  const rail = await screen.findByRole('complementary', { name: 'Players in game' });
  expect(within(rail).getByRole('article', { name: 'LeBron James player' })).toBeVisible();
  expect(within(rail).getByRole('article', { name: 'Austin Reaves player' })).toBeVisible();
  expect(
    within(rail).queryByRole('article', { name: 'Jayson Tatum player' }),
  ).not.toBeInTheDocument();
  expect(screen.queryByText('Targetable players')).not.toBeInTheDocument();
  expect(screen.queryByRole('group', { name: 'Market' })).not.toBeInTheDocument();
  expect(screen.getByRole('group', { name: 'Stat category' })).toBeVisible();
  expect(rail).not.toHaveTextContent('completed-season context');

  await userEvent.click(screen.getByRole('button', { name: /^LAL defense/ }));
  expect(await screen.findByRole('article', { name: 'Jayson Tatum player' })).toBeVisible();
  expect(screen.queryByRole('article', { name: 'LeBron James player' })).not.toBeInTheDocument();
});

// A defensive category has no Blend by contract, so its component carries the
// score. That is the reachable shape in which a withheld score can still ship
// component evidence: the offensive case is already rejected by the decoder.
const withDefensiveScores = (candidate, missingInputs) => {
  candidate.players.forEach((player) => {
    player.statCategories = [...player.statCategories, 'TOV'];
    player.scores.TOV = {
      season: {
        components: { traditional: { value: player.id === 1630559 ? 0.44 : 0.12, thin: false } },
        blend: null,
        missingInputs: player.id === 1630559 ? missingInputs : [],
      },
      last15: { components: {}, blend: null, missingInputs: [] },
    };
    player.focalGameLine.stats.TOV = 2;
  });
  return candidate;
};

test('refuses to open a dossier for an unavailable participant', async () => {
  const candidate = historicalMatchup();
  candidate.experience.sections.participants = historicalSection(
    'unavailable',
    null,
    null,
    'game_logs_incomplete',
  );
  fetchMatchup.mockResolvedValueOnce(fetched(candidate));
  renderMatchup('/matchups/game-1?player=2544');

  await screen.findByRole('heading', { name: 'What BOS allows' });
  expect(screen.getByText('That player is not available in this matchup.')).toBeVisible();
  expect(screen.queryByRole('heading', { name: 'LeBron James', level: 2 })).not.toBeInTheDocument();
  expect(fetchMatchupSelection).not.toHaveBeenCalled();
});

test('names the missing inputs of a withheld score in the dossier', async () => {
  fetchMatchup.mockResolvedValueOnce(
    fetched(withDefensiveScores(historicalMatchup(), ['team_defense:traditional'])),
  );
  renderMatchup('/matchups/game-1?player=1630559');

  await screen.findByRole('heading', { name: 'Austin Reaves', level: 2 });
  // The component evidence survives, so the card must say why the score did not.
  await userEvent.click(
    within(screen.getByRole('group', { name: 'Selection log stat' })).getByRole('button', {
      name: 'TOV',
    }),
  );
  expect(screen.getByRole('region', { name: 'Matchup Score' })).toHaveTextContent(
    'No Matchup Score for TOV in Season.',
  );
  expect(
    screen.getByText('TOV Matchup Score unavailable in Season: missing team_defense:traditional.'),
  ).toBeVisible();
});

test('names an unavailable participant source while the Defense Sheet stays usable', async () => {
  const candidate = historicalMatchup();
  candidate.experience.sections.participants = historicalSection(
    'unavailable',
    null,
    null,
    'game_logs_incomplete',
  );
  fetchMatchup.mockResolvedValueOnce(fetched(candidate));
  renderMatchup();

  expect(await screen.findByRole('heading', { name: 'What BOS allows' })).toBeVisible();
  expect(sheetRow('Transition')).toBeVisible();
  expect(screen.getByText('Canonical game logs are incomplete for this game.')).toBeVisible();
  expect(screen.queryByRole('article', { name: 'LeBron James player' })).not.toBeInTheDocument();
});

test('separates the focal outcome from hindsight context in the historical dossier', async () => {
  fetchMatchup.mockResolvedValueOnce(fetched(historicalMatchup()));
  fetchMatchupSelection.mockResolvedValueOnce({
    playerId: 2544,
    experience: {
      mode: 'historical',
      playerSource: 'game_logs',
      focalGame: {
        gameId: 'game-1',
        gameDate: '2026-03-29',
        matchup: 'LAL @ BOS',
        minutes: 31,
        stats: { PTS: 10, FGA: 11 },
      },
      samples: { context: 'pregame', excludesFocalGame: true },
      baseline: { context: 'completed_season', hindsight: true },
    },
    h2h: { thin: false, rows: [] },
    archetype: { thin: false, rows: [] },
  });
  renderMatchup('/matchups/game-1?player=2544');

  expect(await screen.findByRole('heading', { name: 'LeBron James', level: 2 })).toBeVisible();
  // The focal box score is the strip: minutes first, then one tile per category.
  expect(screen.getByText('LAL @ BOS, 2026-03-29.')).toBeVisible();
  const strip = within(screen.getByRole('group', { name: 'Selection log stat' }));
  expect(strip.getByText('MIN').nextSibling).toHaveTextContent('31.0');
  expect(strip.getByRole('button', { name: 'PTS' })).toHaveTextContent('10.0');
  expect(strip.getByRole('button', { name: 'PTS' })).toHaveAccessibleDescription(
    /^10\.0 [+−][\d.]+% Season Matchup Score$/,
  );
  expect(strip.getByRole('button', { name: 'FGA' })).toHaveTextContent('11.0');
  await waitFor(() =>
    expect(screen.getByText('No games vs this opponent data is available.')).toBeVisible(),
  );
  // Hindsight context left with the Archetype sample; the explainer still names it.
  expect(screen.queryByText(/hindsight/)).not.toBeInTheDocument();
  expect(screen.getByText(/Matchup Scores reflect completed-season context\./)).toBeVisible();
  // The dossier is requested for governed Stat Categories, not posted markets.
  expect(fetchMatchupSelection.mock.calls.at(-1).slice(0, 3)).toEqual([
    'game-1',
    2544,
    ['PTS', 'FGA'],
  ]);
});

test('labels the historical explainer with completed-season context', async () => {
  fetchMatchup.mockResolvedValueOnce(fetched(historicalMatchup()));
  renderMatchup('/matchups/game-1?player=2544');

  await screen.findByRole('heading', { name: 'LeBron James', level: 2 });
  expect(screen.getByText(/Matchup Scores reflect completed-season context\./)).toBeVisible();
});

test('does not label the explainer in current mode', async () => {
  render(
    <MemoryRouter initialEntries={['/matchups/game-1?player=2544']}>
      <Routes>
        <Route path="/matchups/:gameId" element={<MatchupDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );

  await screen.findByRole('heading', { name: 'LeBron James', level: 2 });
  expect(screen.queryByText(/completed-season context/)).not.toBeInTheDocument();
});

test('selection request errors replace loading with an honest alert', async () => {
  fetchMatchupSelection.mockRejectedValueOnce(new Error('selection failed'));
  render(
    <MemoryRouter initialEntries={['/matchups/game-1?player=2544']}>
      <Routes>
        <Route path="/matchups/:gameId" element={<MatchupDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
  expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load selection logs');
  expect(screen.queryByText('Loading selection logs…')).not.toBeInTheDocument();
});

test('an upcoming game shows minutes to date and the books posting each market', async () => {
  render(
    <MemoryRouter initialEntries={['/matchups/game-1?player=1630559']}>
      <Routes>
        <Route path="/matchups/:gameId" element={<MatchupDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
  await screen.findByRole('heading', { name: 'Austin Reaves', level: 2 });
  expect(
    screen.getByText(/^LAL @ BOS, .*\. Markets posted by PrizePicks and Underdog\.$/),
  ).toBeVisible();
  const strip = within(screen.getByRole('group', { name: 'Selection log stat' }));
  expect(strip.getByText('MIN, last 10').nextSibling).toHaveTextContent('33.7');
  expect(strip.getByRole('button', { name: 'PTS' })).toHaveTextContent('PPUD');
  expect(strip.getByRole('button', { name: 'PTS' })).toHaveAccessibleDescription(
    'Posted by PrizePicks and Underdog +21.0% Season Matchup Score',
  );
  expect(strip.getByRole('button', { name: 'FG3A' })).toHaveTextContent('PP');
  expect(strip.getByRole('button', { name: 'FG3A' })).not.toHaveTextContent('UD');
  expect(strip.getByRole('button', { name: 'FG3A' })).toHaveAccessibleDescription(
    'Posted by PrizePicks +7.0% Season Matchup Score',
  );
});

test('the strip and the market tabs read in box-score order', async () => {
  render(
    <MemoryRouter initialEntries={['/matchups/game-1?player=2544']}>
      <Routes>
        <Route path="/matchups/:gameId" element={<MatchupDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
  await screen.findByRole('heading', { name: 'LeBron James', level: 2 });
  const tabs = within(screen.getByRole('group', { name: 'Market' }))
    .getAllByRole('button')
    .map((button) => button.textContent);
  expect(tabs).toEqual(['All', 'PTS', 'FGA', 'FG3A']);
  const strip = within(screen.getByRole('group', { name: 'Selection log stat' }))
    .getAllByRole('button')
    .map((button) => button.getAttribute('aria-label'));
  expect(strip).toEqual(['PTS', 'FGA']);
});

test('an upcoming game names its tip time from the schedule', async () => {
  fetchMatchup.mockResolvedValueOnce(
    fetched({
      ...matchup,
      game: {
        ...matchup.game,
        scheduledAt: '2026-01-16T00:30:00.000Z',
        status: 'scheduled',
        statusLabel: 'Scheduled',
      },
    }),
  );
  render(
    <MemoryRouter initialEntries={['/matchups/game-1?player=1630559']}>
      <Routes>
        <Route path="/matchups/:gameId" element={<MatchupDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
  await screen.findByRole('heading', { name: 'Austin Reaves', level: 2 });
  const when = new Date('2026-01-16T00:30:00.000Z');
  const day = when.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  const time = when.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  expect(
    screen.getByText(`LAL @ BOS, ${day}, ${time}. Markets posted by PrizePicks and Underdog.`),
  ).toBeVisible();
});

test('a strip tab picks the stat from the keyboard too', async () => {
  renderMatchup('/matchups/game-1?player=2544');
  await screen.findByRole('heading', { name: 'LeBron James', level: 2 });
  const strip = within(screen.getByRole('group', { name: 'Selection log stat' }));
  strip.getByRole('button', { name: 'FGA' }).focus();
  await userEvent.keyboard('{Enter}');
  expect(strip.getByRole('button', { name: 'FGA' })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByRole('region', { name: 'Matchup Score' })).toHaveTextContent(
    'FGA Matchup Score+4.0%',
  );
});

/*
 * Capture is the reason a Defense Sheet row is worth reading twice: the row is
 * the evidence, and the Target is the filter that evidence implies. These tests
 * work the row action the way a reader does, so what they prove is the prefill,
 * what the reader changed about it, and the sentence a refused save leaves.
 *
 * The stored title is deliberately unlike anything this page could derive, so a
 * confirmation that quietly showed its own preview instead of the record the
 * backend answered with could not pass.
 */
const storedTarget = (overrides = {}) => ({
  id: 4,
  opponent: 'BOS',
  title: 'A title only the backend could have written',
  note: '',
  createdAt: '2026-01-15T12:00:00Z',
  qualifiers: [],
  ...overrides,
});

/*
 * The season behind the capture's draft, as the Lab beneath the dialog's form
 * reads it. Nobody qualifying has faced BOS, so the strip is the only figure.
 */
const capturePreview = {
  target: {
    opponent: 'BOS',
    title: 'BOS vs Transition offense ≥ 9%',
    note: '',
    qualifiers: [
      { base: 'play_types', sliceKey: 'Transition', comparator: 'at_or_above', threshold: 0.09 },
    ],
  },
  proxy: 'Outcomes are box-score proxies; there are no per-game slice splits.',
  statColumns: ['PTS'],
  summary: {
    players: 2,
    games: 4,
    columns: { PTS: { meanDifference: 3.1, overAverageShare: 0.75 } },
  },
  players: [
    {
      canonicalId: 2544,
      name: 'LeBron James',
      tricode: 'LAL',
      shares: [{ share: 0.12, leagueAverageShare: 0.094 }],
      seasonAverages: { PTS: 25.4 },
      games: [{ gameDate: '2026-01-12', stats: { PTS: 31 } }],
    },
  ],
  today: {
    game: {
      gameId: 'game-1',
      scheduledAt: '2026-01-16T00:30:00.000Z',
      status: { state: 'scheduled', label: 'Scheduled' },
      away: { tricode: 'LAL' },
      home: { tricode: 'BOS' },
      opponent: { tricode: 'BOS' },
      opposingTeam: { tricode: 'LAL' },
    },
    fitCount: 3,
  },
};

const openCapture = async (rowLabel) => {
  await screen.findByRole('heading', { name: /^What [A-Z]+ allows$/ });
  const rowAction = screen.getByRole('button', { name: `Save ${rowLabel} as a Target` });
  await userEvent.click(rowAction);
  return { rowAction, dialog: await screen.findByRole('dialog') };
};

const thresholdField = (dialog, index = 1) =>
  within(dialog).getByRole('slider', { name: `Qualifier ${index} threshold percent` });

test('prefills the capture form from the row and saves what the reader made of it', async () => {
  createTarget.mockResolvedValue(storedTarget());
  renderMatchup();

  const { rowAction, dialog } = await openCapture('Transition');
  expect(dialog).toHaveAttribute('aria-modal', 'true');
  // The sheet is BOS's, so BOS is the opponent and it is not up for editing.
  expect(within(dialog).getByLabelText('Opponent')).toBeVisible();
  expect(within(dialog).queryByRole('combobox', { name: 'Opponent' })).not.toBeInTheDocument();
  expect(within(dialog).getByRole('combobox', { name: 'Qualifier 1 diet base' })).toHaveValue(
    'play_types',
  );
  // The row's slice, not its key, which also names the stat the row measures.
  expect(within(dialog).getByRole('combobox', { name: 'Qualifier 1 slice' })).toHaveValue(
    'Transition',
  );
  expect(
    within(dialog).getByRole('button', { name: 'At or above; switch to at or below' }),
  ).toBeVisible();
  // 9.4% league average, offered as the whole percent a reader would type.
  expect(thresholdField(dialog)).toHaveValue('9');

  // Closing hands the keyboard back to the row the capture started from, and
  // Escape closes it as the dialog it is.
  await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
  await waitFor(() => expect(rowAction).toHaveFocus());
  await openCapture('Transition');
  await userEvent.keyboard('{Escape}');
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

  // The same row opened again is a fresh capture. The prefill is a starting
  // point: the threshold is the reader's to move and more Qualifiers can be
  // added before saving.
  const reopened = (await openCapture('Transition')).dialog;
  expect(thresholdField(reopened)).toHaveValue('9');
  fireEvent.change(thresholdField(reopened), { target: { value: '12' } });
  await userEvent.click(within(reopened).getByRole('button', { name: '+ and' }));
  await userEvent.click(within(reopened).getByRole('button', { name: 'a Qualifier' }));
  await userEvent.selectOptions(
    within(reopened).getByRole('combobox', { name: 'Qualifier 2 slice' }),
    'Corner 3',
  );
  fireEvent.change(thresholdField(reopened, 2), { target: { value: '40' } });
  await userEvent.click(within(reopened).getByRole('button', { name: 'Save Target' }));

  expect(createTarget).toHaveBeenCalledWith({
    opponent: 'BOS',
    note: '',
    qualifiers: [
      { base: 'play_types', sliceKey: 'Transition', comparator: 'at_or_above', threshold: 0.12 },
      { base: 'shot_zones', sliceKey: 'Corner 3', comparator: 'at_or_above', threshold: 0.4 },
    ],
  });
  // The saved draft is the record, and opens on its own page: the one the
  // backend stored, by the id it answered with.
  expect(await screen.findByText('One Target')).toBeVisible();
  expect(screen.getByTestId('location')).toHaveTextContent(/^\/targets\/4$/);
});

/*
 * A Target born from a Defense Sheet row is tuned right there: the Lab reads
 * the prefilled draft beneath the dialog's form, against the season the row
 * prompted a look at.
 */
test('the capture dialog reads the prefilled draft live beneath its form', async () => {
  renderMatchup();

  const { dialog } = await openCapture('Transition');
  // The Lab names the default once /seasons says which it is.
  expect(
    await within(dialog).findByText('Lab · Backtest · 2025-26 season to date · vs BOS'),
  ).toBeVisible();
  // The prefill is a complete draft, so it is read without a keystroke.
  const strip = await within(dialog).findByRole(
    'list',
    { name: 'Backtest summary' },
    { timeout: 3000 },
  );
  expect(fetchTargetPreview).toHaveBeenCalledWith(
    expect.objectContaining({
      opponent: 'BOS',
      qualifiers: [
        { base: 'play_types', sliceKey: 'Transition', comparator: 'at_or_above', threshold: 0.09 },
      ],
    }),
  );
  expect(within(strip).getByRole('listitem', { name: 'Player-games' })).toHaveTextContent('1');
  expect(within(strip).getByRole('listitem', { name: 'PTS' })).toHaveTextContent('+5.6');
  expect(within(dialog).getByText(/fit tonight/)).toHaveTextContent('3 fit tonight vs BOS');
  expect(
    within(dialog).getByRole('list', { name: '1 games, oldest to newest, graded by PTS margin' }),
  ).toBeVisible();
});

/*
 * The capture's Lab reads the season this Matchup reads: a 2025-26 game's
 * Matchup reads 2025-26 even while 2026-27 is offered, so its capture does
 * too (crf04/statsplus#446).
 */
test.each([
  ['0022500584', '2025-26', '2025-26'],
  ['0022600003', '2026-27', '2026-27 season to date'],
])("a capture from game %s reads the Matchup's %s", async (gameId, season, label) => {
  fetchSeasons.mockResolvedValue(unpublishedSeasons);
  fetchTargetPreview.mockImplementation(async (request) => ({
    ...capturePreview,
    season: request.season,
    seasonReason: 'requested',
    publishedSeason: '2025-26',
  }));
  renderMatchup(`/matchups/${gameId}`);

  const { dialog } = await openCapture('Transition');
  await within(dialog).findByRole('list', { name: 'Backtest summary' }, { timeout: 3000 });
  expect(fetchTargetPreview.mock.calls.map(([request]) => request.season)).toStrictEqual([season]);
  await waitFor(() =>
    expect(within(dialog).getByText(`Lab · Backtest · ${label} · vs BOS`)).toBeVisible(),
  );
  expect(fetchMatchup.mock.calls.map(([, options]) => options.season)).toStrictEqual([
    season === '2026-27' ? season : undefined,
  ]);
});

/*
 * After the cutover a 2025-26 game's Matchup reads the Published Season,
 * 2026-27, unless the reader picks 2025-26; its capture names the same one.
 */
test.each([
  ['', '2026-27', null],
  ['?season=2025-26', '2025-26', { selectedSeason: '2025-26', publishedSeason: '2026-27' }],
])('after the cutover a capture from %s names the Matchup’s %s', async (query, season, context) => {
  fetchSeasons.mockResolvedValue({
    seasons: ['2026-27', '2025-26'],
    defaultSeason: '2026-27',
    choices: [
      { season: '2026-27', mode: 'published', families: {}, teamGames: null },
      { season: '2025-26', mode: 'retained', families: {}, teamGames: null },
    ],
  });
  fetchMatchup.mockResolvedValue(
    fetched({ ...matchup, asOfSeason: '2026-27', seasonContext: context }),
  );
  fetchTargetPreview.mockImplementation(async (request) => ({
    ...capturePreview,
    season: request.season,
    seasonReason: 'requested',
    publishedSeason: '2026-27',
  }));
  renderMatchup(`/matchups/0022500584${query}`);

  const { dialog } = await openCapture('Transition');
  await within(dialog).findByRole('list', { name: 'Backtest summary' }, { timeout: 3000 });
  expect(fetchTargetPreview.mock.calls.map(([request]) => request.season)).toStrictEqual([season]);
});

/*
 * A capture's pick of a retained season reads that season, named as is,
 * whether the Matchup's season was linked or read by default.
 */
test.each([
  ['', 'default'],
  ['?season=2026-27', 'linked'],
])('a capture from %s (%s) reads a picked 2024-25', async (query) => {
  fetchSeasons.mockResolvedValue(unpublishedSeasons);
  fetchMatchup.mockResolvedValue(
    fetched({
      ...matchup,
      asOfSeason: '2026-27',
      seasonContext: { selectedSeason: '2026-27', publishedSeason: '2025-26' },
    }),
  );
  fetchTargetPreview.mockImplementation(async (request) => ({
    ...capturePreview,
    season: request.season,
    seasonReason: 'requested',
    publishedSeason: '2025-26',
  }));
  renderMatchup(`/matchups/0022600003${query}`);

  const { dialog } = await openCapture('Transition');
  await within(dialog).findByRole('list', { name: 'Backtest summary' }, { timeout: 3000 });
  await userEvent.click(within(dialog).getByRole('button', { name: '2024-25' }));
  await waitFor(() =>
    expect(fetchTargetPreview.mock.calls.map(([request]) => request.season)).toStrictEqual([
      '2026-27',
      '2024-25',
    ]),
  );
  expect(
    await within(dialog).findByText('Lab · Backtest · 2024-25 season · vs BOS'),
  ).toBeInTheDocument();
  expect(within(dialog).getByRole('button', { name: '2024-25' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  expect(screen.getByTestId('location')).toHaveTextContent(`/matchups/0022600003${query}`);
});

/*
 * A capture's refused 2026-27 Backtest: read by default, as an unlinked
 * Matchup reads it, it falls back to the backend's default and says so;
 * linked, it is refused plainly, and its way back reads 2025-26 in the dialog
 * while the Matchup keeps its link (crf04/statsplus#446).
 */
const refuseCapture2627 = () =>
  fetchTargetPreview.mockImplementation(async ({ season }) => {
    if (season === '2026-27')
      throw Object.assign(new Error('Season unavailable'), {
        response: {
          status: 503,
          data: {
            error: {
              code: 'season_unavailable',
              message: 'Unavailable.',
              details: {
                season: '2026-27',
                published_season: '2025-26',
                stream: 'player_game_logs',
              },
            },
          },
        },
      });
    return { ...capturePreview, season: '2025-26', publishedSeason: '2025-26' };
  });
const capturePreviewSeasons = () =>
  fetchTargetPreview.mock.calls.map(([request]) => request.season);

test('a refused 2026-27 capture from an unlinked Matchup reads 2025-26 and says so', async () => {
  fetchSeasons.mockResolvedValue(unpublishedSeasons);
  fetchMatchup.mockResolvedValue(
    fetched({
      ...matchup,
      asOfSeason: '2025-26',
      seasonContext: { selectedSeason: '2026-27', publishedSeason: '2025-26' },
    }),
  );
  refuseCapture2627();
  renderMatchup('/matchups/0022600003');

  const { dialog } = await openCapture('Transition');
  await within(dialog).findByRole('list', { name: 'Backtest summary' }, { timeout: 3000 });
  expect(capturePreviewSeasons()).toStrictEqual(['2026-27', undefined]);
  expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument();
  expect(
    within(dialog).getByText('2026-27 isn’t offered, so this is 2025-26 evidence.'),
  ).toBeVisible();
  expect(
    await within(dialog).findByText('Lab · Backtest · 2025-26 season to date · vs BOS'),
  ).toBeInTheDocument();
});

test('a refused 2026-27 capture from a linked Matchup shows 2025-26 on request', async () => {
  fetchSeasons.mockResolvedValue(unpublishedSeasons);
  fetchMatchup.mockResolvedValue(
    fetched({
      ...matchup,
      asOfSeason: '2026-27',
      seasonContext: { selectedSeason: '2026-27', publishedSeason: '2025-26' },
    }),
  );
  refuseCapture2627();
  renderMatchup('/matchups/0022600003?season=2026-27');

  const { dialog } = await openCapture('Transition');
  const alert = await within(dialog).findByRole('alert', {}, { timeout: 3000 });
  expect(alert.textContent).toBe(
    "2026-27 isn't available yet. CourtAI still reads 2025-26 by default.Show 2025-26",
  );
  expect(capturePreviewSeasons()).toStrictEqual(['2026-27']);

  await userEvent.click(within(dialog).getByRole('button', { name: 'Show 2025-26' }));
  await within(dialog).findByRole('list', { name: 'Backtest summary' }, { timeout: 3000 });
  expect(capturePreviewSeasons()).toStrictEqual(['2026-27', '2025-26']);
  expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument();
  expect(
    await within(dialog).findByText('Lab · Backtest · 2025-26 season to date · vs BOS'),
  ).toBeInTheDocument();
  expect(screen.getByTestId('location')).toHaveTextContent('/matchups/0022600003?season=2026-27');
  expect(fetchMatchup.mock.calls.map(([, options]) => options.season)).toStrictEqual(['2026-27']);
});

test('captures against whichever team’s sheet is open', async () => {
  createTarget.mockResolvedValue(storedTarget({ opponent: 'LAL' }));
  renderMatchup();

  await screen.findByRole('heading', { name: 'What BOS allows' });
  await userEvent.click(screen.getByRole('button', { name: /^LAL defense/ }));
  await screen.findByRole('heading', { name: 'What LAL allows' });

  const { dialog } = await openCapture('Corner 3s');
  expect(within(dialog).getByLabelText('Opponent')).toBeVisible();
  expect(within(dialog).getByRole('combobox', { name: 'Qualifier 1 slice' })).toHaveValue(
    'Corner 3',
  );
  // 12.8%, read off a diet fact the display gate keeps off the sheet, offered
  // as the whole percent the reader is meant to argue with.
  expect(thresholdField(dialog)).toHaveValue('13');

  await userEvent.click(within(dialog).getByRole('button', { name: 'Save Target' }));
  expect(createTarget).toHaveBeenCalledWith({
    opponent: 'LAL',
    note: '',
    qualifiers: [
      { base: 'shot_zones', sliceKey: 'Corner 3', comparator: 'at_or_above', threshold: 0.13 },
    ],
  });
});

test('leaves the threshold to be typed when the slice publishes no league average', async () => {
  renderMatchup();

  await screen.findByRole('heading', { name: 'What BOS allows' });
  // Attempts-only, so it reads on All rather than the opening PTS tab.
  await userEvent.click(screen.getByRole('button', { name: 'All' }));
  const { dialog } = await openCapture('Above-the-break 3s');
  expect(thresholdField(dialog)).toHaveValue('0');
  expect(thresholdField(dialog)).toHaveAttribute('aria-valuetext', 'Choose a threshold');
  expect(within(dialog).getByRole('button', { name: 'Save Target' })).toBeDisabled();
  expect(
    within(dialog).getByText('Every threshold must be a share between 0% and 100%.'),
  ).toBeVisible();

  fireEvent.change(thresholdField(dialog), { target: { value: '32' } });
  expect(within(dialog).getByRole('button', { name: 'Save Target' })).toBeEnabled();
});

test('a save in flight cannot be sent twice', async () => {
  let settle;
  createTarget.mockReturnValue(
    new Promise((resolve) => {
      settle = () => resolve(storedTarget());
    }),
  );
  renderMatchup();

  const { dialog } = await openCapture('Transition');
  await userEvent.click(within(dialog).getByRole('button', { name: 'Save Target' }));
  expect(within(dialog).getByRole('button', { name: 'Save Target' })).toBeDisabled();
  expect(createTarget).toHaveBeenCalledTimes(1);

  await act(async () => settle());
  expect(await screen.findByText('One Target')).toBeVisible();
});

/*
 * A save answered after the dialog was dismissed is nobody's any more. Acting
 * on it would open a Target the reader had moved on from, over whatever they
 * were composing next.
 */
test('a save that resolves after the dialog was dismissed does not navigate', async () => {
  let settle;
  createTarget.mockReturnValue(
    new Promise((resolve) => {
      settle = () => resolve(storedTarget());
    }),
  );
  renderMatchup();

  const { dialog } = await openCapture('Transition');
  await userEvent.click(within(dialog).getByRole('button', { name: 'Save Target' }));
  await userEvent.keyboard('{Escape}');
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

  // Another row, another draft, before the first save answers.
  await userEvent.click(screen.getByRole('button', { name: 'All' }));
  const next = (await openCapture('Above-the-break 3s')).dialog;
  fireEvent.change(thresholdField(next), { target: { value: '32' } });
  await act(async () => settle());

  expect(screen.getByTestId('location')).toHaveTextContent(/^\/matchups\/game-1\?stat=All$/);
  expect(screen.queryByText('One Target')).not.toBeInTheDocument();
  expect(screen.getByRole('dialog')).toBeVisible();
  expect(thresholdField(screen.getByRole('dialog'))).toHaveValue('32');
  expect(
    within(screen.getByRole('dialog')).getByRole('button', { name: 'Save Target' }),
  ).toBeEnabled();
});

test('a duplicate Target keeps the composed draft and says why it was refused', async () => {
  createTarget.mockRejectedValue({
    response: { data: { error: { message: 'You already have that Target for BOS.' } } },
  });
  renderMatchup();

  const { dialog } = await openCapture('Transition');
  await userEvent.click(within(dialog).getByRole('button', { name: 'Save Target' }));

  // An untouched prefill is posted as the league average it was read from.
  expect(createTarget).toHaveBeenCalledWith({
    opponent: 'BOS',
    note: '',
    qualifiers: [
      { base: 'play_types', sliceKey: 'Transition', comparator: 'at_or_above', threshold: 0.09 },
    ],
  });
  expect(await within(dialog).findByRole('alert')).toHaveTextContent(
    'You already have that Target for BOS.',
  );
  expect(thresholdField(dialog)).toHaveValue('9');
});

test('offers no capture on a Traditional row, which has no diet counterpart', async () => {
  renderMatchup();

  await screen.findByRole('heading', { name: 'What BOS allows' });
  await userEvent.click(screen.getByRole('button', { name: 'All' }));
  expect(sheetRow('Turnovers forced')).toBeVisible();
  expect(within(sheetRow('Turnovers forced')).queryByRole('button')).not.toBeInTheDocument();
  expect(within(sheetRow('Transition')).getByRole('button')).toHaveAccessibleName(
    'Save Transition as a Target',
  );
});

// Opponent transport is exercised in its own API/hook tests.
jest.mock('../targets/opponentContextApi', () => ({
  ...jest.requireActual('../targets/opponentContextApi'),
  fetchOpponentProfile: () => new Promise(() => {}),
}));

/*
 * crf04/statsplus#179 acceptance criteria, one test each, read the way a
 * reader reads the page.
 */
const atInstant = (iso) => jest.spyOn(Date, 'now').mockReturnValue(Date.parse(iso));
afterEach(() => jest.restoreAllMocks());

test('AC1: a finished game says when, what the sheet is built on and what is missing in one sentence', async () => {
  const candidate = historicalMatchup();
  candidate.game = { ...candidate.game, status: 'final', statusLabel: 'Final' };
  fetchMatchup.mockResolvedValueOnce(fetched(candidate));
  renderMatchup();

  const summary = await screen.findByRole('region', { name: 'Matchup summary' });
  expect(screen.getByText('Matchup')).toHaveClass('matchup-eyebrow');
  expect(normalized(summary)).toBe(
    'Fri, Jan 16, 2026 · Final. Full-season defense ranks; no Last 15 or injury report.',
  );
});

test('AC1: an upcoming game names its tip-off and the books and time its lines were read', async () => {
  atInstant('2026-01-15T12:00:00Z');
  const candidate = JSON.parse(JSON.stringify(matchup));
  // The pool names the books it read, whatever the players' provenance lists.
  candidate.freshness.pool.providers = [
    { name: 'underdog', status: 'fresh', retrievedAt: '2026-01-15T11:50:00Z' },
    { name: 'draftkings', status: 'fresh', retrievedAt: '2026-01-15T11:50:00Z' },
  ];
  fetchMatchup.mockResolvedValueOnce(fetched(candidate));
  renderMatchup();

  const summary = await screen.findByRole('region', { name: 'Matchup summary' });
  expect(normalized(summary)).toBe(
    'Fri, Jan 16, 2026 · Tip-off 9:30 AM. Lines from Underdog and DraftKings.',
  );
  expect(summary.querySelector('.matchup-warning')).toBeNull();
});

test('AC1: a live header names only the books with lines and leaves other gaps unsaid', async () => {
  atInstant('2026-01-15T12:00:00Z');
  const candidate = JSON.parse(JSON.stringify(matchup));
  candidate.injuries = { ...candidate.injuries, status: 'unavailable', teams: [] };
  candidate.injuries.unavailableReason = 'permission_required';
  candidate.freshness.injuries = { status: 'unavailable', retrievedAt: null };
  candidate.freshness.stats = { status: 'stale', retrievedAt: '2026-01-13T10:00:00Z' };
  candidate.freshness.pool = {
    status: 'partial',
    retrievedAt: '2026-01-15T11:54:00Z',
    providers: [
      { name: 'underdog', status: 'fresh', retrievedAt: '2026-01-15T11:54:00Z' },
      { name: 'novig', status: 'missing', retrievedAt: null },
      { name: 'kalshi', status: 'fresh', retrievedAt: '2026-01-15T11:54:00Z' },
    ],
  };
  fetchMatchup.mockResolvedValueOnce(fetched(candidate));
  renderMatchup();

  const summary = await screen.findByRole('region', { name: 'Matchup summary' });
  expect(normalized(summary)).toBe(
    'Fri, Jan 16, 2026 · Tip-off 9:30 AM. Lines from Underdog and Kalshi.',
  );
  expect(summary.querySelector('.matchup-warning')).toBeNull();
});

test('AC1: the live header warns once, in the warning colour, when its lines are stale', async () => {
  atInstant('2026-01-15T12:30:00Z');
  const candidate = JSON.parse(JSON.stringify(matchup));
  candidate.injuries = { ...candidate.injuries, status: 'unavailable', teams: [] };
  candidate.injuries.unavailableReason = 'permission_required';
  candidate.freshness.injuries = { status: 'unavailable', retrievedAt: null };
  fetchMatchup.mockResolvedValueOnce(fetched(candidate));
  renderMatchup();

  const summary = await screen.findByRole('region', { name: 'Matchup summary' });
  expect(normalized(summary)).toBe(
    'Fri, Jan 16, 2026 · Tip-off 9:30 AM. Lines from PrizePicks and Underdog.' +
      ' Lines last read 40m ago.',
  );
  expect(within(summary).getByText('Lines last read 40m ago.')).toHaveClass('matchup-warning');
  // AC2: the unavailable report has no box of its own.
  expect(screen.queryByRole('heading', { name: 'Injury Report' })).not.toBeInTheDocument();
});

test('AC1: the live header holds a prizepicks line to a 90m bar and every other provider to 15m', async () => {
  atInstant('2026-01-15T12:30:00Z');
  const candidate = JSON.parse(JSON.stringify(matchup));
  // PrizePicks was read 40 minutes ago and is fresh through 90; Underdog, read 19 minutes ago, is past its 15.
  candidate.freshness.pool.providers = [
    { name: 'prizepicks', status: 'fresh', retrievedAt: '2026-01-15T11:50:00Z' },
    { name: 'underdog', status: 'fresh', retrievedAt: '2026-01-15T12:11:00Z' },
  ];
  fetchMatchup.mockResolvedValueOnce(fetched(candidate));
  renderMatchup();

  const summary = await screen.findByRole('region', { name: 'Matchup summary' });
  // The warning names Underdog's age, not the older PrizePicks line's.
  expect(normalized(summary)).toBe(
    'Fri, Jan 16, 2026 · Tip-off 9:30 AM. Lines from PrizePicks and Underdog.' +
      ' Lines last read 19m ago.',
  );
});

test('AC1: the live header calls a prizepicks line stale once it is older than 90m', async () => {
  atInstant('2026-01-15T13:21:00Z');
  const candidate = JSON.parse(JSON.stringify(matchup));
  candidate.freshness.pool.providers = [
    { name: 'prizepicks', status: 'fresh', retrievedAt: '2026-01-15T11:50:00Z' },
    { name: 'underdog', status: 'fresh', retrievedAt: '2026-01-15T13:15:00Z' },
  ];
  fetchMatchup.mockResolvedValueOnce(fetched(candidate));
  renderMatchup();

  const summary = await screen.findByRole('region', { name: 'Matchup summary' });
  expect(within(summary).getByText('Lines last read 2h ago.')).toHaveClass('matchup-warning');
});

test('AC1: the live header holds a pool that only prizepicks has read to its 90m bar', async () => {
  atInstant('2026-01-15T12:30:00Z');
  const candidate = JSON.parse(JSON.stringify(matchup));
  // PrizePicks alone, read 40 minutes ago.
  candidate.freshness.pool.providers = [
    { name: 'prizepicks', status: 'fresh', retrievedAt: '2026-01-15T11:50:00Z' },
  ];
  fetchMatchup.mockResolvedValueOnce(fetched(candidate));
  renderMatchup();

  const summary = await screen.findByRole('region', { name: 'Matchup summary' });
  expect(normalized(summary)).toBe('Fri, Jan 16, 2026 · Tip-off 9:30 AM. Lines from PrizePicks.');
  expect(summary.querySelector('.matchup-warning')).toBeNull();
});

test('AC1: the live header calls a pool that only prizepicks has read stale once it is older than 90m', async () => {
  atInstant('2026-01-15T13:21:00Z');
  const candidate = JSON.parse(JSON.stringify(matchup));
  candidate.freshness.pool.providers = [
    { name: 'prizepicks', status: 'fresh', retrievedAt: '2026-01-15T11:50:00Z' },
  ];
  fetchMatchup.mockResolvedValueOnce(fetched(candidate));
  renderMatchup();

  const summary = await screen.findByRole('region', { name: 'Matchup summary' });
  expect(normalized(summary)).toBe(
    'Fri, Jan 16, 2026 · Tip-off 9:30 AM. Lines from PrizePicks. Lines last read 2h ago.',
  );
  expect(within(summary).getByText('Lines last read 2h ago.')).toHaveClass('matchup-warning');
});

test('a closing pool shows its closing lines with a neutral note, however old', async () => {
  atInstant('2026-01-16T02:00:00Z');
  const candidate = JSON.parse(JSON.stringify(matchup));
  candidate.freshness.pool = {
    status: 'closing',
    retrievedAt: '2026-01-15T11:50:00Z',
    providers: [
      { name: 'underdog', status: 'closing', retrievedAt: '2026-01-15T11:50:00Z' },
      { name: 'prizepicks', status: 'missing', retrievedAt: null },
    ],
  };
  fetchMatchup.mockResolvedValueOnce(fetched(candidate));
  renderMatchup();

  const summary = await screen.findByRole('region', { name: 'Matchup summary' });
  expect(normalized(summary)).toBe(
    'Fri, Jan 16, 2026 · Tip-off 9:30 AM. Lines from Underdog.' +
      ' Lines closed at tip; showing closing lines.',
  );
  expect(summary.querySelector('.matchup-warning')).toBeNull();
});

test('AC2: provenance lines, the window note, the instruction and the injury box are gone', async () => {
  fetchMatchup.mockResolvedValueOnce(fetched(historicalMatchup()));
  renderMatchup();

  await screen.findByRole('heading', { name: 'What BOS allows' });
  expect(screen.queryByText(/provenance/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/Completed-season context/)).not.toBeInTheDocument();
  expect(screen.queryByText(/Tap a player/)).not.toBeInTheDocument();
  expect(
    screen.queryByText('No pregame injury snapshot was archived for this game.'),
  ).not.toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: /Injur/ })).not.toBeInTheDocument();
  const last15 = screen.getByRole('button', { name: 'Last 15' });
  expect(last15).toBeDisabled();
  expect(last15).toHaveAttribute('title', 'No point-in-time snapshot was captured for this game.');
  expect(
    screen.queryByText('No point-in-time snapshot was captured for this game.'),
  ).not.toBeInTheDocument();
});

test('AC3: the page opens on PTS, and on All the rail still reads points', async () => {
  renderMatchup();

  await screen.findByRole('heading', { name: 'What BOS allows' });
  const tabs = within(screen.getByRole('group', { name: 'Market' }));
  expect(tabs.getByRole('button', { name: 'PTS' })).toHaveAttribute('aria-pressed', 'true');
  await userEvent.click(tabs.getByRole('button', { name: 'All' }));
  const rail = screen.getByRole('complementary', { name: 'Targetable players' });
  expect(within(rail).getByRole('heading', { level: 2 })).toHaveTextContent('LAL · PTS');
  expect(screen.getByRole('article', { name: 'LeBron James player' })).toHaveTextContent('27.5');
  expect(screen.getByRole('article', { name: 'Austin Reaves player' })).toHaveTextContent('21.5');
});

test('AC3: the page opens on All when the other side has no points', async () => {
  const candidate = JSON.parse(JSON.stringify(matchup));
  candidate.players
    .filter((player) => player.teamId === 1)
    .forEach((player) => {
      player.statCategories = player.statCategories.filter((stat) => stat !== 'PTS');
      delete player.scores.PTS;
    });
  fetchMatchup.mockResolvedValueOnce(fetched(candidate));
  renderMatchup();

  await screen.findByRole('heading', { name: 'What BOS allows' });
  expect(
    within(screen.getByRole('group', { name: 'Market' })).getByRole('button', { name: 'All' }),
  ).toHaveAttribute('aria-pressed', 'true');
});

test('AC4: after the game each row shows minutes and what he did, against his average for PTS', async () => {
  const candidate = historicalMatchup();
  candidate.players.find((player) => player.id === 1630559).focalGameLine.stats.PTS = 24;
  fetchMatchup.mockResolvedValueOnce(fetched(candidate));
  renderMatchup();

  const austin = await screen.findByRole('article', { name: 'Austin Reaves player' });
  const lebron = screen.getByRole('article', { name: 'LeBron James player' });
  expect(within(austin).getByText('30 min', { exact: false })).toBeVisible();
  expect(within(austin).getByText('24')).toBeVisible();
  expect(within(austin).getByText(/\+3\.9 vs his season average/)).toHaveClass('tone-up');
  expect(within(lebron).getByText('31 min', { exact: false })).toBeVisible();
  expect(within(lebron).getByText('10')).toBeVisible();
  expect(within(lebron).getByText(/−15\.4 vs his season average/)).toHaveClass('tone-down');

  // Another stat: his number in it, with no season-average comparison.
  await userEvent.click(screen.getByRole('button', { name: 'FGA' }));
  const fga = screen.getByRole('article', { name: 'LeBron James player' });
  expect(within(fga).getByText('11')).toBeVisible();
  expect(fga).not.toHaveTextContent('season average');
});

test('AC5: before the game the row shows his line and season average; the books stay in his card', async () => {
  const candidate = JSON.parse(JSON.stringify(matchup));
  // Whatever order the books arrive in, PrizePicks' line leads.
  const lebronFixture = candidate.players.find((player) => player.id === 2544);
  lebronFixture.provenance = { underdog: ['PTS'], prizepicks: ['PTS', 'FGA'] };
  lebronFixture.lines = { underdog: { PTS: 26.5 }, prizepicks: { PTS: 27.5 } };
  fetchMatchup.mockResolvedValueOnce(fetched(candidate));
  renderMatchup();

  const lebron = await screen.findByRole('article', { name: 'LeBron James player' });
  expect(within(lebron).getByText('27.5')).toBeVisible();
  expect(within(lebron).getByText('25.4 avg')).toBeVisible();
  // No minutes, no per-book marks and no disagreement flag in the row.
  expect(lebron).not.toHaveTextContent('min last 10');
  expect(lebron).not.toHaveTextContent(/PP|UD/);
  expect(within(lebron).queryByText('Lines disagree')).not.toBeInTheDocument();

  // PrizePicks posts Austin without a number, so Underdog's line leads.
  const austin = screen.getByRole('article', { name: 'Austin Reaves player' });
  expect(within(austin).getByText('21.5')).toBeVisible();
  expect(within(austin).getByText('20.1 avg')).toBeVisible();
  // The live rail keeps its injury badges.
  expect(within(austin).getByText('Game-time decision')).toHaveClass('injury-badge');
});

describe('#212, statsplus#338: the rail leads with the line most sources post', () => {
  const headlineFor = async (provenance, lines, bookLines = {}) => {
    const candidate = JSON.parse(JSON.stringify(matchup));
    const lebron = candidate.players.find((player) => player.id === 2544);
    lebron.provenance = provenance;
    lebron.lines = lines;
    lebron.bookLines = bookLines;
    fetchMatchup.mockResolvedValueOnce(fetched(candidate));
    renderMatchup();
    const row = await screen.findByRole('article', { name: 'LeBron James player' });
    return row.querySelector('.rail-row-value b').textContent;
  };

  test('a market line outranks a DFS book that disagrees', async () => {
    expect(
      await headlineFor(
        { dabble: ['PTS'], polymarket: ['PTS'] },
        { dabble: { PTS: 6.5 }, polymarket: { PTS: 7.5 } },
      ),
    ).toBe('7.5');
  });

  test('only DFS books: PrizePicks leads', async () => {
    expect(
      await headlineFor(
        { dabble: ['PTS'], prizepicks: ['PTS'] },
        { dabble: { PTS: 26.5 }, prizepicks: { PTS: 27.5 } },
      ),
    ).toBe('27.5');
  });

  test('two markets that disagree: Polymarket leads', async () => {
    expect(
      await headlineFor(
        { kalshi: ['PTS'], novig: ['PTS'], polymarket: ['PTS'] },
        { kalshi: { PTS: 8 }, novig: { PTS: 7 }, polymarket: { PTS: 7.5 } },
      ),
    ).toBe('7.5');
  });

  test('a market line outranks PrizePicks and Novig outranks Kalshi', async () => {
    expect(
      await headlineFor(
        { prizepicks: ['PTS'], kalshi: ['PTS'], novig: ['PTS'] },
        { prizepicks: { PTS: 9.5 }, kalshi: { PTS: 8.5 }, novig: { PTS: 8 } },
      ),
    ).toBe('8');
  });

  // statsplus#338: Duncan Robinson PTS, DET @ NYK, 2026-10-27.
  test('a Polymarket rung most sources do not post never leads', async () => {
    expect(
      await headlineFor(
        { underdog: ['PTS'], dabble: ['PTS'], polymarket: ['PTS'], novig: ['PTS'] },
        {
          underdog: { PTS: 12.5 },
          dabble: { PTS: 11.5 },
          polymarket: { PTS: 9.5 },
          novig: { PTS: 12.5 },
        },
        {
          PTS: quote([
            bookRow('betmgm', 11.5, -115, -115),
            bookRow('betrivers', 11.5, -134, -103),
            bookRow('draftkings', 12.5, 101, -128),
            bookRow('fanduel', 12.5, -108, -122),
          ]),
        },
      ),
    ).toBe('12.5');
  });

  test('the sportsbooks count toward the consensus', async () => {
    expect(
      await headlineFor(
        { polymarket: ['PTS'], underdog: ['PTS'] },
        { polymarket: { PTS: 29.5 }, underdog: { PTS: 21.5 } },
        { PTS: quote([bookRow('draftkings', 21.5, -110, -110)]) },
      ),
    ).toBe('21.5');
  });

  test('a line only the sportsbooks post leads', async () => {
    expect(await headlineFor({}, {}, { PTS: quote([bookRow('fanduel', 18.5, -110, -110)]) })).toBe(
      '18.5',
    );
  });

  test('a market that posts without a number does not lead', async () => {
    expect(
      await headlineFor({ polymarket: ['PTS'], dabble: ['PTS'] }, { dabble: { PTS: 6.5 } }),
    ).toBe('6.5');
  });
});

test('AC6, statsplus#395 AC3: with no line the row leads with his season average, never a made-up line', async () => {
  const candidate = JSON.parse(JSON.stringify(matchup));
  const austin = candidate.players.find((player) => player.id === 1630559);
  austin.scores.FG3A = score(-0.06, 0.02);
  austin.seasonAverages = { PTS: 20.1, FG3A: 6.2 };
  const lebron = candidate.players.find((player) => player.id === 2544);
  lebron.scores.FGA.last15 = { components: {}, blend: null, missingInputs: [] };
  fetchMatchup.mockResolvedValueOnce(fetched(candidate));
  renderMatchup();

  await screen.findByRole('heading', { name: 'What BOS allows' });
  await userEvent.click(screen.getByRole('button', { name: 'FG3A' }));
  const austinRow = screen.getByRole('article', { name: 'Austin Reaves player' });
  expect(austinRow.querySelector('.rail-row-value')).toHaveTextContent(/^6\.2season avg$/);
  expect(within(austinRow).getByRole('img', { name: 'Matchup Score -6%' })).toHaveClass(
    'tone-down',
  );

  // A backend without season averages has none for FGA: no line, no average.
  await userEvent.click(screen.getByRole('button', { name: 'FGA' }));
  const lebronRow = screen.getByRole('article', { name: 'LeBron James player' });
  expect(lebronRow.querySelector('.rail-row-value')).toHaveTextContent(/^—$/);
  expect(within(lebronRow).getByRole('img', { name: 'Matchup Score +4%' })).toHaveTextContent(
    '+4%',
  );
  expect(lebronRow).not.toHaveTextContent('Matchup Score');

  // No computable score either: the badge says so rather than inventing one.
  await userEvent.click(screen.getByRole('button', { name: 'Last 15' }));
  const empty = screen.getByRole('article', { name: 'LeBron James player' });
  expect(within(empty).getByRole('img', { name: 'Matchup Score unavailable' })).toHaveTextContent(
    '—',
  );
  expect(empty).not.toHaveTextContent('%');
});

test('AC7: rows sort by season scoring, open the selection card and hand focus back on close', async () => {
  renderMatchup();

  await screen.findByRole('heading', { name: 'What BOS allows' });
  expect(railNames()).toEqual(['LeBron James', 'Austin Reaves']);
  const austin = screen.getByRole('article', { name: 'Austin Reaves player' });
  expect(within(austin).getByRole('link', { name: 'Austin Reaves game logs' })).toHaveAttribute(
    'href',
    '/?player_name=Austin+Reaves&season_filter=2025-26',
  );
  const open = within(austin).getByRole('button', { name: 'Open selection card' });
  await userEvent.click(open);
  expect(await screen.findByRole('heading', { name: 'Austin Reaves', level: 2 })).toBeVisible();
  expect(within(austin).getByRole('button', { name: 'Selected' })).toHaveAttribute(
    'aria-expanded',
    'true',
  );
  await userEvent.click(screen.getByRole('button', { name: 'Close selection card' }));
  await waitFor(() =>
    expect(within(austin).getByRole('button', { name: 'Open selection card' })).toHaveFocus(),
  );
});

// A BOS sheet with every category, for the sheet's layout criteria.
const fullSheet = () => {
  const candidate = JSON.parse(JSON.stringify(matchup));
  const row = (key, sliceKey, markets, season) => ({
    key,
    sliceKey,
    label: key,
    markets,
    season,
    last15: season,
  });
  candidate.teams.find((team) => team.tricode === 'BOS').defenseSheet = {
    playTypes: [
      row('Transition:PTS', 'Transition', ['PTS', 'PA', 'PR', 'PRA'], value(18.4, 12.34, 1.4, 27)),
      row('OffRebound:PTS', 'OffRebound', ['PTS', 'PA', 'PR', 'PRA'], value(5.1, 20, 1.6, 29)),
      row('OffRebound:POSS', 'OffRebound', ['PTS'], value(4.4, 31, 1.7, 30)),
    ],
    shotTypes: [
      row('Less Than 10 ft:FG2A', 'Less Than 10 ft', ['FGA', 'FG2A'], value(30, 4, 1.1, 20)),
      row('Less Than 10 ft:FG2M', 'Less Than 10 ft', ['PTS'], value(16, 6, 1.2, 21)),
      row('Catch and Shoot:FG3A', 'Catch and Shoot', ['FGA', 'FG3A'], value(17, 9, 1.1, 23)),
      row('Catch and Shoot:FG3M', 'Catch and Shoot', ['3PM', 'PTS'], value(6, 3, 1.0, 19)),
    ],
    shotZones: [
      row('Restricted Area:FGA', 'Restricted Area', ['FGA', 'FG2A'], value(23, -10, -1.2, 7)),
      row('Restricted Area:FGM', 'Restricted Area', ['PTS'], value(15, 5, 1.1, 22)),
      row('Corner 3:FGA', 'Corner 3', ['FGA', 'FG3A'], value(9, 30, 2.1, 30)),
      row('Corner 3:FGM', 'Corner 3', ['PTS', '3PM'], value(3.4, 1, 1.0, 17)),
    ],
    assistLocations: [
      row('Arc3Assists', 'Arc3Assists', ['AST', 'PA', 'RA', 'PRA'], value(8, -11, -1.3, 3)),
    ],
    traditional: [row('OPP_REB', 'OPP_REB', ['REB', 'PR', 'RA', 'PRA'], value(45, 7, 1.2, 24))],
  };
  return candidate;
};

const regionNames = () =>
  within(sheetRegion())
    .getAllByRole('region')
    .map((region) => region.getAttribute('aria-labelledby'))
    .map((id) => document.getElementById(id).textContent);

test('AC8: the sheet is headed by what the team allows and how to read it', async () => {
  renderMatchup();

  const heading = await screen.findByRole('heading', { name: 'What BOS allows' });
  expect(heading.closest('header').querySelector('p')).toHaveTextContent(
    'Compared with the league average, softest spots first. 1 close to average hidden.',
  );
});

test('AC9: each category is a label with one header row naming its columns', async () => {
  fetchMatchup.mockResolvedValueOnce(fetched(fullSheet()));
  renderMatchup();

  await screen.findByRole('heading', { name: 'What BOS allows' });
  await userEvent.click(screen.getByRole('button', { name: 'All' }));
  expect(regionNames()).toEqual([
    'Play types',
    'Shot types',
    'Shot zones',
    'Assists by location',
    'Box score',
  ]);
  const columns = (name) =>
    within(screen.getByRole('region', { name }))
      .getAllByText(/^(Points|Attempts|Makes|Allowed)$/)
      .map((column) => column.textContent);
  expect(columns('Play types')).toEqual(['Points']);
  expect(columns('Shot types')).toEqual(['Attempts', 'Makes']);
  expect(columns('Shot zones')).toEqual(['Attempts', 'Makes']);
  expect(columns('Assists by location')).toEqual(['Allowed']);
  expect(columns('Box score')).toEqual(['Allowed']);
});

test('AC10: one row per slice with its measures side by side, shot types split into 2s and 3s', async () => {
  fetchMatchup.mockResolvedValueOnce(fetched(fullSheet()));
  renderMatchup();

  await screen.findByRole('heading', { name: 'What BOS allows' });
  await userEvent.click(screen.getByRole('button', { name: 'All' }));
  const rowsOf = (name) =>
    within(screen.getByRole('region', { name }))
      .getAllByRole('article')
      .map((row) => [row.getAttribute('aria-label'), within(row).queryAllByTitle(/per 48/).length]);
  expect(rowsOf('Shot types')).toEqual([
    ['Catch-and-shoot 3s', 2],
    ['Under 10 ft 2s', 2],
  ]);
  expect(rowsOf('Shot zones')).toEqual([
    ['Corner 3s', 2],
    ['Restricted area', 2],
  ]);
  // The possession row never reads; Putbacks shows its points measure only.
  expect(rowsOf('Play types')).toEqual([
    ['Putbacks', 1],
    ['Transition', 1],
  ]);
  expect(sheetRow('Putbacks')).toHaveTextContent('+20%');
});

test('AC11: slices read in plain English, never as wire keys', async () => {
  fetchMatchup.mockResolvedValueOnce(fetched(fullSheet()));
  renderMatchup();

  await screen.findByRole('heading', { name: 'What BOS allows' });
  await userEvent.click(screen.getByRole('button', { name: 'All' }));
  expect(sheetRowNames()).toEqual([
    'Putbacks',
    'Transition',
    'Catch-and-shoot 3s',
    'Under 10 ft 2s',
    'Corner 3s',
    'Restricted area',
    'Above-the-break 3s',
    'Rebounds',
  ]);
  expect(
    within(sheetRegion()).queryByText(/Arc3Assists|OffRebound|OPP_REB|Less Than|:PTS|PTS$/),
  ).not.toBeInTheDocument();
});

test('AC12: each measure shows one % vs league and its rank on a fewest-to-most track', async () => {
  fetchMatchup.mockResolvedValueOnce(fetched(fullSheet()));
  renderMatchup();

  await screen.findByRole('heading', { name: 'What BOS allows' });
  await userEvent.click(screen.getByRole('button', { name: 'All' }));
  const transition = within(sheetRow('Transition'));
  expect(transition.getByText('+12%')).toHaveClass('tone-up');
  expect(transition.getByRole('img')).toHaveAccessibleName('Rank 27 of 30: allows the 4th most');
  expect(transition.getByRole('img')).toHaveTextContent('27');
  // Per-48 and σ are there on hover, not printed.
  expect(transition.getByTitle('18.4 per 48 · +1.4σ · rank 27 of 30 (30 allows the most)')).toBe(
    transition.getByText('+12%').parentElement,
  );
  // The cell prints the percent and the rank marker, nothing else.
  expect(transition.getByText('+12%').parentElement).toHaveTextContent(/^\+12%27$/);

  const arc = within(sheetRow('Above-the-break 3s'));
  expect(arc.getByText('−11%')).toHaveClass('tone-down');
  expect(arc.getByRole('img')).toHaveAccessibleName('Rank 3 of 30: allows the 3rd fewest');
  expect(
    within(sheetRow('Corner 3s'))
      .getAllByRole('img')
      .map((track) => track.getAttribute('aria-label')),
  ).toEqual(['Rank 30 of 30: allows the most', 'Rank 17 of 30: allows the 14th most']);
});

test('AC13: slices sort by their in-market measure, and both measures read at full strength', async () => {
  fetchMatchup.mockResolvedValueOnce(fetched(fullSheet()));
  renderMatchup();

  await screen.findByRole('heading', { name: 'What BOS allows' });
  const zoneOrder = () =>
    within(screen.getByRole('region', { name: 'Shot zones' }))
      .getAllByRole('article')
      .map((row) => row.getAttribute('aria-label'));
  // PTS reads makes: Restricted area +5% before Corner 3s +1%, whatever the
  // attempts say.
  expect(zoneOrder()).toEqual(['Restricted area', 'Corner 3s']);
  const cells = () =>
    within(sheetRow('Corner 3s'))
      .getAllByTitle(/per 48/)
      .map((cell) => cell.className);
  expect(cells()).toEqual(['sheet-cell', 'sheet-cell']);

  await userEvent.click(screen.getByRole('button', { name: 'FGA' }));
  expect(zoneOrder()).toEqual(['Corner 3s', 'Restricted area']);
  expect(cells()).toEqual(['sheet-cell', 'sheet-cell']);
});

test('AC14: only players over league who pass the display threshold are listed under a slice', async () => {
  const candidate = JSON.parse(JSON.stringify(matchup));
  const share = (sigmaDeviation, volumePerGame) => [
    {
      key: 'Transition',
      season: { share: 0.2, volumePerGame, leagueAverageShare: 0.1, sigmaDeviation },
    },
  ];
  candidate.players[0].dietShares.playTypes = share(0.4, 5); // Austin: above league, under 0.5σ
  candidate.players[1].dietShares.playTypes = share(1.3, 0.5); // LeBron: under the volume floor
  fetchMatchup.mockResolvedValueOnce(fetched(candidate));
  renderMatchup();

  await screen.findByRole('heading', { name: 'What BOS allows' });
  expect(
    within(sheetRow('Transition')).queryByRole('list', { name: /Players leaning/ }),
  ).not.toBeInTheDocument();
});

test("the volume floor reads the player's whole Base, not the one slice he leans on", async () => {
  const candidate = JSON.parse(JSON.stringify(matchup));
  candidate.teams.find((team) => team.tricode === 'BOS').defenseSheet.shotTypes = [
    {
      key: 'Less Than 10 ft:FG2M',
      sliceKey: 'Less Than 10 ft',
      label: 'Less Than 10 ft FG2M',
      markets: ['PTS'],
      season: value(9, 5, 1, 20),
      last15: value(9, 5, 1, 20),
    },
  ];
  // All his shots in a slice are twos, so its 2s read the slice's own share.
  const slice = (key, share, volumePerGame, sigmaDeviation) => {
    const value = { share, volumePerGame, leagueAverageShare: 0.4, sigmaDeviation };
    return { key, season: { ...value, shotValues: { 2: value, 3: null } } };
  };
  // Austin: 3 inside shots a game, but 5 shot-type attempts in all.
  candidate.players[0].dietShares.shotTypes = [
    slice('Less Than 10 ft', 0.6, 3, 1.5),
    slice('Catch and Shoot', 0.4, 2, -0.6),
  ];
  // LeBron: 3.5 shot-type attempts a game in all, under the floor of 4.
  candidate.players[1].dietShares.shotTypes = [
    slice('Less Than 10 ft', 0.7, 2.5, 2),
    slice('Pullups', 0.3, 1, -0.5),
  ];
  fetchMatchup.mockResolvedValueOnce(fetched(candidate));
  renderMatchup();

  await screen.findByRole('heading', { name: 'What BOS allows' });
  expect(
    within(sheetRow('Under 10 ft 2s')).getByRole('list', {
      name: 'Players leaning on Under 10 ft 2s',
    }),
  ).toHaveTextContent(/^Austin Reaves 60%$/);
});

test('AC15: Save as Target is an icon at the row end that captures the slice', async () => {
  renderMatchup();

  await screen.findByRole('heading', { name: 'What BOS allows' });
  const save = within(sheetRow('Transition')).getByRole('button', {
    name: 'Save Transition as a Target',
  });
  expect(save).toHaveAttribute('title', 'Save as Target');
  expect(save).toHaveTextContent('');
  expect(save.querySelector('svg')).not.toBeNull();
  expect(screen.queryByText('Save as Target')).not.toBeInTheDocument();
});

test('closing a deep-linked card whose row the open stat hides hands focus to the rail heading', async () => {
  const candidate = JSON.parse(JSON.stringify(matchup));
  const austin = candidate.players.find((player) => player.id === 1630559);
  austin.postedMarkets = ['FG3A'];
  austin.statCategories = ['FG3A'];
  austin.provenance = { prizepicks: ['FG3A'] };
  austin.lines = {};
  delete austin.scores.PTS;
  fetchMatchup.mockResolvedValueOnce(fetched(candidate));
  renderMatchup('/matchups/game-1?player=1630559');

  await screen.findByRole('heading', { name: 'Austin Reaves', level: 2 });
  // The page keeps its PTS opening, which leaves Austin's row out of the rail.
  expect(railNames()).toEqual(['LeBron James']);
  await userEvent.click(screen.getByRole('button', { name: 'Close selection card' }));
  await waitFor(() =>
    expect(
      within(screen.getByRole('complementary', { name: 'Targetable players' })).getByRole(
        'heading',
        { level: 2 },
      ),
    ).toHaveFocus(),
  );
  expect(document.activeElement).toHaveTextContent('LAL · PTS');
});

test('AC6: a withheld score is no headline, and a defensive-only score is one', async () => {
  const candidate = JSON.parse(JSON.stringify(matchup));
  const lebron = candidate.players.find((player) => player.id === 2544);
  // Components computed, Blend withheld for a named missing input.
  lebron.scores.FGA.season = {
    components: { playTypes: { value: 0.5, thin: false } },
    blend: null,
    missingInputs: ['team_defense:play_types'],
  };
  // A defensive stat has no Blend by contract; its component is the score.
  lebron.postedMarkets.push('TOV');
  lebron.statCategories.push('TOV');
  lebron.provenance.prizepicks.push('TOV');
  lebron.scores.TOV = {
    season: {
      components: { traditional: { value: 0.07, thin: false } },
      blend: null,
      missingInputs: [],
    },
    last15: { components: {}, blend: null, missingInputs: [] },
  };
  fetchMatchup.mockResolvedValueOnce(fetched(candidate));
  renderMatchup();

  await screen.findByRole('heading', { name: 'What BOS allows' });
  await userEvent.click(screen.getByRole('button', { name: 'FGA' }));
  const withheld = screen.getByRole('article', { name: 'LeBron James player' });
  expect(within(withheld).getByRole('img', { name: 'Matchup Score unavailable' })).toBeVisible();
  expect(withheld).not.toHaveTextContent('50%');

  await userEvent.click(screen.getByRole('button', { name: 'TOV' }));
  expect(
    within(screen.getByRole('article', { name: 'LeBron James player' })).getByRole('img', {
      name: 'Matchup Score +7%',
    }),
  ).toHaveClass('tone-up');
});

test('AC10: one shot type reads as a 2s row and a 3s row, each with its attempts and makes', async () => {
  const candidate = JSON.parse(JSON.stringify(matchup));
  const row = (stat, markets, season) => ({
    key: `Pullups:${stat}`,
    sliceKey: 'Pullups',
    label: `Pullups ${stat}`,
    markets,
    season,
    last15: season,
  });
  candidate.teams.find((team) => team.tricode === 'BOS').defenseSheet.shotTypes = [
    row('FG2A', ['FGA', 'FG2A'], value(12, 4, 1.1, 20)),
    row('FG2M', ['PTS'], value(5, -6, -1.2, 9)),
    row('FG3A', ['FGA', 'FG3A'], value(7, 15, 1.5, 28)),
    row('FG3M', ['3PM', 'PTS'], value(2.5, 9, 1.3, 25)),
  ];
  fetchMatchup.mockResolvedValueOnce(fetched(candidate));
  renderMatchup();

  await screen.findByRole('heading', { name: 'What BOS allows' });
  await userEvent.click(screen.getByRole('button', { name: 'All' }));
  const cells = (name) =>
    within(sheetRow(name))
      .getAllByTitle(/per 48/)
      .map(
        (cell) => cell.getAttribute('title').split(' · ')[0] + ' ' + cell.firstChild.textContent,
      );
  expect(
    within(screen.getByRole('region', { name: 'Shot types' }))
      .getAllByRole('article')
      .map((article) => article.getAttribute('aria-label')),
  ).toEqual(['Pull-up 3s', 'Pull-up 2s']);
  // Attempts then Makes, each its own shot value's.
  expect(cells('Pull-up 2s')).toEqual(['12.0 per 48 +4%', '5.0 per 48 −6%']);
  expect(cells('Pull-up 3s')).toEqual(['7.0 per 48 +15%', '2.5 per 48 +9%']);
});

test('AC12: the rank marker sits from fewest at the left to most at the right', async () => {
  fetchMatchup.mockResolvedValueOnce(fetched(fullSheet()));
  renderMatchup();

  await screen.findByRole('heading', { name: 'What BOS allows' });
  await userEvent.click(screen.getByRole('button', { name: 'All' }));
  const marker = (name, index = 0) =>
    within(sheetRow(name)).getAllByRole('img')[index].querySelector('i');
  // Rank 30 allows the most: the right end. Rank 3: near the left.
  expect(marker('Corner 3s').style.left).toBe('100%');
  expect(marker('Above-the-break 3s').style.left).toBe(`${(2 / 29) * 100}%`);
  expect(marker('Corner 3s', 1).style.left).toBe(`${(16 / 29) * 100}%`);
});

const quote = (books, overrides = {}) => ({
  asOf: '2026-10-21T21:04:11Z',
  closing: false,
  books,
  ...overrides,
});
const bookRow = (book, line, over, under, best = {}) => ({
  book,
  line,
  over,
  under,
  updatedAt: '2026-10-21T21:00:00Z',
  bestOver: false,
  bestUnder: false,
  ...best,
});
const openWithBooks = async (bookLines, path = '/matchups/game-1?player=2544') => {
  const candidate = JSON.parse(JSON.stringify(matchup));
  candidate.players.find((player) => player.id === 2544).bookLines = bookLines;
  fetchMatchup.mockResolvedValueOnce(fetched(candidate));
  renderMatchup(path);
  await screen.findByRole('heading', { name: 'LeBron James', level: 2 });
};
const linesTable = (market) => screen.getByRole('table', { name: `${market} lines` });
const tableRows = (table) =>
  within(table)
    .getAllByRole('row')
    .slice(1)
    .map((row) => row.textContent.replace(/\s+/g, ' ').trim());

test('the Selection card opens as a dialog over the Defense Sheet, in reading order', async () => {
  await openWithBooks({ PTS: quote([bookRow('fanduel', 26.5, -135, 110)]) });

  const dialog = screen.getByRole('dialog', { name: 'LeBron James' });
  expect(screen.getByRole('heading', { name: 'What BOS allows' })).toBeInTheDocument();
  expect(dialog).not.toContainElement(screen.getByRole('heading', { name: 'What BOS allows' }));
  expect(
    within(dialog)
      .getAllByRole('region')
      .map((region) => region.getAttribute('aria-label')),
  ).toEqual(['Matchup Score', 'Games vs this opponent', 'Lines']);
  const strip = within(dialog).getByRole('group', { name: 'Selection log stat' });
  expect(
    strip.compareDocumentPosition(within(dialog).getByRole('region', { name: 'Matchup Score' })),
  ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
});

test.each([
  ['×', () => userEvent.click(screen.getByRole('button', { name: 'Close selection card' }))],
  ['Escape', () => userEvent.keyboard('{Escape}')],
  ['the backdrop', () => userEvent.click(screen.getByRole('dialog', { name: 'Austin Reaves' }))],
])(
  'closing the dialog by %s drops ?player= and hands focus to the rail button',
  async (_how, close) => {
    renderMatchup('/matchups/game-1?stat=PTS');
    await screen.findByRole('heading', { name: 'What BOS allows' });
    const austin = screen.getByRole('article', { name: 'Austin Reaves player' });
    await userEvent.click(within(austin).getByRole('button', { name: 'Open selection card' }));
    expect(await screen.findByRole('dialog', { name: 'Austin Reaves' })).toBeVisible();
    expect(screen.getByTestId('location')).toHaveTextContent(
      '/matchups/game-1?stat=PTS&player=1630559',
    );

    await close();

    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Austin Reaves' })).not.toBeInTheDocument(),
    );
    expect(screen.getByTestId('location')).toHaveTextContent(/^\/matchups\/game-1\?stat=PTS$/);
    await waitFor(() =>
      expect(within(austin).getByRole('button', { name: 'Open selection card' })).toHaveFocus(),
    );
  },
);

test('Escape on an open help note inside the dialog closes the note, not the dialog', async () => {
  renderMatchup('/matchups/game-1?player=2544');
  const dialog = await screen.findByRole('dialog', { name: 'LeBron James' });
  const tip = within(dialog).getByRole('button', { name: 'About Matchup Score' });
  await userEvent.click(tip);
  expect(tip).toHaveAttribute('aria-expanded', 'true');

  await userEvent.keyboard('{Escape}');

  expect(tip).toHaveAttribute('aria-expanded', 'false');
  expect(screen.getByRole('dialog', { name: 'LeBron James' })).toBeVisible();
  expect(screen.getByTestId('location')).toHaveTextContent('/matchups/game-1?player=2544');
});

test('the Selection card lists apps then books with line, Over and Under, and stars the best price only where the backend flagged it', async () => {
  await openWithBooks({
    PTS: quote([
      bookRow('fanduel', 26.5, -135, 110),
      bookRow('betmgm', 27.5, -110, -120, { bestOver: true }),
      bookRow('draftkings', 27.5, -110, -115, { bestOver: true }),
      bookRow('betrivers', 27.5, -115, -105, { bestUnder: true }),
    ]),
  });

  const panel = screen.getByRole('region', { name: 'Lines' });
  expect(within(panel).getByRole('heading', { name: 'Lines · PTS as of 06:04' })).toBeVisible();
  const table = within(panel).getByRole('table', { name: 'PTS lines' });
  expect(tableRows(table)).toEqual([
    'Apps',
    'PrizePicks27.5——',
    'Underdog26.5——',
    'Sportsbooks',
    'FanDuel26.5-135+110',
    'BetMGM27.5-110 ★-120',
    'DraftKings27.5-110 ★-115',
    'BetRivers27.5-115-105 ★',
  ]);
  // The 26.5 line is not compared with the 27.5 lines, so FanDuel has no star.
  expect(within(table).getAllByRole('img', { name: 'best price' })).toHaveLength(3);
  const fanduel = within(table).getByRole('row', { name: /FanDuel/ });
  expect(within(fanduel).queryByRole('img', { name: 'best price' })).not.toBeInTheDocument();
  const betmgm = within(table).getByRole('row', { name: /BetMGM/ });
  expect(
    within(betmgm)
      .getAllByRole('cell')
      .map((cell) => cell.textContent),
  ).toEqual(['27.5', '-110 ★', '-120']);
  // The strip tile still names only the DFS providers that post PTS.
  expect(
    within(screen.getByRole('group', { name: 'Selection log stat' })).getByRole('button', {
      name: 'PTS',
    }),
  ).toHaveAccessibleDescription('Posted by PrizePicks and Underdog +12.0% Season Matchup Score');
});

test('the lines table follows the selected stat and labels a closing snapshot', async () => {
  await openWithBooks({
    PTS: quote([bookRow('fanduel', 26.5, -135, 110)]),
    REB: quote([bookRow('draftkings', 9.5, 100, null)], { closing: true }),
  });
  expect(linesTable('PTS')).toBeVisible();

  await userEvent.click(
    within(screen.getByRole('group', { name: 'Selection log stat' })).getByRole('button', {
      name: 'REB',
    }),
  );

  expect(tableRows(linesTable('REB'))).toEqual(['Sportsbooks', 'DraftKings9.5+100—']);
  expect(screen.queryByRole('table', { name: 'PTS lines' })).not.toBeInTheDocument();
  const panel = screen.getByRole('region', { name: 'Lines' });
  expect(within(panel).getByText('Closing')).toBeVisible();
  expect(within(panel).queryByText(/as of/)).not.toBeInTheDocument();
});

test('shows four books and puts the rest behind a +N expander', async () => {
  const names = ['betmgm', 'betrivers', 'draftkings', 'fanatics', 'fanduel', 'williamhill_us'];
  await openWithBooks({ PTS: quote(names.map((name) => bookRow(name, 27.5, -110, -110))) });
  const table = linesTable('PTS');
  const collapsed = [
    'Apps',
    'PrizePicks27.5——',
    'Underdog26.5——',
    'Sportsbooks',
    'BetMGM27.5-110-110',
    'BetRivers27.5-110-110',
    'DraftKings27.5-110-110',
    'Fanatics27.5-110-110',
  ];
  expect(tableRows(table)).toEqual(collapsed);

  await userEvent.click(screen.getByRole('button', { name: '+2 more' }));

  expect(tableRows(table)).toEqual([...collapsed, 'FanDuel27.5-110-110', 'Caesars27.5-110-110']);

  await userEvent.click(screen.getByRole('button', { name: 'Show fewer' }));

  expect(tableRows(table)).toEqual(collapsed);
  expect(within(table).queryByText('Caesars')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: '+2 more' })).toHaveAttribute('aria-expanded', 'false');
});

test('another player opens with his books collapsed again', async () => {
  const names = ['betmgm', 'betrivers', 'draftkings', 'fanduel', 'williamhill_us'];
  const books = { PTS: quote(names.map((name) => bookRow(name, 27.5, -110, -110))) };
  const candidate = JSON.parse(JSON.stringify(matchup));
  for (const player of candidate.players) player.bookLines = books;
  fetchMatchup.mockResolvedValueOnce(fetched(candidate));
  renderMatchup('/matchups/game-1?player=2544');
  await screen.findByRole('heading', { name: 'LeBron James', level: 2 });
  await userEvent.click(screen.getByRole('button', { name: '+1 more' }));
  expect(within(linesTable('PTS')).getAllByRole('rowheader')).toHaveLength(7);

  await userEvent.click(screen.getByRole('button', { name: 'Close selection card' }));
  await userEvent.click(
    within(screen.getByRole('article', { name: 'Austin Reaves player' })).getByRole('button', {
      name: 'Open selection card',
    }),
  );
  await screen.findByRole('heading', { name: 'Austin Reaves', level: 2 });

  // Underdog's line, then four of the five books.
  expect(within(linesTable('PTS')).getAllByRole('rowheader')).toHaveLength(5);
  expect(screen.getByRole('button', { name: '+1 more' })).toHaveAttribute('aria-expanded', 'false');
});

test.each([
  ['an empty book_lines', {}],
  ['book_lines for another stat only', { REB: quote([bookRow('fanduel', 8.5, -110, -110)]) }],
  ['a market with no books', { PTS: quote([]) }],
  ['the field absent', undefined],
])('lists only the apps for %s', async (_name, bookLines) => {
  await openWithBooks(bookLines);

  expect(tableRows(linesTable('PTS'))).toEqual(['Apps', 'PrizePicks27.5——', 'Underdog26.5——']);
  expect(screen.getByRole('heading', { name: 'Lines · PTS' })).toBeVisible();
  expect(screen.queryByText('Show fewer')).not.toBeInTheDocument();
});

describe('Selection card DFS prices', () => {
  const openWithDfs = async ({ lines, linePrices, bookLines = {} }) => {
    const candidate = JSON.parse(JSON.stringify(matchup));
    const lebron = candidate.players.find((player) => player.id === 2544);
    lebron.lines = lines;
    lebron.linePrices = linePrices;
    lebron.bookLines = bookLines;
    fetchMatchup.mockResolvedValueOnce(fetched(candidate));
    renderMatchup('/matchups/game-1?player=2544');
    await screen.findByRole('heading', { name: 'LeBron James', level: 2 });
  };

  test('lists every app and market that numbers him, priced or not, with no sportsbook quoting him', async () => {
    await openWithDfs({
      lines: {
        underdog: { PTS: 26.5 },
        dabble: { PTS: 27.5 },
        novig: { PTS: 27.5 },
        prizepicks: { PTS: 25.5 },
      },
      linePrices: {
        dabble: { PTS: { over: -122, under: -122 } },
        underdog: { PTS: { over: -112, under: null } },
        novig: { PTS: { over: -106, under: -102 } },
      },
    });

    const panel = screen.getByRole('region', { name: 'Lines' });
    expect(within(panel).getByRole('heading', { name: 'Lines · PTS' })).toBeVisible();
    // The rail shows one line, so every other number is read here, in a fixed order.
    expect(tableRows(within(panel).getByRole('table', { name: 'PTS lines' }))).toEqual([
      'Apps',
      'PrizePicks25.5——',
      'Underdog26.5-112—',
      'Dabble27.5-122-122',
      'Novig27.5-106-102',
    ]);
  });

  test('a stat no app or book numbers shows no lines panel', async () => {
    await openWithDfs({ lines: {}, linePrices: {} });

    expect(screen.getByRole('region', { name: 'Matchup Score' })).toBeVisible();
    expect(screen.queryByRole('region', { name: 'Lines' })).not.toBeInTheDocument();
    expect(screen.queryByRole('table', { name: /lines$/ })).not.toBeInTheDocument();
  });

  test('shares one table with the sportsbooks and follows the selected stat', async () => {
    await openWithDfs({
      lines: { dabble: { PTS: 27.5, FGA: 8.5 } },
      linePrices: { dabble: { FGA: { over: -122, under: -122 } } },
      bookLines: { PTS: quote([bookRow('fanduel', 26.5, -135, 110)]) },
    });

    // Dabble prices only FGA, but its PTS line is still listed, unpriced.
    expect(tableRows(linesTable('PTS'))).toEqual([
      'Apps',
      'Dabble27.5——',
      'Sportsbooks',
      'FanDuel26.5-135+110',
    ]);

    await userEvent.click(
      within(screen.getByRole('group', { name: 'Selection log stat' })).getByRole('button', {
        name: 'FGA',
      }),
    );

    expect(tableRows(linesTable('FGA'))).toEqual(['Apps', 'Dabble8.5-122-122']);
  });
});

test('a category only sportsbooks quote is reachable from the strip without becoming a DFS market', async () => {
  await openWithBooks({
    AST: quote([
      bookRow('betmgm', 6.5, 120, -150, { bestOver: true }),
      bookRow('fanduel', 6.5, 110, -140),
    ]),
  });
  const strip = screen.getByRole('group', { name: 'Selection log stat' });
  expect(
    within(strip)
      .getAllByRole('button')
      .map((button) => button.getAttribute('aria-label')),
  ).toEqual(['PTS', 'AST', 'FGA']);
  expect(screen.queryByRole('table', { name: 'AST lines' })).not.toBeInTheDocument();

  await userEvent.click(within(strip).getByRole('button', { name: 'AST' }));

  expect(within(strip).getByRole('button', { name: 'AST' })).toHaveAccessibleDescription(
    'Quoted by sportsbooks only No Season Matchup Score',
  );
  expect(tableRows(linesTable('AST'))).toEqual([
    'Sportsbooks',
    'BetMGM6.5+120 ★-150',
    'FanDuel6.5+110-140',
  ]);
  // Still DFS-only: the posted-by line, no Matchup Score and the Target path.
  expect(screen.getByText(/Markets posted by PrizePicks and Underdog\./)).toBeVisible();
  expect(screen.getByRole('region', { name: 'Matchup Score' })).toHaveTextContent(
    'No Matchup Score for AST in Season.',
  );
  expect(
    await screen.findByText(
      'Games vs this opponent covers the markets with a line in CourtAI’s books, so it has no AST log.',
    ),
  ).toBeVisible();
});

test('names every allowlisted sportsbook', async () => {
  const keys = ['draftkings', 'fanduel', 'betmgm', 'williamhill_us', 'betrivers', 'fanatics'];
  await openWithBooks({ PTS: quote(keys.map((key) => bookRow(key, 27.5, -110, -110))) });
  await userEvent.click(screen.getByRole('button', { name: '+2 more' }));

  expect(
    within(linesTable('PTS'))
      .getAllByRole('rowheader')
      .map((cell) => cell.textContent),
  ).toEqual([
    'PrizePicks',
    'Underdog',
    'DraftKings',
    'FanDuel',
    'BetMGM',
    'Caesars',
    'BetRivers',
    'Fanatics',
  ]);
});

describe('rail price line', () => {
  const openRail = async ({ bookLines = {}, linePrices = {}, lines = {}, provenance = {} }) => {
    const candidate = JSON.parse(JSON.stringify(matchup));
    const lebron = candidate.players.find((player) => player.id === 2544);
    lebron.bookLines = bookLines;
    lebron.linePrices = linePrices;
    lebron.lines = { ...lebron.lines, ...lines };
    lebron.provenance = { ...lebron.provenance, ...provenance };
    fetchMatchup.mockResolvedValueOnce(fetched(candidate));
    renderMatchup();
    return screen.findByRole('article', { name: 'LeBron James player' });
  };
  const priceLine = (row) => within(row).queryByRole('group', { name: /^Best / });
  const text = (element) => normalized(element).trim();
  // Unpriced markets that join PrizePicks at 27.5, so the headline is a line no
  // source prices and outvotes the books.
  const unpricedHeadline = {
    provenance: { polymarket: ['PTS'], novig: ['PTS'], kalshi: ['PTS'] },
    lines: { polymarket: { PTS: 27.5 }, novig: { PTS: 27.5 }, kalshi: { PTS: 27.5 } },
  };

  test('shows the best Over and Under across books and priced providers with their marks', async () => {
    const row = await openRail({
      bookLines: {
        PTS: quote([
          bookRow('draftkings', 27.5, -110, -115),
          bookRow('betmgm', 27.5, -108, -120),
          bookRow('fanduel', 26.5, -135, 110),
        ]),
      },
      lines: { novig: { PTS: 27.5 } },
      linePrices: { novig: { PTS: { over: -106, under: -102 } } },
    });

    expect(text(priceLine(row))).toBe('o −106 NV u −102 NV');
    expect(priceLine(row)).toHaveAccessibleName(
      'Best Over −106 at Novig, best Under −102 at Novig, line 27.5',
    );
    expect(within(row).queryByText(/^books /)).not.toBeInTheDocument();
  });

  test('a tie goes to the sportsbook, then underdog, novig, polymarket, kalshi', async () => {
    const row = await openRail({
      bookLines: { PTS: quote([bookRow('draftkings', 27.5, -110, -110)]) },
      lines: { novig: { PTS: 27.5 }, underdog: { PTS: 27.5 }, kalshi: { PTS: 27.5 } },
      linePrices: {
        kalshi: { PTS: { over: 100, under: -105 } },
        novig: { PTS: { over: -110, under: -105 } },
        underdog: { PTS: { over: -110, under: -112 } },
      },
    });

    // Over -110 ties between DK, UD and NV: DK. Under -105 ties between NV and KX: NV.
    expect(priceLine(row)).toHaveAccessibleName(
      'Best Over +100 at Kalshi, best Under −105 at Novig, line 27.5',
    );
  });

  test('equal best prices pick the first source in tie order', async () => {
    const row = await openRail({
      bookLines: { PTS: quote([bookRow('fanduel', 27.5, -110, -115)]) },
      lines: { novig: { PTS: 27.5 }, underdog: { PTS: 27.5 } },
      linePrices: {
        novig: { PTS: { over: -110, under: -115 } },
        underdog: { PTS: { over: -110, under: -115 } },
      },
    });

    expect(text(priceLine(row))).toBe('o −110 FD u −115 FD');
  });

  test('prices at the books line with a gold note when nothing prices the headline', async () => {
    const row = await openRail({
      bookLines: {
        PTS: quote([
          bookRow('draftkings', 26.5, -115, -105),
          bookRow('fanduel', 26.5, -120, 100),
          bookRow('betmgm', 28.5, 120, -150),
        ]),
      },
      provenance: unpricedHeadline.provenance,
      lines: { ...unpricedHeadline.lines, underdog: { PTS: 26.5 } },
      linePrices: { underdog: { PTS: { over: -112, under: -112 } } },
    });

    expect(text(priceLine(row))).toBe('books 26.5 o −112 UD u +100 FD');
    expect(priceLine(row)).toHaveAccessibleName(
      'Best Over −112 at Underdog, best Under +100 at FanDuel, line 26.5',
    );
    expect(within(row).getByText('books 26.5')).toBeVisible();
  });

  test('breaks a tie between the most posted books lines toward the lower line', async () => {
    const row = await openRail({
      bookLines: {
        PTS: quote([bookRow('draftkings', 26.5, -110, -110), bookRow('fanduel', 25.5, -105, -125)]),
      },
      ...unpricedHeadline,
    });

    expect(text(priceLine(row))).toBe('books 25.5 o −105 FD u −125 FD');
  });

  test('a side nobody prices shows a dash, and no price at all shows no line', async () => {
    const one = await openRail({
      bookLines: { PTS: quote([bookRow('draftkings', 27.5, 135, null)]) },
    });
    expect(text(priceLine(one))).toBe('o +135 DK u —');
    expect(priceLine(one)).toHaveAccessibleName(
      'Best Over +135 at DraftKings, no Under price, line 27.5',
    );
  });

  test('shows no price line when neither side is priced anywhere', async () => {
    const row = await openRail({
      bookLines: { PTS: quote([bookRow('draftkings', 27.5, null, null)]) },
      linePrices: {},
    });

    expect(priceLine(row)).not.toBeInTheDocument();
    expect(row).not.toHaveTextContent('books');
  });

  test('a Dabble even line competes at its own price', async () => {
    const row = await openRail({
      bookLines: { PTS: quote([bookRow('draftkings', 27.5, -130, -115)]) },
      lines: { dabble: { PTS: 27.5 } },
      linePrices: { dabble: { PTS: { over: -122, under: -122 } } },
    });

    expect(priceLine(row)).toHaveAccessibleName(
      'Best Over −122 at Dabble, best Under −115 at DraftKings, line 27.5',
    );
  });

  test('DFS entry providers never contribute a price', async () => {
    const row = await openRail({
      lines: { prizepicks: { PTS: 27.5 } },
      linePrices: { prizepicks: { PTS: { over: -110, under: -110 } } },
    });

    expect(priceLine(row)).not.toBeInTheDocument();
  });

  test('historical rows show no price line even when priced quotes are present', async () => {
    const candidate = historicalMatchup();
    for (const player of candidate.players) {
      player.bookLines = { PTS: quote([bookRow('draftkings', 27.5, -110, -110)]) };
      player.lines = { novig: { PTS: 27.5 } };
      player.linePrices = { novig: { PTS: { over: -106, under: -102 } } };
    }
    fetchMatchup.mockResolvedValueOnce(fetched(candidate));
    renderMatchup();
    await screen.findByRole('complementary', { name: 'Players in game' });

    expect(screen.queryByRole('group', { name: /^Best / })).not.toBeInTheDocument();
  });

  test('the books line counts every sportsbook posting, priced or not', async () => {
    const setup = {
      bookLines: {
        PTS: quote([
          bookRow('draftkings', 26.5, null, null),
          bookRow('fanduel', 26.5, null, null),
          bookRow('betmgm', 25.5, -110, -110),
        ]),
      },
      provenance: unpricedHeadline.provenance,
      lines: { ...unpricedHeadline.lines, underdog: { PTS: 26.5 } },
      linePrices: { underdog: { PTS: { over: -105, under: -105 } } },
    };
    const row = await openRail(setup);

    expect(text(priceLine(row))).toBe('books 26.5 o −105 UD u −105 UD');
  });

  test('a book posting the headline with no price does not make the headline priced', async () => {
    const row = await openRail({
      bookLines: {
        PTS: quote([bookRow('draftkings', 27.5, null, null), bookRow('fanduel', 26.5, -120, 100)]),
      },
    });

    expect(text(priceLine(row))).toBe('books 26.5 o −120 FD u +100 FD');
  });

  test('a provider priced at another line never wins', async () => {
    const row = await openRail({
      bookLines: { PTS: quote([bookRow('draftkings', 27.5, -110, -115)]) },
      lines: { novig: { PTS: 26.5 }, polymarket: { PTS: 27.5 } },
      linePrices: {
        novig: { PTS: { over: 150, under: 150 } },
        polymarket: { PTS: { over: -112, under: -105 } },
      },
    });

    expect(priceLine(row)).toHaveAccessibleName(
      'Best Over −110 at DraftKings, best Under −105 at Polymarket, line 27.5',
    );
  });

  test.each([
    ['underdog', 'novig'],
    ['novig', 'polymarket'],
    ['polymarket', 'kalshi'],
    ['kalshi', 'dabble'],
  ])('an equal price goes to %s before %s', async (first, second) => {
    const price = { PTS: { over: -110, under: -110 } };
    const row = await openRail({
      lines: { [first]: { PTS: 27.5 }, [second]: { PTS: 27.5 } },
      // Served in the opposite order to the tie order.
      linePrices: { [second]: price, [first]: price },
    });

    expect(priceLine(row)).toHaveAccessibleName(
      `Best Over −110 at ${bookName(first)}, best Under −110 at ${bookName(first)}, line 27.5`,
    );
  });

  test('an equal price goes to the sportsbook served first', async () => {
    const row = await openRail({
      bookLines: {
        PTS: quote([bookRow('fanduel', 27.5, -110, -110), bookRow('betmgm', 27.5, -110, -110)]),
      },
    });

    expect(text(priceLine(row))).toBe('o −110 FD u −110 FD');
  });
});

// After a Season Cutover to 2026-27: play types still serve 2025-26 and every
// Last 15 window covers the 6 games each team has played.
const mixedSeasonMatchup = () => {
  const candidate = JSON.parse(JSON.stringify(matchup));
  candidate.asOfSeason = '2026-27';
  Object.values(candidate.league.surfaceAvailability).forEach((windows) => {
    windows.season.season = '2026-27';
    windows.last15.season = '2026-27';
    windows.last15.windowGames = 6;
  });
  candidate.league.surfaceAvailability.playTypes.season.season = '2025-26';
  candidate.trailing = [
    { family: 'synergy', servingSeason: '2025-26', rule: 'NBA publishes 2026-27 play types' },
  ];
  return candidate;
};

const openFullSheet = async () => {
  renderMatchup();
  await screen.findByRole('heading', { name: 'What BOS allows' });
  await userEvent.click(screen.getByRole('button', { name: 'All' }));
  await userEvent.click(screen.getByRole('button', { name: 'All deviations' }));
};

test('badges only the trailing section with its season and names a short Last 15 by its games', async () => {
  fetchMatchup.mockResolvedValueOnce(fetched(mixedSeasonMatchup()));
  await openFullSheet();

  expect(screen.getAllByText('2025-26 season')).toHaveLength(1);
  expect(
    within(screen.getByRole('region', { name: 'Play types' })).getByText('2025-26 season'),
  ).toBeVisible();
  expect(
    within(screen.getByRole('region', { name: 'Shot zones' })).queryByText(/season$/),
  ).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Last 15' })).not.toBeInTheDocument();

  await userEvent.click(screen.getByRole('button', { name: 'Last 6' }));
  expect(screen.getByRole('button', { name: 'Last 6' })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.queryByText('2025-26 season')).not.toBeInTheDocument();
});

// A past game's sections read that game's own season. Only a trailing family
// serving that same season badges a section.
test.each([
  ['a 2025-26 game with nothing trailing', '2025-26', []],
  [
    'a 2024-25 game while play types trail 2025-26',
    '2024-25',
    [{ family: 'synergy', servingSeason: '2025-26', rule: 'NBA publishes 2026-27 play types' }],
  ],
])(
  'a past game served after the Season Cutover carries no season badge: %s',
  async (_name, gameSeason, trailing) => {
    const candidate = JSON.parse(JSON.stringify(matchup));
    candidate.asOfSeason = '2026-27';
    candidate.trailing = trailing;
    Object.values(candidate.league.surfaceAvailability).forEach((windows) => {
      windows.season.season = gameSeason;
    });
    fetchMatchup.mockResolvedValueOnce(fetched(candidate));
    await openFullSheet();

    expect(screen.queryAllByText(/\d{4}-\d{2} season/)).toHaveLength(0);
  },
);

test('reads a section season from its experience section when the Surface does not name one', async () => {
  const candidate = JSON.parse(JSON.stringify(matchup));
  candidate.asOfSeason = '2026-27';
  const section = (season) => ({
    status: 'available',
    source: 'team_matchup_publication',
    context: 'pregame',
    unavailableReason: null,
    season,
  });
  candidate.experience.sections = {
    schedule: { status: 'available', unavailableReason: null },
    participants: { status: 'available', unavailableReason: null },
    seasonDefense: section('2025-26'),
    last15Defense: section('2026-27'),
    injuries: { status: 'available', unavailableReason: null },
  };
  candidate.trailing = [
    { family: 'team_defense', servingSeason: '2025-26', rule: 'every team has played 10 games' },
  ];
  fetchMatchup.mockResolvedValueOnce(fetched(candidate));
  await openFullSheet();

  expect(screen.getAllByText('2025-26 season')).toHaveLength(3);
  await userEvent.click(screen.getByRole('button', { name: 'Last 15' }));
  expect(screen.queryByText('2025-26 season')).not.toBeInTheDocument();
});

test('explains a withheld Season window in its own words, not the Last 15 sentence', async () => {
  const candidate = mixedSeasonMatchup();
  candidate.league.surfaceAvailability.traditional.season = {
    status: 'missing',
    unavailableReason: 'window_not_ready',
  };
  fetchMatchup.mockResolvedValueOnce(fetched(candidate));
  await openFullSheet();

  expect(
    screen.getByText('Box score unavailable for Season: Season numbers have not opened yet.'),
  ).toBeVisible();
  expect(screen.queryByText(/Last 15 has not opened yet/)).not.toBeInTheDocument();
  expect(screen.queryByText(/window_not_ready/)).not.toBeInTheDocument();
});

test('a Matchup without serving seasons reads Last 15 and carries no season badge', async () => {
  fetchMatchup.mockResolvedValueOnce(fetched(matchup));
  await openFullSheet();

  expect(screen.queryByText(/\d{4}-\d{2} season/)).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Last 15' })).toBeEnabled();
});

test('names the shortest Last 15 on the toggle and badges a section that covers more games', async () => {
  const candidate = mixedSeasonMatchup();
  candidate.league.surfaceAvailability.shotZones.last15.windowGames = 10;
  candidate.league.surfaceAvailability.traditional.last15.windowGames = null;
  fetchMatchup.mockResolvedValueOnce(fetched(candidate));
  await openFullSheet();

  await userEvent.click(screen.getByRole('button', { name: 'Last 6' }));
  expect(
    within(screen.getByRole('region', { name: 'Shot zones' })).getByText('Last 10'),
  ).toBeVisible();
  expect(
    within(screen.getByRole('region', { name: 'Box score' })).getByText('Last 15'),
  ).toBeVisible();
  expect(
    within(screen.getByRole('region', { name: 'Play types' })).queryByText(/^Last \d+$/),
  ).not.toBeInTheDocument();
});

test('reads the Last 15 game count from its experience section when the Surfaces carry none', async () => {
  const candidate = JSON.parse(JSON.stringify(matchup));
  candidate.experience.sections = {
    schedule: { status: 'available', unavailableReason: null },
    participants: { status: 'available', unavailableReason: null },
    seasonDefense: { status: 'available', unavailableReason: null },
    last15Defense: { status: 'available', unavailableReason: null, windowGames: 4 },
    injuries: { status: 'available', unavailableReason: null },
  };
  fetchMatchup.mockResolvedValueOnce(fetched(candidate));
  await openFullSheet();

  expect(screen.getByRole('button', { name: 'Last 4' })).toBeEnabled();
  expect(screen.queryByRole('button', { name: 'Last 15' })).not.toBeInTheDocument();
});

test('explains a Season window short of governed games in its own words', async () => {
  const candidate = mixedSeasonMatchup();
  candidate.league.surfaceAvailability.traditional.season = {
    status: 'unavailable',
    unavailableReason: 'insufficient_governed_games',
  };
  fetchMatchup.mockResolvedValueOnce(fetched(candidate));
  await openFullSheet();

  expect(
    screen.getByText('Box score unavailable for Season: Season numbers have not opened yet.'),
  ).toBeVisible();
  expect(screen.queryByText(/Last 15 has not opened yet/)).not.toBeInTheDocument();
});

test('a section’s own Last 15 count, null included, wins over its experience section’s', async () => {
  const candidate = JSON.parse(JSON.stringify(matchup));
  candidate.experience.sections = {
    schedule: { status: 'available', unavailableReason: null },
    participants: { status: 'available', unavailableReason: null },
    seasonDefense: { status: 'available', unavailableReason: null },
    last15Defense: { status: 'available', unavailableReason: null, windowGames: 6 },
    injuries: { status: 'available', unavailableReason: null },
  };
  candidate.league.surfaceAvailability.shotZones.last15.windowGames = 10;
  candidate.league.surfaceAvailability.traditional.last15.windowGames = null;
  fetchMatchup.mockResolvedValueOnce(fetched(candidate));
  await openFullSheet();

  await userEvent.click(screen.getByRole('button', { name: 'Last 6' }));
  expect(
    within(screen.getByRole('region', { name: 'Shot zones' })).getByText('Last 10'),
  ).toBeVisible();
  expect(
    within(screen.getByRole('region', { name: 'Box score' })).getByText('Last 15'),
  ).toBeVisible();
  expect(
    within(screen.getByRole('region', { name: 'Play types' })).queryByText(/^Last \d+$/),
  ).not.toBeInTheDocument();
});

test('an unavailable Last 15 section names its reason, not a game count', async () => {
  const candidate = mixedSeasonMatchup();
  candidate.league.surfaceAvailability.traditional.last15 = {
    status: 'unavailable',
    unavailableReason: 'provider_unsupported',
  };
  fetchMatchup.mockResolvedValueOnce(fetched(candidate));
  await openFullSheet();

  await userEvent.click(screen.getByRole('button', { name: 'Last 6' }));
  const boxScore = screen.getByRole('region', { name: 'Box score' });
  expect(
    within(boxScore).getByText('Box score unavailable for Last 6: provider_unsupported.'),
  ).toBeVisible();
  expect(within(boxScore).queryByText(/^Last \d+$/)).not.toBeInTheDocument();
});

/*
 * The Evidence season (crf04/statsplus#330): offered from /seasons choices,
 * kept in ?season=, named on the Matchup and selection reads only when it is
 * not the default, and carried to the Slate and Game Logs links.
 */
describe('Evidence season', () => {
  const location = () => screen.getByTestId('location').textContent;
  const seasonSelect = () => screen.getByRole('combobox', { name: 'Evidence season' });
  const refusal = (status, code, details) =>
    seasonRefusalOr(
      Object.assign(new Error(`Request failed with status code ${status}`), {
        response: { status, headers: {}, data: { error: { code, message: 'Refused.', details } } },
      }),
    );

  beforeEach(() => fetchSeasons.mockResolvedValue(unpublishedSeasons));

  test('a linked 2026-27 is read, named with its sample, and carried by every link', async () => {
    renderMatchup('/matchups/game-1?season=2026-27');
    await screen.findByRole('heading', { name: 'What BOS allows' });

    expect(fetchMatchup.mock.calls).toEqual([
      ['game-1', { signal: expect.any(AbortSignal), season: '2026-27' }],
    ]);
    expect(seasonSelect()).toHaveValue('2026-27');
    expect(screen.queryByTestId('evidence-season-chip')).toBeNull();
    expect(screen.getByRole('combobox', { name: 'Evidence season' })).toHaveDisplayValue(
      '2026-27 · early, 2–4 games per team',
    );
    expect(screen.getByRole('link', { name: '← Back to slate' })).toHaveAttribute(
      'href',
      '/matchups?date=2026-01-15&season=2026-27',
    );
    expect(screen.getByRole('link', { name: 'Austin Reaves game logs' })).toHaveAttribute(
      'href',
      '/?player_name=Austin+Reaves&season_filter=2026-27',
    );

    await userEvent.click(
      within(screen.getByRole('article', { name: 'Austin Reaves player' })).getByRole('button', {
        name: 'Open selection card',
      }),
    );
    await waitFor(() => expect(location()).toBe('/matchups/game-1?season=2026-27&player=1630559'));
    await waitFor(() =>
      expect(fetchMatchupSelection).toHaveBeenLastCalledWith(
        'game-1',
        1630559,
        ['PTS', 'FG3A'],
        expect.objectContaining({ season: '2026-27' }),
      ),
    );
  });

  test('the default is never named, and choosing it takes the season out of the URL', async () => {
    renderMatchup();
    await screen.findByRole('heading', { name: 'What BOS allows' });
    expect(seasonSelect()).toHaveValue('2025-26');
    expect(screen.queryByTestId('evidence-season-chip')).not.toBeInTheDocument();
    expect(fetchMatchup.mock.calls).toEqual([['game-1', { signal: expect.any(AbortSignal) }]]);
    expect(screen.getByRole('link', { name: 'Austin Reaves game logs' })).toHaveAttribute(
      'href',
      '/?player_name=Austin+Reaves&season_filter=2025-26',
    );

    fireEvent.change(seasonSelect(), { target: { value: '2026-27' } });
    expect(location()).toBe('/matchups/game-1?season=2026-27');
    await waitFor(() =>
      expect(fetchMatchup).toHaveBeenLastCalledWith('game-1', {
        signal: expect.any(AbortSignal),
        season: '2026-27',
      }),
    );

    fireEvent.change(await screen.findByRole('combobox', { name: 'Evidence season' }), {
      target: { value: '2025-26' },
    });
    expect(location()).toBe('/matchups/game-1');
    await waitFor(() => expect(fetchMatchup).toHaveBeenCalledTimes(3));
    expect(fetchMatchup).toHaveBeenLastCalledWith('game-1', { signal: expect.any(AbortSignal) });
  });

  // crf04/statsplus#348: a 2026-27 game reads 2026-27 once it is offered.
  test('a 2026-27 game reads 2026-27 with no season chosen', async () => {
    renderMatchup('/matchups/0022600003');
    await screen.findByRole('heading', { name: 'What BOS allows' });
    expect(fetchMatchup.mock.calls).toEqual([
      ['0022600003', { signal: expect.any(AbortSignal), season: '2026-27' }],
    ]);
    expect(seasonSelect()).toHaveValue('2026-27');
    expect(screen.queryByTestId('evidence-season-chip')).toBeNull();
    expect(screen.getByRole('combobox', { name: 'Evidence season' })).toHaveDisplayValue(
      '2026-27 · early, 2–4 games per team',
    );
    expect(screen.getByRole('link', { name: '← Back to slate' })).toHaveAttribute(
      'href',
      '/matchups?date=2026-01-15',
    );
  });

  test('a 2025-26 game reads 2025-26 with no season chosen', async () => {
    renderMatchup('/matchups/0022500584');
    await screen.findByRole('heading', { name: 'What BOS allows' });
    expect(fetchMatchup.mock.calls).toEqual([['0022500584', { signal: expect.any(AbortSignal) }]]);
    expect(seasonSelect()).toHaveValue('2025-26');
  });

  test('a chosen 2025-26 on a 2026-27 game stays in the URL and survives a reload', async () => {
    const { unmount } = renderMatchup('/matchups/0022600003');
    await screen.findByRole('heading', { name: 'What BOS allows' });
    fireEvent.change(seasonSelect(), { target: { value: '2025-26' } });
    expect(location()).toBe('/matchups/0022600003?season=2025-26');
    await waitFor(() => expect(fetchMatchup).toHaveBeenCalledTimes(2));
    expect(fetchMatchup).toHaveBeenLastCalledWith('0022600003', {
      signal: expect.any(AbortSignal),
    });
    expect(await screen.findByRole('link', { name: '← Back to slate' })).toHaveAttribute(
      'href',
      '/matchups?date=2026-01-15&season=2025-26',
    );
    unmount();

    fetchMatchup.mockClear();
    renderMatchup('/matchups/0022600003?season=2025-26');
    await screen.findByRole('heading', { name: 'What BOS allows' });
    expect(fetchMatchup.mock.calls).toEqual([['0022600003', { signal: expect.any(AbortSignal) }]]);
    expect(seasonSelect()).toHaveValue('2025-26');
  });

  test('a refused 2026-27 on a 2026-27 game goes back to 2025-26', async () => {
    fetchMatchup.mockImplementation(async (_id, { season }) => {
      if (season)
        throw refusal(503, 'season_unavailable', {
          selected_season: '2026-27',
          published_season: '2025-26',
        });
      return matchup;
    });
    renderMatchup('/matchups/0022600003');
    await userEvent.click(await screen.findByRole('button', { name: 'Show 2025-26' }));
    await waitFor(() => expect(location()).toBe('/matchups/0022600003?season=2025-26'));
    expect(await screen.findByRole('heading', { name: 'What BOS allows' })).toBeVisible();
  });

  test('until 2026-27 is offered, a 2026-27 game reads as before', async () => {
    fetchSeasons.mockResolvedValue(publishedOnlySeasons);
    renderMatchup('/matchups/0022600003');
    await screen.findByRole('heading', { name: 'What BOS allows' });
    expect(fetchMatchup.mock.calls).toEqual([['0022600003', { signal: expect.any(AbortSignal) }]]);
    expect(screen.queryByRole('combobox', { name: 'Evidence season' })).not.toBeInTheDocument();
  });

  test('choices without a season not yet published show nothing new', async () => {
    fetchSeasons.mockResolvedValue(legacySeasons);
    renderMatchup();
    await screen.findByRole('heading', { name: 'What BOS allows' });
    expect(screen.queryByRole('combobox', { name: 'Evidence season' })).not.toBeInTheDocument();
    expect(fetchMatchup.mock.calls).toEqual([['game-1', { signal: expect.any(AbortSignal) }]]);
  });

  test('2026-27 evidence for a 2025-26 game is refused, never shown as an empty Matchup', async () => {
    fetchMatchup.mockImplementation(async (_id, { season }) => {
      if (season)
        throw refusal(400, 'season_after_game', {
          selected_season: '2026-27',
          game_season: '2025-26',
        });
      return matchup;
    });
    renderMatchup('/matchups/game-1?season=2026-27');

    expect((await screen.findByRole('alert')).textContent).toBe(
      'This is a 2025-26 game, so it has no 2026-27 evidence. CourtAI still reads 2025-26 by default.Show 2025-26',
    );
    expect(screen.queryByRole('heading', { name: /allows$/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
    expect(screen.queryByText(/No Defense Sheet rows/)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Show 2025-26' }));
    await waitFor(() => expect(location()).toBe('/matchups/game-1'));
    expect(await screen.findByRole('heading', { name: 'What BOS allows' })).toBeVisible();
  });

  test('a 503 season_unavailable is the plain refusal, with the way back', async () => {
    fetchMatchup.mockRejectedValue(
      refusal(503, 'season_unavailable', {
        selected_season: '2026-27',
        published_season: '2025-26',
      }),
    );
    renderMatchup('/matchups/game-1?season=2026-27');
    expect((await screen.findByRole('alert')).textContent).toBe(
      "2026-27 isn't available yet. CourtAI still reads 2025-26 by default.Show 2025-26",
    );
    expect(screen.queryByRole('heading', { name: /allows$/ })).not.toBeInTheDocument();
  });

  // The Log Workspace defaults to the newest offered season, so a Game Logs
  // link names the season this Matchup read, the Published Season included.
  test('a 2026-27 game read on 2025-26 links its game logs to 2025-26', async () => {
    renderMatchup('/matchups/0022600003?season=2025-26');
    await screen.findByRole('heading', { name: 'What BOS allows' });
    expect(screen.getByRole('link', { name: 'Austin Reaves game logs' })).toHaveAttribute(
      'href',
      '/?player_name=Austin+Reaves&season_filter=2025-26',
    );
  });

  test('without season choices, a Matchup links its game logs to the season it answered for', async () => {
    fetchSeasons.mockRejectedValue(new Error('seasons down'));
    fetchMatchup.mockResolvedValue(fetched({ ...matchup, asOfSeason: '2025-26' }));
    renderMatchup();
    await screen.findByRole('heading', { name: 'What BOS allows' });
    expect(fetchMatchup.mock.calls).toEqual([['game-1', { signal: expect.any(AbortSignal) }]]);
    expect(screen.getByRole('link', { name: 'Austin Reaves game logs' })).toHaveAttribute(
      'href',
      '/?player_name=Austin+Reaves&season_filter=2025-26',
    );
  });

  test('a linked season the choices do not offer falls back to the default and says so', async () => {
    renderMatchup('/matchups/game-1?season=2027-28&player=2544');
    await screen.findByRole('heading', { name: 'What BOS allows' });
    expect(screen.getByText('2027-28 isn’t offered, so this is 2025-26 evidence.')).toHaveAttribute(
      'role',
      'status',
    );
    expect(location()).toBe('/matchups/game-1?player=2544');
    expect(fetchMatchup.mock.calls).toEqual([['game-1', { signal: expect.any(AbortSignal) }]]);
  });

  test('under 2026-27 a trailing section names its own season and sample', async () => {
    const selected = JSON.parse(JSON.stringify(matchup));
    selected.asOfSeason = '2025-26';
    selected.seasonContext = { selectedSeason: '2026-27', publishedSeason: '2025-26' };
    Object.values(selected.league.surfaceAvailability).forEach((windows) => {
      windows.season.season = '2026-27';
      windows.last15.season = '2026-27';
    });
    selected.league.surfaceAvailability.playTypes.season.season = '2025-26';
    selected.league.surfaceAvailability.shotZones.season.season = '2025-26';
    selected.trailing = [
      {
        family: 'synergy',
        servingSeason: '2025-26',
        rule: 'NBA publishes 2026-27 play types',
        teamGames: { min: 80, max: 82 },
      },
      {
        family: 'team_defense',
        servingSeason: '2025-26',
        rule: 'every team has played 10 games',
        teamGames: { min: 80, max: 82 },
      },
    ];
    fetchMatchup.mockResolvedValue(fetched(selected));
    renderMatchup('/matchups/game-1?season=2026-27');
    await screen.findByRole('heading', { name: 'What BOS allows' });
    await userEvent.click(screen.getByRole('button', { name: 'All' }));
    await userEvent.click(screen.getByRole('button', { name: 'All deviations' }));

    expect(
      within(screen.getByRole('region', { name: 'Play types' })).getByText(
        '2025-26 season · 80–82 games per team',
      ),
    ).toBeVisible();
    expect(
      within(screen.getByRole('region', { name: 'Shot zones' })).getByText(
        '2025-26 season · 80–82 games per team',
      ),
    ).toBeVisible();
    expect(screen.getAllByText(/^2025-26 season/)).toHaveLength(2);
  });

  test('a trailing sample the backend does not report says so', async () => {
    const selected = JSON.parse(JSON.stringify(matchup));
    selected.seasonContext = { selectedSeason: '2026-27', publishedSeason: '2025-26' };
    Object.values(selected.league.surfaceAvailability).forEach((windows) => {
      windows.season.season = '2026-27';
    });
    selected.league.surfaceAvailability.playTypes.season.season = '2025-26';
    selected.trailing = [
      { family: 'synergy', servingSeason: '2025-26', rule: 'NBA publishes 2026-27 play types' },
    ];
    fetchMatchup.mockResolvedValue(fetched(selected));
    renderMatchup('/matchups/game-1?season=2026-27');
    await screen.findByRole('heading', { name: 'What BOS allows' });
    await userEvent.click(screen.getByRole('button', { name: 'All' }));
    await userEvent.click(screen.getByRole('button', { name: 'All deviations' }));
    expect(
      within(screen.getByRole('region', { name: 'Play types' })).getByText(
        '2025-26 season · sample not reported',
      ),
    ).toBeVisible();
  });
});

describe('categories the Matchup posts but does not score (statsplus#370)', () => {
  const unscored = { components: {}, blend: null, missing_inputs: [] };
  const openShootingLines = async (markets = ['FG2M', 'FGM', 'FTA', 'FTM', 'PTS']) => {
    const raw = JSON.parse(JSON.stringify(rawMatchupPayload));
    const lebron = raw.players[0];
    lebron.posted_markets = markets;
    lebron.provenance = { dabble: markets };
    const lines = { FG2M: 4.5, FGM: 7.5, FTA: 6.5, FTM: 5.5, PTS: 25.5 };
    lebron.lines = { dabble: Object.fromEntries(markets.map((market) => [market, lines[market]])) };
    lebron.line_prices = { dabble: { FTA: { over: -118, under: -104 } } };
    lebron.scores = Object.fromEntries(
      markets.map((market) => [
        market,
        market === 'PTS' ? lebron.scores.PTS : { season: unscored, last_15: unscored },
      ]),
    );
    fetchMatchup.mockResolvedValueOnce(decodeFetched(raw));
    renderMatchup('/matchups/0022500584?player=2544');
    await screen.findByRole('heading', { name: 'LeBron James', level: 2 });
  };
  const buttonNames = (group) =>
    within(group)
      .getAllByRole('button')
      .map((button) => button.getAttribute('aria-label') ?? button.textContent);

  test('reads in box-score order under their full names', async () => {
    await openShootingLines();

    expect(buttonNames(screen.getByRole('group', { name: 'Market' }))).toEqual([
      'All',
      'PTS',
      'Field Goals Made',
      'Two-Pointers Made',
      'Free Throws Attempted',
      'Free Throws Made',
    ]);
    expect(
      buttonNames(screen.getByRole('group', { name: 'Selection log stat' })).slice(0, 5),
    ).toEqual([
      'PTS',
      'Field Goals Made',
      'Two-Pointers Made',
      'Free Throws Attempted',
      'Free Throws Made',
    ]);
  });

  test('shows the posted Dabble line and prices with no Matchup Score', async () => {
    await openShootingLines();

    const strip = within(screen.getByRole('group', { name: 'Selection log stat' }));
    expect(strip.getByRole('button', { name: 'PTS' })).toHaveTextContent('+12.0%');
    expect(
      strip.getByRole('button', { name: 'Free Throws Attempted' }),
    ).toHaveAccessibleDescription(/No Season Matchup Score$/);
    expect(screen.queryByText(/No score components were computable/)).not.toBeInTheDocument();

    await userEvent.click(
      within(screen.getByRole('group', { name: 'Market' })).getByRole('button', {
        name: 'Free Throws Attempted',
      }),
    );

    expect(screen.getByRole('heading', { level: 2, name: /Free Throws Attempted/ })).toBeVisible();
    const row = screen.getByRole('article', { name: 'LeBron James player' });
    expect(row.querySelector('.rail-row-value b')).toHaveTextContent('6.5');
    expect(
      within(row).getByRole('group', {
        name: 'Best Over −118 at Dabble, best Under −104 at Dabble, line 6.5',
      }),
    ).toBeVisible();
    await userEvent.click(
      within(screen.getByRole('group', { name: 'Selection log stat' })).getByRole('button', {
        name: 'Free Throws Attempted',
      }),
    );
    expect(
      within(screen.getByRole('table', { name: 'FTA lines' }))
        .getAllByRole('row')
        .slice(1)
        .map((tableRow) => tableRow.textContent),
    ).toEqual(['Apps', 'Dabble6.5-118-104']);
  });

  test('says a player posted only in unscored categories has no Matchup Score', async () => {
    await openShootingLines(['FTA', 'FTM']);

    const panel = screen.getByRole('region', { name: 'Matchup Score' });
    expect(panel).toHaveTextContent('FTA Matchup Score—No Matchup Score for FTA in Season.');
    await userEvent.click(
      within(screen.getByRole('group', { name: 'Selection log stat' })).getByRole('button', {
        name: 'Free Throws Made',
      }),
    );
    expect(panel).toHaveTextContent('No Matchup Score for FTM in Season.');
  });

  test('says an unscored tab has no Defense Sheet rows, whatever the controls', async () => {
    await openShootingLines();
    await userEvent.click(
      within(screen.getByRole('group', { name: 'Market' })).getByRole('button', {
        name: 'Free Throws Attempted',
      }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'All deviations' }));

    const sheet = screen.getByRole('region', { name: 'What BOS allows' });
    expect(
      within(sheet).getByText(
        'Free Throws Attempted has no Matchup Score or Defense Sheet rows. Posted lines are in the rail.',
      ),
    ).toBeVisible();
    expect(
      within(sheet).queryByText('No Defense Sheet rows match these controls.'),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: 'Targetable players' })).toHaveTextContent(
      /By season points/,
    );
    expect(screen.queryByText(/By season scoring/)).not.toBeInTheDocument();
  });

  test('keeps the controls message on a scored tab the controls empty', async () => {
    await openShootingLines();
    await userEvent.click(
      within(screen.getByRole('group', { name: 'Market' })).getByRole('button', { name: 'PTS' }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'At least 2 sigma' }));

    const sheet = screen.getByRole('region', { name: 'What BOS allows' });
    expect(within(sheet).getByText('No Defense Sheet rows match these controls.')).toBeVisible();
    expect(within(sheet).queryByText(/has no Matchup Score/)).not.toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: 'Targetable players' })).toHaveTextContent(
      /By season scoring/,
    );
  });
});

describe('Matchup Score coverage from a statsplus#407 backend', () => {
  const cell = (value) => ({ value, thin: false });
  const scored = (components, blend) => ({ components, blend });
  const empty = { components: {}, blend: null, missing_inputs: [] };
  const openCoverage = async () => {
    const raw = JSON.parse(JSON.stringify(rawMatchupPayload));
    const markets = ['PTS', 'TOV', 'FTA', 'FTM'];
    const lebron = raw.players[0];
    lebron.posted_markets = markets;
    lebron.provenance = { dabble: markets };
    lebron.lines = { dabble: { PTS: 25.5, TOV: 3.5, FTA: 6.5, FTM: 5.5 } };
    lebron.scores = {
      PTS: {
        season: scored({ play_types: cell(0.08), traditional: cell(0.06) }, cell(0.07)),
        last_15: scored({ play_types: cell(-0.03), traditional: cell(0.01) }, cell(-0.01)),
      },
      TOV: {
        season: scored({ traditional: cell(0.05) }, cell(0.05)),
        last_15: scored({ traditional: cell(0.02) }, cell(0.02)),
      },
      FTA: {
        season: scored({ traditional: cell(-0.11) }, cell(-0.11)),
        last_15: scored({ traditional: cell(-0.09) }, cell(-0.09)),
      },
      FTM: { season: empty, last_15: empty },
    };
    raw.league.defense_sheet.traditional = [
      {
        key: 'OPP_FTA',
        season: { average_allowed_per_48: 24, sigma: 2 },
        last_15: { average_allowed_per_48: 24.5, sigma: 2.2 },
      },
    ];
    raw.teams[1].defense_sheet.traditional = [
      {
        key: 'OPP_FTA',
        label: 'OPP FTA',
        markets: ['FTA'],
        season: {
          allowed_per_48: 21.4,
          percent_vs_league_average: -11,
          sigma_deviation: -1.3,
          rank: 3,
        },
        last_15: {
          allowed_per_48: 22.3,
          percent_vs_league_average: -9,
          sigma_deviation: -1,
          rank: 6,
        },
      },
    ];
    fetchMatchup.mockResolvedValueOnce(decodeFetched(raw));
    renderMatchup('/matchups/0022500584?player=2544');
    await screen.findByRole('heading', { name: 'LeBron James', level: 2 });
  };

  test('scores PTS from its Blend, TOV with a Blend and FTA from its Traditional row', async () => {
    await openCoverage();

    const strip = within(screen.getByRole('group', { name: 'Selection log stat' }));
    const score = (name) => strip.getByRole('button', { name }).querySelector('small');
    expect(
      ['PTS', 'TOV', 'Free Throws Attempted', 'Free Throws Made'].map(
        (name) => score(name).textContent,
      ),
    ).toEqual([
      '+7.0% Season Matchup Score',
      '+5.0% Season Matchup Score',
      '−11.0% Season Matchup Score',
      '—No Season Matchup Score',
    ]);

    await userEvent.click(strip.getByRole('button', { name: 'Free Throws Attempted' }));
    const traditional = within(screen.getByRole('region', { name: 'Matchup Score' })).getByRole(
      'list',
      { name: 'Traditional' },
    );
    expect(traditional).toHaveTextContent('BOS: free throw attempts allowed per 483rd−11%');
  });

  test('lists the FT attempts row on the FTA Defense Sheet', async () => {
    await openCoverage();
    await userEvent.click(
      within(screen.getByRole('group', { name: 'Market' })).getByRole('button', {
        name: 'Free Throws Attempted',
      }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'All deviations' }));

    const sheet = screen.getByRole('region', { name: 'What BOS allows' });
    expect(within(sheet).getByText('FT attempts')).toBeVisible();
    expect(within(sheet).queryByText(/has no Matchup Score/)).not.toBeInTheDocument();
  });
});

describe('statsplus#395: the rail shows his Matchup Score and a Last 5 that leads to his game logs', () => {
  const game = (date, stats) => ({
    gameId: `g-${date}`,
    gameDate: date,
    matchup: 'LAL vs. PHX',
    minutes: 34,
    stats,
  });
  const served = () => {
    const candidate = JSON.parse(JSON.stringify(matchup));
    const lebron = candidate.players.find((player) => player.id === 2544);
    // Headline 27.5 (PrizePicks); oldest first.
    lebron.lastFiveGames = [
      game('2026-01-04', { PTS: 30, FGA: 21 }),
      game('2026-01-06', { PTS: 22, FGA: 17 }),
      game('2026-01-08', { PTS: 35, FGA: 24 }),
      game('2026-01-10', { PTS: 27, FGA: 19 }),
      game('2026-01-12', { PTS: 28, FGA: 20 }),
    ];
    lebron.seasonAverages = { PTS: 25.4, FGA: 19.2 };
    lebron.bookLines = { PTS: quote([bookRow('draftkings', 27.5, -114, -108)]) };
    const austin = candidate.players.find((player) => player.id === 1630559);
    // Three games in the Evidence season; no line for FG3A.
    austin.lastFiveGames = [
      game('2026-01-08', { PTS: 24, FG3A: 6 }),
      game('2026-01-10', { PTS: 18, FG3A: 8 }),
      game('2026-01-12', { PTS: 20, FG3A: 5 }),
    ];
    austin.seasonAverages = { PTS: 20.1, FG3A: 6 };
    austin.scores.PTS.season.blend.thin = true;
    return candidate;
  };
  const row = (name) => screen.getByRole('article', { name: `${name} player` });
  const slots = (pill) =>
    [...pill.querySelectorAll('rect')].map((rect) =>
      rect.classList.contains('rail-l5-stub')
        ? 'stub'
        : ['tone-up', 'tone-down', 'tone-flat'].find((tone) => rect.classList.contains(tone)),
    );

  test('AC1-AC3: the name, then his signed score; the line beside his season average', async () => {
    fetchMatchup.mockResolvedValueOnce(fetched(served()));
    renderMatchup();
    await screen.findByRole('heading', { name: 'What BOS allows' });

    const lebron = row('LeBron James');
    const lebronScore = within(lebron).getByRole('img', { name: 'Matchup Score +12%' });
    expect(lebronScore).toHaveTextContent(/^\+12%$/);
    expect(lebronScore).toHaveClass('tone-up');
    expect(lebronScore).not.toHaveClass('thin');
    expect(lebronScore).toHaveAttribute('title', 'Matchup Score +12%');
    expect(lebron.querySelector('.rail-row-value')).toHaveTextContent(/^27\.525\.4 avg$/);

    // A thin score keeps the underline and says so.
    const austinScore = within(row('Austin Reaves')).getByRole('img', {
      name: 'Matchup Score +21% · thin sample',
    });
    expect(austinScore).toHaveClass('thin');
    expect(austinScore).toHaveAttribute('title', 'Matchup Score +21% · thin sample');

    // The name still leads to his game logs, with no arrow.
    const name = within(lebron).getByRole('link', { name: 'LeBron James game logs' });
    expect(name).toHaveTextContent(/^LeBron James$/);
    expect(name.querySelector('svg')).toBeNull();

    // The score follows the window.
    await userEvent.click(screen.getByRole('button', { name: 'Last 15' }));
    expect(within(row('LeBron James')).getByRole('img', { name: 'Matchup Score -1%' })).toHaveClass(
      'tone-down',
    );
  });

  test('AC1: a score that rounds to zero is dim', async () => {
    const candidate = served();
    candidate.players.find((player) => player.id === 2544).scores.PTS = score(0.004);
    fetchMatchup.mockResolvedValueOnce(fetched(candidate));
    renderMatchup();
    await screen.findByRole('heading', { name: 'What BOS allows' });
    expect(within(row('LeBron James')).getByRole('img', { name: 'Matchup Score +0%' })).toHaveClass(
      'tone-flat',
    );
  });

  test('AC4-AC6: the Last 5 pill charts five slots against the line and opens his game logs', async () => {
    fetchMatchup.mockResolvedValueOnce(fetched(served()));
    renderMatchup();
    await screen.findByRole('heading', { name: 'What BOS allows' });

    const lebron = row('LeBron James');
    const pill = within(lebron).getByRole('link', {
      name: "Last 5 points: 30, 22, 35, 27, 28. Open LeBron James's game logs.",
    });
    expect(pill).toHaveTextContent(/^L5$/);
    expect(pill).toHaveAttribute('href', '/?player_name=LeBron+James&season_filter=2025-26');
    expect(pill).toHaveAttribute(
      'href',
      within(lebron).getByRole('link', { name: 'LeBron James game logs' }).getAttribute('href'),
    );
    // Against 27.5: over, under, over, under, over.
    expect(slots(pill)).toEqual(['tone-up', 'tone-down', 'tone-up', 'tone-down', 'tone-up']);
    expect(pill.querySelectorAll('.rail-l5-mark')).toHaveLength(1);
    // Bar heights scale with the value (16px tall at 1.1 × his best game), and the
    // dashed mark sits at the line's height on the same scale.
    const heights = [...pill.querySelectorAll('.rail-l5-bar')].map((bar) =>
      Number(bar.getAttribute('height')).toFixed(2),
    );
    expect(heights).toEqual(['12.47', '9.14', '14.55', '11.22', '11.64']);
    // Every bar stands on the chart's 16px baseline.
    const bases = [...pill.querySelectorAll('.rail-l5-bar')].map((bar) =>
      (Number(bar.getAttribute('y')) + Number(bar.getAttribute('height'))).toFixed(2),
    );
    expect(bases).toEqual(['16.00', '16.00', '16.00', '16.00', '16.00']);
    const mark = pill.querySelector('.rail-l5-mark');
    expect(Number(mark.getAttribute('y1')).toFixed(2)).toBe('4.57');
    expect(mark.getAttribute('y2')).toBe(mark.getAttribute('y1'));
    // The best prices share the row with the pill.
    const prices = within(lebron).getByRole('group', { name: /^Best Over/ });
    expect(prices).toHaveTextContent('o −114 DK u −108 DK');
    expect(pill.parentElement).toContainElement(prices);

    // Two games short: the oldest slots are stubs. Against his 21.5 line.
    const austinPill = within(row('Austin Reaves')).getByRole('link', {
      name: "Last 5 points: 24, 18, 20, 2 games not played. Open Austin Reaves's game logs.",
    });
    expect(slots(austinPill)).toEqual(['stub', 'stub', 'tone-up', 'tone-down', 'tone-down']);
  });

  test('game-log links open on the stat category selected on the Matchup', async () => {
    const candidate = served();
    const austin = candidate.players.find((player) => player.id === 1630559);
    austin.statCategories = ['PTS', '3PM'];
    austin.lastFiveGames = null;
    fetchMatchup.mockResolvedValueOnce(fetched(candidate));
    renderMatchup();
    await screen.findByRole('heading', { name: 'What BOS allows' });

    await userEvent.click(screen.getByRole('button', { name: 'FGA' }));
    const lebron = row('LeBron James');
    expect(within(lebron).getByRole('link', { name: 'LeBron James game logs' })).toHaveAttribute(
      'href',
      '/?player_name=LeBron+James&season_filter=2025-26&line_type=FGA',
    );
    expect(
      within(lebron).getByRole('link', { name: /^Last 5 field goal attempts: / }),
    ).toHaveAttribute('href', '/?player_name=LeBron+James&season_filter=2025-26&line_type=FGA');

    // The Matchup spells made threes 3PM; the game logs spell them FG3M.
    await userEvent.click(screen.getByRole('button', { name: '3PM' }));
    expect(
      within(row('Austin Reaves')).getByRole('link', { name: 'Austin Reaves game logs' }),
    ).toHaveAttribute('href', '/?player_name=Austin+Reaves&season_filter=2025-26&line_type=FG3M');
  });

  test('AC3, AC5: with no line the bars measure against his season average', async () => {
    fetchMatchup.mockResolvedValueOnce(fetched(served()));
    renderMatchup();
    await screen.findByRole('heading', { name: 'What BOS allows' });
    await userEvent.click(screen.getByRole('button', { name: 'FG3A' }));

    const austin = row('Austin Reaves');
    expect(austin.querySelector('.rail-row-value')).toHaveTextContent(/^6season avg$/);
    const pill = within(austin).getByRole('link', {
      name: "Last 5 three-point attempts: 6, 8, 5, 2 games not played. Open Austin Reaves's game logs.",
    });
    // Equal to the average is dim.
    expect(slots(pill)).toEqual(['stub', 'stub', 'tone-flat', 'tone-up', 'tone-down']);
    // No price line: the pill stands alone.
    expect(within(austin).queryByRole('group', { name: /^Best / })).not.toBeInTheDocument();
  });

  test('AC5: no games in the Evidence season is five stubs', async () => {
    const candidate = served();
    candidate.players.find((player) => player.id === 2544).lastFiveGames = [];
    fetchMatchup.mockResolvedValueOnce(fetched(candidate));
    renderMatchup();
    await screen.findByRole('heading', { name: 'What BOS allows' });
    const pill = within(row('LeBron James')).getByRole('link', {
      name: "Last 5 points: 5 games not played. Open LeBron James's game logs.",
    });
    expect(slots(pill)).toEqual(['stub', 'stub', 'stub', 'stub', 'stub']);
  });

  test('AC7: the pill and name navigate; the rest of the row, score included, opens the card', async () => {
    fetchMatchup.mockResolvedValueOnce(fetched(served()));
    renderMatchup();
    await screen.findByRole('heading', { name: 'What BOS allows' });
    const location = () => screen.getByTestId('location');

    await userEvent.click(
      within(row('Austin Reaves')).getByRole('button', { name: 'Open selection card' }),
    );
    expect(await screen.findByRole('heading', { name: 'Austin Reaves', level: 2 })).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Close selection card' }));
    await waitFor(() => expect(location()).toHaveTextContent(/^\/matchups\/game-1$/));

    await userEvent.click(
      within(row('LeBron James')).getByRole('img', { name: 'Matchup Score +12%' }),
    );
    expect(await screen.findByRole('heading', { name: 'LeBron James', level: 2 })).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Close selection card' }));
    await waitFor(() => expect(location()).toHaveTextContent(/^\/matchups\/game-1$/));

    await userEvent.click(
      within(row('LeBron James')).getByRole('link', { name: /^Last 5 points/ }),
    );
    await waitFor(() =>
      expect(location()).toHaveTextContent('/?player_name=LeBron+James&season_filter=2025-26'),
    );
    expect(
      screen.queryByRole('heading', { name: 'LeBron James', level: 2 }),
    ).not.toBeInTheDocument();
  });

  test('a backend that does not serve them: no pill, and the average is his season scoring on points', async () => {
    renderMatchup();
    await screen.findByRole('heading', { name: 'What BOS allows' });
    const lebron = row('LeBron James');
    expect(within(lebron).queryByRole('link', { name: /^Last 5/ })).not.toBeInTheDocument();
    expect(lebron.querySelector('.rail-row-value')).toHaveTextContent(/^27\.525\.4 avg$/);
    expect(within(lebron).getByRole('img', { name: 'Matchup Score +12%' })).toBeVisible();
  });

  test('AC8: a historical row is unchanged: no score, no pill, the arrow stays', async () => {
    const candidate = historicalMatchup();
    candidate.players.forEach((player) => {
      player.lastFiveGames = [];
      player.seasonAverages = {};
    });
    candidate.players.find((player) => player.id === 1630559).focalGameLine.stats.PTS = 24;
    fetchMatchup.mockResolvedValueOnce(fetched(candidate));
    renderMatchup();

    const austin = await screen.findByRole('article', { name: 'Austin Reaves player' });
    expect(within(austin).queryByRole('img', { name: /^Matchup Score/ })).not.toBeInTheDocument();
    expect(within(austin).queryByRole('link', { name: /^Last 5/ })).not.toBeInTheDocument();
    expect(
      within(austin).getByRole('link', { name: 'Austin Reaves game logs' }).querySelector('svg'),
    ).not.toBeNull();
    // Still measured against his season scoring.
    expect(within(austin).getByText(/\+3\.9 vs his season average/)).toHaveClass('tone-up');
  });
});

test('reads play-type turnovers forced and FT trips allowed under their own markets (statsplus#416)', async () => {
  const candidate = JSON.parse(JSON.stringify(matchup));
  const boston = candidate.teams.find((team) => team.tricode === 'BOS');
  const row = (sliceKey, stat, markets, season, last15) => ({
    key: `${sliceKey}:${stat}`,
    sliceKey,
    label: `${sliceKey} ${stat}`,
    markets,
    season,
    last15,
  });
  boston.defenseSheet.playTypes.push(
    row('Transition', 'TOV', ['TOV'], value(2.9, 21, 1.5, 28), null),
    row('Isolation', 'TOV', ['TOV'], value(1.6, -14, -1.2, 4), null),
    row('Transition', 'FTT', ['FTA', 'FTM'], value(3.4, 17, 1.3, 26), value(3.1, 9, 0.8, 21)),
    row('Isolation', 'FTT', ['FTA', 'FTM'], value(2.2, 30, 1.9, 30), null),
  );
  const lebron = candidate.players.find((player) => player.id === 2544);
  lebron.postedMarkets.push('TOV', 'FTA');
  lebron.statCategories.push('TOV', 'FTA');
  lebron.provenance.prizepicks.push('TOV', 'FTA');
  fetchMatchup.mockResolvedValueOnce(fetched(candidate));
  renderMatchup();
  await screen.findByRole('heading', { name: 'What BOS allows' });
  const playTypes = () => screen.getByRole('region', { name: 'Play types' });
  const columns = () =>
    [...playTypes().querySelectorAll('.sheet-base-head > span:not(.sheet-season)')].map(
      (column) => column.textContent,
    );
  await userEvent.click(screen.getByRole('button', { name: 'All deviations' }));

  expect(columns()).toEqual(['Points']);
  expect(sheetRow('Isolation')).toHaveTextContent(/^Isolation\+2%/);

  await userEvent.click(screen.getByRole('button', { name: 'TOV' }));
  expect(columns()).toEqual(['Turnovers forced']);
  expect(sheetRow('Transition')).toHaveTextContent(/^Transition\+21%/);
  expect(sheetRow('Isolation')).toHaveTextContent(/^Isolation−14%/);

  await userEvent.click(screen.getByRole('button', { name: 'Free Throws Attempted' }));
  expect(columns()).toEqual(['FT trips allowed']);
  expect(
    within(playTypes())
      .getAllByRole('article')
      .map((item) => item.textContent),
  ).toEqual([expect.stringMatching(/^Isolation\+30%/), expect.stringMatching(/^Transition\+17%/)]);

  await userEvent.click(screen.getByRole('button', { name: 'All' }));
  expect(columns()).toEqual(['Points', 'Turnovers forced', 'FT trips allowed']);
  expect(sheetRow('Transition')).toHaveTextContent(/^Transition\+12%.*\+21%.*\+17%/);

  await userEvent.click(screen.getByRole('button', { name: 'Last 15' }));
  expect(columns()).toEqual(['Points', 'FT trips allowed']);
  expect(
    screen.getByText(
      'Opponent play-type turnovers forced and isolation FT trips allowed unavailable for Last 15.',
    ),
  ).toBeVisible();

  await userEvent.click(screen.getByRole('button', { name: 'TOV' }));
  expect(
    screen.getByText('Opponent play-type turnovers forced unavailable for Last 15.'),
  ).toBeVisible();
  expect(within(playTypes()).queryAllByRole('article')).toEqual([]);
  expect(screen.queryByText('No Defense Sheet rows match these controls.')).not.toBeInTheDocument();
});

describe('markets scored with no line in CourtAI’s books (statsplus#457)', () => {
  const openUnpostedBlocks = async (path = '/matchups/0022500584?player=2544') => {
    const raw = JSON.parse(JSON.stringify(rawMatchupPayload));
    raw.players[0].scores.BLK = {
      season: { components: { traditional: { value: 0.07, thin: false } } },
      last_15: { components: { traditional: { value: 0.05, thin: false } } },
    };
    fetchMatchup.mockResolvedValueOnce(decodeFetched(raw));
    renderMatchup(path);
    await screen.findByRole('heading', { name: 'What BOS allows' });
  };
  const stripTab = (market) =>
    within(screen.getByRole('group', { name: 'Selection log stat' })).getByRole('button', {
      name: market,
    });

  test('the strip offers the unposted market with its score, marked no line', async () => {
    await openUnpostedBlocks();

    expect(
      within(screen.getByRole('group', { name: 'Selection log stat' }))
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual([
      'PTSPosted by PrizePicks and UnderdogPPUD+12.0% Season Matchup Score',
      'BLKNot postedno line+7.0% Season Matchup Score',
      'FGAPosted by PrizePicksPP+4.0% Season Matchup Score',
    ]);
    expect(stripTab('BLK')).toHaveAccessibleDescription('Not posted +7.0% Season Matchup Score');
  });

  test('a sportsbook quote for the unposted market is a line, so its row is not marked', async () => {
    const raw = JSON.parse(JSON.stringify(rawMatchupPayload));
    raw.players[0].scores.BLK = {
      season: { components: { traditional: { value: 0.07, thin: false } } },
      last_15: { components: { traditional: { value: 0.05, thin: false } } },
    };
    const decoded = decodeFetched(raw);
    decoded.players[0].bookLines = { BLK: quote([bookRow('fanduel', 0.5, 120, -150)]) };
    fetchMatchup.mockResolvedValueOnce(decoded);
    renderMatchup('/matchups/0022500584?player=2544');
    await screen.findByRole('heading', { name: 'What BOS allows' });

    expect(stripTab('BLK')).not.toHaveTextContent('no line');
    expect(stripTab('BLK')).toHaveTextContent('+7.0%');
  });

  test('picking the unposted tab keeps the card and says what the opponent log covers', async () => {
    await openUnpostedBlocks();

    await userEvent.click(stripTab('BLK'));

    expect(stripTab('BLK')).toHaveAttribute('aria-pressed', 'true');
    expect(
      await screen.findByText(
        'Games vs this opponent covers the markets with a line in CourtAI’s books, so it has no BLK log.',
      ),
    ).toBeVisible();
  });

  test('the market filter offers the unposted market and lists him under it', async () => {
    await openUnpostedBlocks();
    const filter = screen.getByRole('group', { name: 'Market' });

    expect(
      within(filter)
        .getAllByRole('button')
        .map((button) => button.getAttribute('aria-label') ?? button.textContent),
    ).toEqual(['All', 'PTS', 'BLK', 'FGA']);

    await userEvent.click(within(filter).getByRole('button', { name: 'BLK' }));

    expect(screen.getByRole('heading', { level: 2, name: /BLK/ })).toBeVisible();
    const row = screen.getByRole('article', { name: 'LeBron James player' });
    expect(within(row).getByRole('img', { name: 'Matchup Score +7%' })).toBeVisible();
  });

  test('a card opened under the unposted market starts on it', async () => {
    await openUnpostedBlocks('/matchups/0022500584');
    await userEvent.click(
      within(screen.getByRole('group', { name: 'Market' })).getByRole('button', { name: 'BLK' }),
    );

    await userEvent.click(
      within(screen.getByRole('article', { name: 'LeBron James player' })).getByRole('img', {
        name: 'Matchup Score +7%',
      }),
    );

    expect(await screen.findByRole('heading', { name: 'LeBron James', level: 2 })).toBeVisible();
    expect(stripTab('BLK')).toHaveAttribute('aria-pressed', 'true');
    expect(stripTab('PTS')).toHaveAttribute('aria-pressed', 'false');
  });
});

// The browser fixture is an ES module with a JSON import, which Jest does not
// load, so Node reads it and hands back the payload.
const browserMatchup = () =>
  JSON.parse(
    execFileSync(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        `import { matchupPayload } from './e2e/fixtures/courtai-contract.mjs';
         console.log(JSON.stringify(matchupPayload));`,
      ],
      { cwd: process.cwd(), encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
    ),
  );

describe('the player sheet reads like the Player Profile matchup card (statsplus#478)', () => {
  const openLebron = async (edit = () => {}) => {
    const payload = browserMatchup();
    edit(payload.players.find((player) => player.canonical_id === 2544));
    fetchMatchup.mockResolvedValueOnce(decodeFetched(payload));
    renderMatchup('/matchups/0022500584?player=2544');
    await screen.findByRole('heading', { name: 'LeBron James', level: 2 });
  };
  const strip = () => within(screen.getByRole('group', { name: 'Selection log stat' }));
  const card = () => within(screen.getByRole('region', { name: 'Matchup Score' }));
  const rows = (list) =>
    [...card().getByRole('list', { name: list }).querySelectorAll('li')].map(
      (row) => row.textContent,
    );

  test('AC1: the card reads the active stat where his volume comes from, with no Score Matrix', async () => {
    await openLebron();

    expect(screen.queryByRole('table', { name: /Score Matrix/ })).not.toBeInTheDocument();
    expect(card().getByText('PTS Matchup Score')).toBeVisible();
    expect(card().getByText('Where his PTS come from')).toBeVisible();
    expect(rows('Play types')).toEqual(['Transition19%27th+12%', 'Post up2%25th+10%']);
  });

  test('AC2: every tab shows its market’s score for the window, green up and red down', async () => {
    await openLebron();

    const score = (name) => strip().getByRole('button', { name }).querySelector('small').firstChild;
    expect(
      ['PTS', 'REB', 'AST', '3PM', 'PRA', 'TOV', 'BLK'].map((name) => score(name).textContent),
    ).toEqual(['+12.0%', '+13.0%', '+14.0%', '+15.0%', '+19.0%', '+23.0%', '+25.0%']);
    expect(score('PTS').parentElement).toHaveClass('pmc-up');

    await userEvent.click(screen.getByRole('button', { name: 'Last 15' }));

    expect(
      ['PTS', 'REB', 'AST', '3PM', 'PRA', 'TOV', 'BLK'].map((name) => score(name).textContent),
    ).toEqual(['−2.0%', '−1.0%', '0.0%', '+1.0%', '+5.0%', '+9.0%', '+11.0%']);
    expect(score('PTS').parentElement).toHaveClass('pmc-down');
    expect(score('AST').parentElement).not.toHaveClass('pmc-up');
    expect(score('AST').parentElement).not.toHaveClass('pmc-down');
  });

  test('AC3: a combo tab shows W3 grouped by stat, a single tab S4', async () => {
    await openLebron();

    await userEvent.click(strip().getByRole('button', { name: 'PRA' }));

    expect(card().getByText('PRA vs BOS')).toBeVisible();
    expect(
      ['Points', 'Assists', 'Rebounds'].map(
        (stat) =>
          card().getByRole('region', { name: stat }).querySelector('.pmc-w3-head').textContent,
      ),
    ).toEqual([
      'Points · 62% of his PRA+7.5%',
      'Assists · 20% of his PRA+2.8%',
      'Rebounds · 18% of his PRA+2.3%',
    ]);
    expect(card().queryByText('Where his PRA come from')).not.toBeInTheDocument();

    await userEvent.click(strip().getByRole('button', { name: 'AST' }));

    expect(card().getByText('Where his AST come from')).toBeVisible();
    expect(card().getByText('Assist locations')).toBeVisible();
    expect(card().queryByText('AST vs BOS')).not.toBeInTheDocument();
  });

  test('AC4: Last 15 moves the scores and contributions; the slices stay season', async () => {
    await openLebron();
    await userEvent.click(strip().getByRole('button', { name: 'PRA' }));
    const points = () => card().getByRole('region', { name: 'Points' });
    expect(card().getByTitle('PRA Season Matchup Score')).toHaveTextContent('+19.0%');
    expect(points()).toHaveTextContent('Points · 62% of his PRA+7.5%');

    await userEvent.click(screen.getByRole('button', { name: 'Last 15' }));

    expect(card().getByTitle('PRA Last 15 Matchup Score')).toHaveTextContent('+5.0%');
    expect(points()).toHaveTextContent('Points · 62% of his PRA−1.2%');

    await userEvent.click(strip().getByRole('button', { name: 'PTS' }));
    expect(rows('Play types')).toEqual(['Transition19%27th+12%', 'Post up2%25th+10%']);
  });

  test('each tab names its score and window to assistive tech', async () => {
    await openLebron();

    expect(strip().getByRole('button', { name: 'PTS' })).toHaveAccessibleDescription(
      /\+12\.0% Season Matchup Score$/,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Last 15' }));
    expect(strip().getByRole('button', { name: 'PTS' })).toHaveAccessibleDescription(
      /−2\.0% Last 15 Matchup Score$/,
    );
  });

  test('a combo missing one of its season averages is not split by stat', async () => {
    await openLebron((lebron) => {
      delete lebron.season_averages.REB;
    });

    await userEvent.click(strip().getByRole('button', { name: 'PRA' }));

    expect(card().getByTitle('PRA Season Matchup Score')).toHaveTextContent('+19.0%');
    expect(
      card().getByText(
        'PRA is not split by stat: this Matchup carries no season averages of PTS, REB, AST to weight them by.',
      ),
    ).toBeVisible();
    expect(card().queryByRole('region', { name: 'Points' })).not.toBeInTheDocument();
    expect(card().queryByText('Where his PRA come from')).not.toBeInTheDocument();
  });
});

describe('statsplus#479: the Matchup settings live in its URL', () => {
  const BrowserBack = () => {
    const navigate = useNavigate();
    return (
      <button type="button" onClick={() => navigate(-1)}>
        Browser back
      </button>
    );
  };
  const renderAfterSlate = (path) =>
    render(
      <MemoryRouter initialEntries={['/matchups', path]} initialIndex={1}>
        <Routes>
          <Route path="/matchups" element={<p>The Slate</p>} />
          <Route path="/matchups/:gameId" element={<MatchupDetailPage />} />
          <Route path="/" element={<p>Game Logs</p>} />
        </Routes>
        <LocationProbe />
        <BrowserBack />
      </MemoryRouter>,
    );
  const location = () => screen.getByTestId('location').textContent;
  const pressed = (group) =>
    within(screen.getByRole('group', { name: group }))
      .getAllByRole('button')
      .filter((button) => button.getAttribute('aria-pressed') === 'true')
      .map((button) => button.textContent);
  const settings = () => ({
    team: pressed('Defense team'),
    window: pressed('Stat window'),
    deviation: pressed('Deviation filter'),
    market: pressed('Market'),
  });
  const click = (group, name) =>
    userEvent.click(
      within(screen.getByRole('group', { name: group })).getByRole('button', { name }),
    );

  test('Back from Game Logs reopens the Matchup with every setting and the open card', async () => {
    fetchMatchupSelection.mockImplementation(() => new Promise(() => {}));
    renderAfterSlate('/matchups/game-1?player=2544');
    await screen.findByRole('heading', { name: 'LeBron James', level: 2 });

    await click('Defense team', /^LAL defense/);
    await click('Stat window', 'Last 15');
    await click('Deviation filter', 'At least 2 sigma');
    await click('Market', 'REB');
    expect(location()).toBe(
      '/matchups/game-1?player=2544&team=1&window=last15&deviation=2&stat=REB',
    );

    await userEvent.click(screen.getByRole('link', { name: 'Jayson Tatum game logs' }));
    expect(await screen.findByText('Game Logs')).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Browser back' }));

    expect(await screen.findByRole('heading', { name: 'LeBron James', level: 2 })).toBeVisible();
    expect(location()).toBe(
      '/matchups/game-1?player=2544&team=1&window=last15&deviation=2&stat=REB',
    );
    expect(settings()).toEqual({
      team: ['LAL defensevs BOS players'],
      window: ['Last 15'],
      deviation: ['At least 2 sigma'],
      market: ['REB'],
    });

    // The settings replaced the Matchup's entry rather than stacking their own.
    await userEvent.click(screen.getByRole('button', { name: 'Browser back' }));
    expect(await screen.findByText('The Slate')).toBeVisible();
  });

  test('a link carrying the settings opens with them', async () => {
    renderAfterSlate('/matchups/game-1?team=1&window=last15&deviation=0&stat=REB');
    await screen.findByRole('heading', { name: 'What LAL allows' });
    expect(settings()).toEqual({
      team: ['LAL defensevs BOS players'],
      window: ['Last 15'],
      deviation: ['All deviations'],
      market: ['REB'],
    });
  });

  test('unknown values open on the defaults', async () => {
    renderAfterSlate('/matchups/game-1?team=99&window=last99&deviation=7&stat=NOPE');
    await screen.findByRole('heading', { name: 'What BOS allows' });
    expect(settings()).toEqual({
      team: ['BOS defensevs LAL players'],
      window: ['Season'],
      deviation: ['At least 1 sigma'],
      market: ['PTS'],
    });
  });

  test('a stat the selected side lacks falls back to its opening stat', async () => {
    renderAfterSlate('/matchups/game-1?team=1&stat=PTS');
    await screen.findByRole('heading', { name: 'What LAL allows' });
    expect(pressed('Market')).toEqual(['All']);

    await click('Defense team', /^BOS defense/);
    expect(pressed('Market')).toEqual(['PTS']);
    expect(location()).toBe('/matchups/game-1?stat=PTS');
  });

  test('default settings leave the URL bare', async () => {
    renderAfterSlate('/matchups/game-1');
    await screen.findByRole('heading', { name: 'What BOS allows' });
    expect(location()).toBe('/matchups/game-1');

    await click('Stat window', 'Last 15');
    await click('Deviation filter', 'All deviations');
    await click('Market', 'All');
    await click('Defense team', /^LAL defense/);
    expect(location()).toBe('/matchups/game-1?window=last15&deviation=0&stat=All&team=1');

    await click('Defense team', /^BOS defense/);
    await click('Market', 'PTS');
    await click('Deviation filter', 'At least 1 sigma');
    await click('Stat window', 'Season');
    expect(location()).toBe('/matchups/game-1');
  });
});

describe('the player sheet as a pop-up over the page (statsplus#481)', () => {
  let go;
  const Page = () => {
    go = useNavigate();
    return <MatchupDetailPage />;
  };

  test('browser Back closes the sheet it opened', async () => {
    render(
      <MemoryRouter
        initialEntries={['/matchups/game-1', '/matchups/game-1?player=2544']}
        initialIndex={1}
      >
        <Page />
      </MemoryRouter>,
    );
    await screen.findByRole('dialog', { name: 'LeBron James' });

    await act(async () => {
      go(-1);
    });

    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'LeBron James' })).not.toBeInTheDocument(),
    );
    expect(screen.getByRole('heading', { name: 'What BOS allows' })).toBeVisible();
  });

  test('Feedback opened before Back reopens the sheet keeps its focus', async () => {
    const { FeedbackProvider } = require('../feedback/FeedbackContext');
    const FeedbackButton = require('../feedback/FeedbackButton').default;
    render(
      <MemoryRouter
        initialEntries={['/matchups/game-1?player=2544', '/matchups/game-1']}
        initialIndex={1}
      >
        <FeedbackProvider>
          <FeedbackButton />
          <Page />
        </FeedbackProvider>
      </MemoryRouter>,
    );
    await screen.findByRole('heading', { name: 'What BOS allows' });
    await userEvent.click(screen.getByRole('button', { name: 'Feedback' }));
    const box = screen.getByRole('textbox', { name: 'Your feedback' });
    await userEvent.type(box, 'Draft feedback');

    await act(async () => {
      go(-1);
    });
    await screen.findByRole('dialog', { name: 'LeBron James' });
    box.focus();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    expect(box).toHaveFocus();
    expect(box).toHaveValue('Draft feedback');
  });
});

describe('a Rotation Player with no line in CourtAI’s books (crf04/statsplus#459)', () => {
  const rotationMatchup = (raw = JSON.parse(JSON.stringify(rawMatchupPayload))) => {
    raw.game.away_team.targetable_player_count = 1;
    const lebron = raw.players.find((player) => player.canonical_id === 2544);
    raw.players.push({
      canonical_id: 1001,
      name: 'Rotation Guy',
      team_id: lebron.team_id,
      tricode: lebron.tricode,
      player_source: 'rotation',
      stat_categories: [],
      focal_game_line: null,
      posted_markets: [],
      provenance: {},
      lines: {},
      line_prices: {},
      book_lines: {},
      season_scoring: 5,
      last_five_games: [
        {
          game_id: '0022500106',
          game_date: '2026-01-13',
          matchup: 'LAL @ MIA',
          minutes: 12,
          stats: {},
        },
      ],
      season_averages: {},
      last_10_minutes: [12, 14],
      diet_shares: lebron.diet_shares,
      injury_badge_ref: null,
      // Scored in a market nobody in the pool is: rebounds.
      scores: { ...lebron.scores, REB: lebron.scores.PTS },
    });
    return decodeFetched(raw);
  };
  const rotationRow = () => screen.getByRole('article', { name: 'Rotation Guy player' });

  test('the rail lists him under every scored market, marked no line, and counts him apart', async () => {
    fetchMatchup.mockResolvedValueOnce(rotationMatchup());
    renderMatchup('/matchups/0022500584');

    const rail = await screen.findByRole('complementary', { name: 'Players' });
    expect(rail).toHaveTextContent('By season scoring · 1 with a line, 1 without');
    expect(railNames()).toEqual(['LeBron James', 'Rotation Guy']);
    expect(within(rotationRow()).getByText('no line')).toHaveAttribute(
      'title',
      'No line in CourtAI’s books',
    );
    expect(
      within(screen.getByRole('article', { name: 'LeBron James player' })).queryByText('no line'),
    ).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: categoryLabel('REB') }));

    expect(railNames()).toEqual(['Rotation Guy']);
    expect(within(rotationRow()).getByText('no line')).toBeVisible();
  });

  test('a Matchup with no Rotation Player keeps the targetable rail', async () => {
    const raw = JSON.parse(JSON.stringify(rawMatchupPayload));
    raw.game.away_team.targetable_player_count = 1;
    fetchMatchup.mockResolvedValueOnce(decodeFetched(raw));
    renderMatchup('/matchups/0022500584');

    const rail = await screen.findByRole('complementary', { name: 'Targetable players' });
    expect(rail).toHaveTextContent('By season scoring · 1 targetable returned');
    expect(within(rail).queryByText('no line')).not.toBeInTheDocument();
  });

  test.each([
    ['a deep link', '/matchups/0022500584?player=1001', async () => {}],
    [
      'his rail row',
      '/matchups/0022500584',
      async () => {
        await screen.findByRole('complementary', { name: 'Players' });
        await userEvent.click(
          within(rotationRow()).getByRole('button', { name: /selection card/ }),
        );
      },
    ],
  ])(
    'opened from %s, his card shows scores, Diet and no line, with no Selection request',
    async (_name, path, open) => {
      // The browser fixture carries the Defense Sheet his Diet is read against.
      fetchMatchup.mockResolvedValueOnce(rotationMatchup(browserMatchup()));
      renderMatchup(path);
      await open();

      const dialog = await screen.findByRole('dialog', { name: 'Rotation Guy' });
      expect(fetchMatchupSelection).not.toHaveBeenCalled();
      expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument();
      expect(within(dialog).queryByRole('status')).not.toBeInTheDocument();
      expect(normalized(within(dialog).getByText(/^LAL @ BOS/))).toMatch(
        /No line in CourtAI’s books\.$/,
      );
      const score = within(within(dialog).getByRole('region', { name: 'Matchup Score' }));
      expect(score.getByText('PTS Matchup Score')).toBeVisible();
      expect(score.getByText('+12.0%')).toBeVisible();
      expect(score.getByText('Where his PTS come from')).toBeVisible();
      expect(within(dialog).getByRole('region', { name: 'Lines' })).toHaveTextContent(
        'Lines · PTSNo line in CourtAI’s books.',
      );
      expect(
        within(dialog).getByRole('region', { name: 'Games vs this opponent' }),
      ).toHaveTextContent(
        'covers the markets with a line in CourtAI’s books, so it has no PTS log',
      );
    },
  );
});
