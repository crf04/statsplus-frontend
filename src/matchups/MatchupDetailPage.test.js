import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { fetchMatchup, fetchMatchupSelection } from './matchupApi';
import MatchupDetailPage from './MatchupDetailPage';

jest.mock('../contexts/AuthContext');
jest.mock('./matchupApi');

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
const unavailableScore = (missingInputs) => ({
  season: { components: {}, blend: null, missingInputs },
  last15: { components: {}, blend: null, missingInputs },
});

const matchup = {
  game: {
    gameId: 'game-1',
    away: { tricode: 'LAL' },
    home: { tricode: 'BOS' },
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
      defenseSheet: { playTypes: [] },
      defensiveColumns,
    },
    {
      teamId: 2,
      tricode: 'BOS',
      name: 'Boston Celtics',
      defenseSheet: {
        playTypes: [
          {
            key: 'transition',
            sliceKey: 'transition',
            label: 'Transition',
            markets: ['PTS', 'FGA'],
            season: value(18.4, 12.34, 1.4, 27),
            last15: value(15.2, -8.26, -1.1, 5),
          },
          {
            key: 'isolation',
            sliceKey: 'isolation',
            label: 'Isolation',
            markets: ['PTS'],
            season: value(8.1, 2, 0.4, 16),
            last15: value(8.4, 4, 0.5, 18),
          },
          {
            key: 'above-break',
            sliceKey: 'above-break',
            label: 'Above-break three',
            markets: ['FG3A'],
            season: value(10.2, -11, -1.3, 3),
            last15: value(11, -6, -0.7, 9),
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
      seasonScoring: 20.1,
      last10Minutes: [32, 35, 34],
      injuryBadgeRef: 'injury-1',
      dietShares: {
        playTypes: [
          {
            key: 'transition',
            season: { share: 0.18, volumePerGame: 4 },
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
      seasonScoring: 25.4,
      last10Minutes: [35, 36, 38],
      injuryBadgeRef: null,
      dietShares: {
        playTypes: [
          {
            key: 'transition',
            season: { share: 0.19, volumePerGame: 5 },
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
      seasonScoring: 27.2,
      last10Minutes: [36, 37, 38],
      injuryBadgeRef: null,
      dietShares: { playTypes: [] },
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

beforeEach(() => {
  jest.clearAllMocks();
  useAuth.mockReturnValue({ isAuthenticated: true, loading: false });
  fetchMatchup.mockResolvedValue(matchup);
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
  expect(lebronLink).toHaveAttribute('href', '/?player_name=LeBron+James');
  expect(reavesLink).toHaveAttribute('href', '/?player_name=Austin+Reaves');
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
  await screen.findByRole('heading', { name: 'BOS Defense Sheet' });
  expect(screen.queryByRole('note', { name: 'Preseason matchup caveat' })).not.toBeInTheDocument();
  regular.unmount();

  fetchMatchup.mockResolvedValueOnce({
    ...matchup,
    game: { ...matchup.game, preseason: true },
  });
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
  render(
    <MemoryRouter initialEntries={['/matchups/game-1']}>
      <Routes>
        <Route path="/matchups/:gameId" element={<MatchupDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );

  expect(await screen.findByRole('heading', { name: 'BOS Defense Sheet' })).toBeVisible();
  expect(screen.getByText('Transition')).toBeVisible();
  expect(screen.getByText('Above-break three')).toBeVisible();
  expect(screen.queryByText('Isolation')).not.toBeInTheDocument();
  expect(screen.getByText('1 row hidden near league average.')).toBeVisible();
  expect(screen.getByText('+12.3% vs league')).toBeVisible();
  expect(
    screen.queryByRole('heading', { name: 'Traditional defensive columns' }),
  ).not.toBeInTheDocument();
  expect(screen.getByText(/19% poss/)).toBeVisible();
  expect(screen.getByText(/Austin Reaves · 18% poss/)).toBeVisible();
  expect(screen.getAllByRole('article', { name: /player/i })[0]).toHaveTextContent('LeBron James');
  expect(
    within(screen.getByRole('article', { name: 'LeBron James player' })).getByLabelText(
      'PTS from prizepicks, underdog',
    ),
  ).toBeVisible();

  await userEvent.click(screen.getByRole('button', { name: 'Last 15' }));
  expect(screen.getByText('-8.3% vs league')).toBeVisible();
  expect(screen.getByText(/19% poss/)).toBeVisible();
  expect(fetchMatchup).toHaveBeenCalledTimes(1);

  await userEvent.click(screen.getByRole('button', { name: 'FGA' }));
  expect(screen.getByText('Transition')).toBeVisible();
  expect(screen.queryByText('Above-break three')).not.toBeInTheDocument();
  expect(screen.queryByText(/Austin Reaves · 18% poss/)).not.toBeInTheDocument();

  await userEvent.click(screen.getByRole('button', { name: 'PTS' }));
  expect(screen.getByText(/Austin Reaves · 18% poss/)).toBeVisible();

  await userEvent.click(screen.getByRole('button', { name: 'All' }));
  await userEvent.click(screen.getByRole('button', { name: 'All deviations' }));
  expect(screen.getByText('Isolation')).toBeVisible();
  expect(screen.getByText('+4.0% vs league')).toBeVisible();
  expect(fetchMatchup).toHaveBeenCalledTimes(1);
});

test('selection keeps All active and uses only the delivered Season Diet Share', async () => {
  const candidate = JSON.parse(JSON.stringify(matchup));
  candidate.players.find((player) => player.id === 2544).dietShares.playTypes[0].season = {
    share: 0.02,
    volumePerGame: 5,
  };
  fetchMatchup.mockResolvedValueOnce(candidate);
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
  expect(screen.getByRole('button', { name: 'All', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  expect(screen.getByText('Transition').closest('article')).not.toHaveClass('selection-why');
  await userEvent.click(screen.getByRole('button', { name: 'Last 15' }));
  expect(screen.getByText('Transition').closest('article')).not.toHaveClass('selection-why');
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
      key: 'paint-assists',
      sliceKey: 'paint-assists',
      label: 'Paint assists',
      markets: ['AST'],
      season: value(11, 13, 1.5, 28),
      last15: value(10, 9, 1.1, 24),
    },
  ];
  fetchMatchup.mockResolvedValueOnce(candidate);
  render(
    <MemoryRouter initialEntries={['/matchups/game-1']}>
      <Routes>
        <Route path="/matchups/:gameId" element={<MatchupDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
  await screen.findByRole('heading', { name: 'BOS Defense Sheet' });
  await userEvent.click(screen.getByRole('button', { name: 'Last 15' }));
  expect(
    screen.getByText('Play types unavailable for Last 15: provider_unsupported.'),
  ).toBeVisible();
  expect(
    screen.queryByRole('heading', { name: 'Traditional defensive columns' }),
  ).not.toBeInTheDocument();

  await userEvent.click(screen.getByRole('button', { name: 'AST' }));
  expect(
    screen.queryByText('Play types unavailable for Last 15: provider_unsupported.'),
  ).not.toBeInTheDocument();
  expect(screen.getByText('Paint assists')).toBeVisible();
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
        key: 'opponent-rebounds',
        label: 'Opponent rebounds',
        markets: ['REB'],
        season: value(45, -8, -1.2, 4),
        last15: null,
      },
      {
        key: 'opponent-turnovers',
        label: 'Opponent turnovers',
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
  fetchMatchup.mockResolvedValueOnce(candidate);
  render(
    <MemoryRouter initialEntries={['/matchups/game-1']}>
      <Routes>
        <Route path="/matchups/:gameId" element={<MatchupDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
  await screen.findByRole('heading', { name: 'BOS Defense Sheet' });
  await userEvent.click(screen.getByRole('button', { name: 'Last 15' }));
  expect(
    screen.getAllByText('Traditional defense unavailable for Last 15: not_stored.'),
  ).toHaveLength(1);

  await userEvent.click(screen.getByRole('button', { name: 'TOV' }));
  expect(
    screen.getAllByText('Traditional defense unavailable for Last 15: not_stored.'),
  ).toHaveLength(1);

  await userEvent.click(screen.getByRole('button', { name: 'AST' }));
  expect(
    screen.queryByText('Traditional defense unavailable for Last 15: not_stored.'),
  ).not.toBeInTheDocument();
});

test('names an unavailable OPP_REB window without hiding other traditional markets', async () => {
  const candidate = JSON.parse(JSON.stringify(matchup));
  candidate.teams.find((team) => team.tricode === 'BOS').defenseSheet.traditional = [
    {
      key: 'OPP_REB',
      sliceKey: 'OPP_REB',
      label: 'Opponent rebounds',
      markets: ['REB'],
      season: value(45, -8, -1.2, 4),
      last15: null,
    },
    {
      key: 'OPP_TOV',
      sliceKey: 'OPP_TOV',
      label: 'Opponent turnovers',
      markets: ['TOV'],
      season: value(14.8, 10, 1.3, 25),
      last15: value(13.4, 5, 1.1, 22),
    },
  ];
  const lebron = candidate.players.find((player) => player.id === 2544);
  lebron.postedMarkets.push('REB', 'TOV');
  lebron.statCategories.push('REB', 'TOV');
  lebron.provenance.prizepicks.push('REB', 'TOV');
  fetchMatchup.mockResolvedValueOnce(candidate);
  render(
    <MemoryRouter initialEntries={['/matchups/game-1']}>
      <Routes>
        <Route path="/matchups/:gameId" element={<MatchupDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
  await screen.findByRole('heading', { name: 'BOS Defense Sheet' });
  expect(screen.getByText('Opponent rebounds')).toBeVisible();
  expect(screen.getByTitle('Opponent rank 4/30 — 30 allows the most')).toBeVisible();
  await userEvent.click(screen.getByRole('button', { name: 'Last 15' }));

  expect(
    screen.queryByRole('heading', { name: 'Traditional defensive columns' }),
  ).not.toBeInTheDocument();
  expect(screen.getByText('Opponent rebounds unavailable for Last 15.')).toBeVisible();
  expect(screen.getByText('Opponent turnovers')).toBeVisible();
  expect(screen.queryByText('No Defense Sheet rows match these controls.')).not.toBeInTheDocument();

  await userEvent.click(screen.getByRole('button', { name: 'REB' }));
  expect(screen.getAllByText('Opponent rebounds unavailable for Last 15.')).toHaveLength(1);
  expect(screen.queryByTitle('Opponent rank 4/30 — 30 allows the most')).not.toBeInTheDocument();
  expect(screen.queryByText('No Defense Sheet rows match these controls.')).not.toBeInTheDocument();

  await userEvent.click(screen.getByRole('button', { name: 'TOV' }));
  expect(screen.queryByText('Opponent rebounds unavailable for Last 15.')).not.toBeInTheDocument();
  expect(screen.getByText('Opponent turnovers')).toBeVisible();
  expect(screen.queryByRole('heading', { name: 'OPP_TOV' })).not.toBeInTheDocument();
});

test('renders governed traditional sheet rows without duplicate defensive columns', async () => {
  const candidate = JSON.parse(JSON.stringify(matchup));
  candidate.teams.find((team) => team.tricode === 'BOS').defenseSheet.traditional = [
    ['OPP_REB', 'Opponent rebounds', ['REB', 'PR', 'RA', 'PRA'], 45, -1.2],
    ['OPP_TOV', 'Opponent turnovers', ['TOV'], 15.8, 1.3],
    ['OPP_STL', 'Opponent steals', ['STL', 'STKS'], 6.9, -1.1],
    ['OPP_BLK', 'Opponent blocks', ['BLK', 'STKS'], 5.8, 1.4],
  ].map(([key, label, markets, allowed, sigma]) => ({
    key,
    sliceKey: key,
    label,
    markets,
    season: value(allowed, 8, sigma, 22),
    last15: value(allowed - 0.5, 4, sigma, 18),
  }));
  fetchMatchup.mockResolvedValueOnce(candidate);

  render(
    <MemoryRouter initialEntries={['/matchups/game-1']}>
      <Routes>
        <Route path="/matchups/:gameId" element={<MatchupDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
  await screen.findByRole('heading', { name: 'BOS Defense Sheet' });

  const traditionalSheet = screen
    .getByRole('heading', { name: 'Traditional defense' })
    .closest('section');
  expect(within(traditionalSheet).getByText('Opponent rebounds')).toBeVisible();
  expect(within(traditionalSheet).getByText('Opponent turnovers')).toBeVisible();
  expect(within(traditionalSheet).getByText('Opponent steals')).toBeVisible();
  expect(within(traditionalSheet).getByText('Opponent blocks')).toBeVisible();
  expect(
    screen.queryByRole('heading', { name: 'Traditional defensive columns' }),
  ).not.toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'OPP_TOV' })).not.toBeInTheDocument();
});

test('renders neutral relative percentages for nonzero values without directional color', async () => {
  const candidate = JSON.parse(JSON.stringify(matchup));
  const boston = candidate.teams.find((team) => team.tricode === 'BOS');
  boston.defenseSheet.playTypes[0].season = value(7.5, null, 1.4, 1);
  fetchMatchup.mockResolvedValueOnce(candidate);

  render(
    <MemoryRouter initialEntries={['/matchups/game-1']}>
      <Routes>
        <Route path="/matchups/:gameId" element={<MatchupDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
  await screen.findByRole('heading', { name: 'BOS Defense Sheet' });
  await userEvent.click(screen.getByRole('button', { name: 'All deviations' }));
  const transition = screen.getByText('Transition').closest('article');
  expect(transition).toHaveTextContent('7.5');
  expect(transition).toHaveTextContent('1.4σ');
  expect(transition).toHaveTextContent('vs league: unavailable (not comparable)');
  expect(transition).not.toHaveTextContent('null%');
  expect(transition.querySelector('.relative-over, .relative-under')).not.toBeInTheDocument();
  expect(transition.querySelector('.relative-neutral > strong')).toHaveTextContent('7.5');
  expect(
    within(transition).getByText('vs league: unavailable (not comparable)'),
  ).not.toHaveAttribute('class');
});

test('renders nullable season scoring and explains zero-component offensive scores', async () => {
  const candidate = JSON.parse(JSON.stringify(matchup));
  const lebron = candidate.players.find((player) => player.id === 2544);
  lebron.seasonScoring = null;
  lebron.scores.FGA.last15 = { components: {}, blend: null, missingInputs: [] };
  fetchMatchup.mockResolvedValueOnce(candidate);
  render(
    <MemoryRouter initialEntries={['/matchups/game-1?player=2544']}>
      <Routes>
        <Route path="/matchups/:gameId" element={<MatchupDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
  const card = await screen.findByRole('article', { name: 'LeBron James player' });
  expect(card).toHaveTextContent('Season scoring unavailable');
  await userEvent.click(screen.getByRole('button', { name: 'Last 15' }));
  expect(screen.getByText('No score components were computable for FGA in Last 15.')).toBeVisible();
});

test('a late selection response cannot replace a newer player selection', async () => {
  let resolveFirst;
  const first = new Promise((resolve) => {
    resolveFirst = resolve;
  });
  const austin = {
    playerId: 1630559,
    h2h: { thin: false, rows: [] },
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
  resolveFirst({
    playerId: 2544,
    h2h: { thin: false, rows: [] },
    archetype: { thin: false, rows: [] },
  });
  await waitFor(() =>
    expect(screen.getByRole('heading', { name: 'Austin Reaves', level: 2 })).toBeVisible(),
  );
});

test('sorts the active market by delivered Matchup Score and scopes tabs to the displayed side', async () => {
  render(
    <MemoryRouter initialEntries={['/matchups/game-1']}>
      <Routes>
        <Route path="/matchups/:gameId" element={<MatchupDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
  await screen.findByRole('heading', { name: 'BOS Defense Sheet' });
  expect(screen.queryByRole('button', { name: 'REB' })).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'PTS' }));
  expect(screen.getAllByRole('article', { name: /player/i })[0]).toHaveTextContent('LeBron James');
  await userEvent.click(screen.getByRole('button', { name: 'Matchup Score' }));
  expect(screen.getAllByRole('article', { name: /player/i })[0]).toHaveTextContent('Austin Reaves');

  await userEvent.click(screen.getByRole('button', { name: 'LAL defense' }));
  expect(await screen.findByRole('button', { name: 'REB' })).toBeVisible();
  expect(screen.queryByRole('button', { name: 'FGA' })).not.toBeInTheDocument();
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'All', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    ),
  );
});

test('renders raw injury statuses and keeps the signed-out shell honest', async () => {
  const { unmount } = render(
    <MemoryRouter initialEntries={['/matchups/game-1']}>
      <Routes>
        <Route path="/matchups/:gameId" element={<MatchupDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
  expect((await screen.findAllByText('Game-time decision')).length).toBeGreaterThan(0);
  expect(screen.getByText('Left calf soreness')).toBeVisible();

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
  expect(screen.getByRole('table', { name: 'LeBron James Score Matrix' })).toHaveTextContent(
    '+12%',
  );
  expect((await screen.findAllByText('+0.083')).length).toBeGreaterThan(0);
  expect(screen.getByText('No archetype sample data is available.')).toBeVisible();
  expect(screen.getByText('Transition').closest('article')).toHaveClass('selection-why');
  await userEvent.click(
    within(screen.getByRole('group', { name: 'Selection log stat' })).getByRole('button', {
      name: 'FGA',
    }),
  );
  expect((await screen.findAllByText('+0.018')).length).toBeGreaterThan(0);
  expect(fetchMatchupSelection).toHaveBeenCalledTimes(1);
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
    { key: 'Restricted Area', season: { share: 0.27, volumePerGame: 5.1 } },
  ];
  lebron.dietShares.shotTypes = [
    { key: 'Catch and Shoot', season: { share: 0.36, volumePerGame: 4.2 } },
  ];
  fetchMatchup.mockResolvedValueOnce(candidate);

  render(
    <MemoryRouter initialEntries={['/matchups/game-1?player=2544']}>
      <Routes>
        <Route path="/matchups/:gameId" element={<MatchupDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
  await screen.findByRole('heading', { name: 'LeBron James', level: 2 });

  expect(screen.getByText('Restricted Area FGA').closest('article')).toHaveClass('selection-why');
  expect(screen.getByText('Catch and Shoot FG3A').closest('article')).toHaveClass('selection-why');
  expect(screen.getByText(/LeBron James · 27% FGA/)).toBeVisible();
  expect(screen.getByText(/LeBron James · 36% FGA/)).toBeVisible();
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
  await userEvent.click(screen.getByRole('button', { name: 'LAL defense' }));
  expect(screen.getByRole('button', { name: 'LAL defense' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  expect(screen.getByRole('heading', { name: 'Austin Reaves', level: 2 })).toBeVisible();
  expect(screen.getByText(/not opposing the viewed Defense Sheet/)).toBeVisible();
});

test('card stat choices persist while a different global sheet market remains active', async () => {
  render(
    <MemoryRouter initialEntries={['/matchups/game-1']}>
      <Routes>
        <Route path="/matchups/:gameId" element={<MatchupDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
  await screen.findByRole('heading', { name: 'BOS Defense Sheet' });
  const sheetMarkets = within(screen.getByRole('group', { name: 'Market' }));
  await userEvent.click(sheetMarkets.getByRole('button', { name: 'PTS' }));
  await userEvent.click(
    within(screen.getByRole('article', { name: 'LeBron James player' })).getByRole('button', {
      name: 'Open selection card',
    }),
  );
  const cardStats = within(await screen.findByRole('group', { name: 'Selection log stat' }));
  await userEvent.click(cardStats.getByRole('button', { name: 'FGA' }));
  expect(cardStats.getByRole('button', { name: 'FGA' })).toHaveAttribute('aria-pressed', 'true');
  expect(sheetMarkets.getByRole('button', { name: 'PTS' })).toHaveAttribute('aria-pressed', 'true');
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

const renderMatchup = (path = '/matchups/game-1') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/matchups/:gameId" element={<MatchupDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );

test('keeps the live Defense Sheet gated on missing legacy stats freshness', async () => {
  const candidate = JSON.parse(JSON.stringify(matchup));
  candidate.freshness.stats = { status: 'missing', retrievedAt: null };
  fetchMatchup.mockResolvedValueOnce(candidate);
  renderMatchup();

  expect(await screen.findByRole('heading', { name: 'BOS Defense Sheet' })).toBeVisible();
  expect(screen.getByText('Defense Sheet unavailable because stats are missing.')).toBeVisible();
  expect(screen.queryByText('Transition')).not.toBeInTheDocument();
});

test('renders Season defense from its own Surface while legacy stats freshness is missing', async () => {
  fetchMatchup.mockResolvedValueOnce(historicalMatchup());
  renderMatchup();

  expect(await screen.findByRole('heading', { name: 'BOS Defense Sheet' })).toBeVisible();
  expect(screen.getByText('Transition')).toBeVisible();
  expect(
    screen.queryByText('Defense Sheet unavailable because stats are missing.'),
  ).not.toBeInTheDocument();

  const evidence = screen.getByRole('region', { name: 'Historical matchup evidence' });
  expect(screen.queryByRole('region', { name: 'Matchup data freshness' })).not.toBeInTheDocument();
  expect(evidence).toHaveTextContent('Schedule: Completed-season catalog · from Event Catalog');
  expect(evidence).toHaveTextContent('Participants: Completed-season context · from game logs');
  expect(evidence).toHaveTextContent(
    'Season defense: Completed-season context · from Defense Sheet publication',
  );
  expect(evidence).toHaveTextContent(
    'Last 15 defense: unavailable — No point-in-time snapshot was captured for this game.',
  );

  expect(screen.getByText('Completed-season context')).toBeVisible();
  expect(
    screen.getByText(
      'Season defense provenance: Completed-season context · Defense Sheet publication',
    ),
  ).toBeVisible();
  expect(screen.getByRole('button', { name: 'Last 15' })).toBeDisabled();
  expect(
    screen.getAllByText('No point-in-time snapshot was captured for this game.').length,
  ).toBeGreaterThan(0);
  expect(screen.getByText('No pregame injury snapshot was archived for this game.')).toBeVisible();
  expect(screen.queryByText('Left calf soreness')).not.toBeInTheDocument();
});

test('states schedule collection time as provenance rather than a staleness warning', async () => {
  const candidate = historicalMatchup();
  candidate.experience.sections.schedule.collectedAt = '2026-03-30T04:10:00.000Z';
  fetchMatchup.mockResolvedValueOnce(candidate);
  renderMatchup();

  await screen.findByRole('heading', { name: 'BOS Defense Sheet' });
  const evidence = screen.getByRole('region', { name: 'Historical matchup evidence' });
  expect(evidence).toHaveTextContent(
    'Schedule: Completed-season catalog · from Event Catalog · collected 2026-03-30',
  );
  // The live bars say "<surface> data warning" and age their timestamps. An
  // immutable completed season states neither.
  expect(evidence).not.toHaveTextContent('data warning');
  expect(evidence).not.toHaveTextContent('ago');
  expect(evidence).not.toHaveTextContent('stale');
  expect(screen.queryByText(/schedule: .*, as of/i)).not.toBeInTheDocument();
});

test('labels the historical rail Players in game and switches it with the defense team', async () => {
  fetchMatchup.mockResolvedValueOnce(historicalMatchup());
  renderMatchup();

  const rail = await screen.findByRole('complementary', { name: 'Players in game' });
  expect(within(rail).getByRole('article', { name: 'LeBron James player' })).toBeVisible();
  expect(within(rail).getByRole('article', { name: 'Austin Reaves player' })).toBeVisible();
  expect(
    within(rail).queryByRole('article', { name: 'Jayson Tatum player' }),
  ).not.toBeInTheDocument();
  expect(screen.queryByText('Targetable players')).not.toBeInTheDocument();
  expect(
    screen.queryByRole('group', { name: 'LeBron James posted markets' }),
  ).not.toBeInTheDocument();
  expect(screen.queryByRole('group', { name: 'Market' })).not.toBeInTheDocument();
  expect(screen.getByRole('group', { name: 'Stat category' })).toBeVisible();

  const lebron = within(rail).getByRole('article', { name: 'LeBron James player' });
  expect(lebron).toHaveTextContent('25.4 PPG · completed-season context');
  expect(lebron).toHaveTextContent('Focal game LAL @ BOS · 31.0 MIN · 10.0 PTS · 11.0 FGA');

  await userEvent.click(screen.getByRole('button', { name: 'LAL defense' }));
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

test('treats a withheld score with named missing inputs as unavailable', async () => {
  fetchMatchup.mockResolvedValueOnce(
    withDefensiveScores(historicalMatchup(), ['team_defense:traditional']),
  );
  renderMatchup();

  await screen.findByRole('heading', { name: 'BOS Defense Sheet' });
  await userEvent.click(screen.getByRole('button', { name: 'TOV' }));
  expect(
    screen.getByText('TOV Matchup Score unavailable: missing team_defense:traditional.'),
  ).toBeVisible();

  // 0.44 would outrank every complete score if the component were promoted.
  await userEvent.click(screen.getByRole('button', { name: 'Matchup Score' }));
  const cards = screen.getAllByRole('article', { name: /player$/ });
  expect(cards[0]).toHaveTextContent('LeBron James');
  expect(cards.at(-1)).toHaveTextContent('Austin Reaves');
});

test('keeps a complete defensive score available from its only component', async () => {
  fetchMatchup.mockResolvedValueOnce(withDefensiveScores(historicalMatchup(), []));
  renderMatchup();

  await screen.findByRole('heading', { name: 'BOS Defense Sheet' });
  await userEvent.click(screen.getByRole('button', { name: 'TOV' }));
  expect(screen.queryByText(/TOV Matchup Score unavailable/)).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Matchup Score' }));
  expect(screen.getAllByRole('article', { name: /player$/ })[0]).toHaveTextContent('Austin Reaves');
});

test('keeps a participant with an unavailable score visible, named, and sorted last', async () => {
  const candidate = historicalMatchup();
  candidate.players.find((player) => player.id === 1630559).scores.PTS = unavailableScore([
    'team_defense:play_types',
    'player_diet:shot_zones',
  ]);
  fetchMatchup.mockResolvedValueOnce(candidate);
  renderMatchup();

  await screen.findByRole('heading', { name: 'BOS Defense Sheet' });
  await userEvent.click(screen.getByRole('button', { name: 'PTS' }));
  expect(
    screen.getByText(
      'PTS Matchup Score unavailable: missing team_defense:play_types, player_diet:shot_zones.',
    ),
  ).toBeVisible();

  await userEvent.click(screen.getByRole('button', { name: 'Matchup Score' }));
  const cards = screen.getAllByRole('article', { name: /player$/ });
  expect(cards[0]).toHaveTextContent('LeBron James');
  expect(cards.at(-1)).toHaveTextContent('Austin Reaves');
});

test('refuses to open a dossier for an unavailable participant', async () => {
  const candidate = historicalMatchup();
  candidate.experience.sections.participants = historicalSection(
    'unavailable',
    null,
    null,
    'game_logs_incomplete',
  );
  fetchMatchup.mockResolvedValueOnce(candidate);
  renderMatchup('/matchups/game-1?player=2544');

  await screen.findByRole('heading', { name: 'BOS Defense Sheet' });
  expect(screen.getByText('That player is not available in this matchup.')).toBeVisible();
  expect(screen.queryByRole('heading', { name: 'LeBron James', level: 2 })).not.toBeInTheDocument();
  expect(fetchMatchupSelection).not.toHaveBeenCalled();
});

test('names the missing inputs of a withheld score in the dossier', async () => {
  fetchMatchup.mockResolvedValueOnce(
    withDefensiveScores(historicalMatchup(), ['team_defense:traditional']),
  );
  renderMatchup('/matchups/game-1?player=1630559');

  await screen.findByRole('heading', { name: 'Austin Reaves', level: 2 });
  // The component evidence survives, so the card must say why the score did not.
  expect(screen.getByRole('table', { name: 'Austin Reaves Score Matrix' })).toHaveTextContent(
    '+44%',
  );
  expect(
    screen.getByText('TOV Matchup Score unavailable in Season: missing team_defense:traditional.'),
  ).toBeVisible();
});

test('drops posted-market vocabulary from the historical dossier', async () => {
  fetchMatchup.mockResolvedValueOnce(historicalMatchup());
  renderMatchup('/matchups/game-1?player=2544');

  await screen.findByRole('heading', { name: 'LeBron James', level: 2 });
  const matrix = screen.getByRole('table', { name: 'LeBron James Score Matrix' });
  expect(within(matrix).getByRole('columnheader', { name: 'Category' })).toBeVisible();
  expect(within(matrix).queryByRole('columnheader', { name: 'Market' })).not.toBeInTheDocument();
});

test('keeps posted-market vocabulary in the live dossier', async () => {
  renderMatchup('/matchups/game-1?player=2544');

  await screen.findByRole('heading', { name: 'LeBron James', level: 2 });
  const matrix = screen.getByRole('table', { name: 'LeBron James Score Matrix' });
  expect(within(matrix).getByRole('columnheader', { name: 'Market' })).toBeVisible();
});

test('names an unavailable participant source while the Defense Sheet stays usable', async () => {
  const candidate = historicalMatchup();
  candidate.experience.sections.participants = historicalSection(
    'unavailable',
    null,
    null,
    'game_logs_incomplete',
  );
  fetchMatchup.mockResolvedValueOnce(candidate);
  renderMatchup();

  expect(await screen.findByRole('heading', { name: 'BOS Defense Sheet' })).toBeVisible();
  expect(screen.getByText('Transition')).toBeVisible();
  expect(screen.getByText('Canonical game logs are incomplete for this game.')).toBeVisible();
  expect(screen.queryByRole('article', { name: 'LeBron James player' })).not.toBeInTheDocument();
});

test('separates the focal outcome from hindsight context in the historical dossier', async () => {
  fetchMatchup.mockResolvedValueOnce(historicalMatchup());
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
  expect(
    await screen.findByText('Pregame samples use games strictly before the focal game.'),
  ).toBeVisible();
  expect(
    screen.getByText('Completed-season baseline — hindsight, not pregame evidence.'),
  ).toBeVisible();
  expect(
    screen.getByText('Focal game LAL @ BOS · 2026-03-29 · 31.0 MIN · 10.0 PTS · 11.0 FGA'),
  ).toBeVisible();
  // The dossier is requested for governed Stat Categories, not posted markets.
  expect(fetchMatchupSelection.mock.calls.at(-1).slice(0, 3)).toEqual([
    'game-1',
    2544,
    ['PTS', 'FGA'],
  ]);
});

test('labels the rail Matchup Score order with completed-season context in historical mode', async () => {
  fetchMatchup.mockResolvedValueOnce(historicalMatchup());
  renderMatchup();

  await screen.findByRole('heading', { name: 'BOS Defense Sheet' });
  await userEvent.click(screen.getByRole('button', { name: 'PTS' }));
  await userEvent.click(screen.getByRole('button', { name: 'Matchup Score' }));
  expect(
    screen.getByRole('heading', { name: 'PTS Matchup Score order · completed-season context' }),
  ).toBeVisible();
});

test('does not label the rail Matchup Score order in current mode', async () => {
  render(
    <MemoryRouter initialEntries={['/matchups/game-1']}>
      <Routes>
        <Route path="/matchups/:gameId" element={<MatchupDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );

  await screen.findByRole('heading', { name: 'BOS Defense Sheet' });
  await userEvent.click(screen.getByRole('button', { name: 'PTS' }));
  await userEvent.click(screen.getByRole('button', { name: 'Matchup Score' }));
  expect(screen.getByRole('heading', { name: 'PTS Matchup Score order' })).toBeVisible();
  expect(screen.queryByText(/completed-season context/)).not.toBeInTheDocument();
});

test('labels the historical Score Matrix explainer with completed-season context', async () => {
  fetchMatchup.mockResolvedValueOnce(historicalMatchup());
  renderMatchup('/matchups/game-1?player=2544');

  await screen.findByRole('heading', { name: 'LeBron James', level: 2 });
  expect(screen.getByText(/The Score Matrix reflects completed-season context\./)).toBeVisible();
});

test('does not label the Score Matrix explainer in current mode', async () => {
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
