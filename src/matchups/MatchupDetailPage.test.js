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
  season: { components: {}, blend: { value: season, thin: false } },
  last15: { components: {}, blend: { value: last15, thin: false } },
});

const matchup = {
  game: {
    gameId: 'game-1',
    away: { tricode: 'LAL' },
    home: { tricode: 'BOS' },
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
            label: 'Transition',
            markets: ['PTS', 'FGA'],
            season: value(18.4, 12, 1.4, 27),
            last15: value(15.2, -8, -1.1, 5),
          },
          {
            key: 'isolation',
            label: 'Isolation',
            markets: ['PTS'],
            season: value(8.1, 2, 0.4, 16),
            last15: value(8.4, 4, 0.5, 18),
          },
          {
            key: 'above-break',
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
      id: 'player-two',
      name: 'Austin Reaves',
      teamId: 1,
      tricode: 'LAL',
      postedMarkets: ['PTS', 'FG3A'],
      seasonScoring: 20.1,
      last10Minutes: [32, 35, 34],
      injuryBadgeRef: 'injury-1',
      dietShares: {
        playTypes: [
          {
            key: 'transition',
            season: { share: 0.18, volumePerGame: 4 },
            last15: { share: 0.18, volumePerGame: 5 },
          },
        ],
      },
      scores: { PTS: score(0.21, 0.03), FG3A: score(0.07, 0.02) },
    },
    {
      id: 'player-one',
      name: 'LeBron James',
      teamId: 1,
      tricode: 'LAL',
      postedMarkets: ['PTS', 'FGA'],
      seasonScoring: 25.4,
      last10Minutes: [35, 36, 38],
      injuryBadgeRef: null,
      dietShares: {
        playTypes: [
          {
            key: 'transition',
            season: { share: 0.19, volumePerGame: 5 },
            last15: { share: 0.2, volumePerGame: 5.2 },
          },
        ],
      },
      scores: { PTS: score(0.12, -0.01), FGA: score(0.04, 0.02) },
    },
    {
      id: 'player-three',
      name: 'Jayson Tatum',
      teamId: 2,
      tricode: 'BOS',
      postedMarkets: ['REB'],
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
    playerId: 'player-one',
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
  expect(screen.getByText('+12% vs league')).toBeVisible();
  expect(screen.getByText('14.2 per 48')).toBeVisible();
  expect(screen.getByText(/19% poss/)).toBeVisible();
  expect(screen.getByText(/Austin Reaves · 18% poss/)).toBeVisible();
  expect(screen.getAllByRole('article', { name: /player/i })[0]).toHaveTextContent('LeBron James');

  await userEvent.click(screen.getByRole('button', { name: 'Last 15' }));
  expect(screen.getByText('-8% vs league')).toBeVisible();
  expect(screen.getByText(/20% poss/)).toBeVisible();
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
  expect(fetchMatchup).toHaveBeenCalledTimes(1);
});

test('selection keeps All active and highlights only display-eligible shares for each window', async () => {
  const candidate = JSON.parse(JSON.stringify(matchup));
  candidate.players.find((player) => player.id === 'player-one').dietShares.playTypes[0].season = {
    share: 0.02,
    volumePerGame: 5,
  };
  fetchMatchup.mockResolvedValueOnce(candidate);
  render(
    <MemoryRouter initialEntries={['/matchups/game-1?player=player-one']}>
      <Routes>
        <Route path="/matchups/:gameId" element={<MatchupDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
  await screen.findByRole('heading', { name: 'LeBron James', level: 2 });
  expect(screen.getByRole('button', { name: 'All', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  expect(screen.getByText('Transition').closest('article')).not.toHaveClass('selection-why');
  await userEvent.click(screen.getByRole('button', { name: 'Last 15' }));
  expect(screen.getByText('Transition').closest('article')).toHaveClass('selection-why');
});

test('a late selection response cannot replace a newer player selection', async () => {
  let resolveFirst;
  const first = new Promise((resolve) => {
    resolveFirst = resolve;
  });
  const austin = {
    playerId: 'player-two',
    h2h: { thin: false, rows: [] },
    archetype: { thin: false, rows: [] },
  };
  fetchMatchupSelection.mockImplementation((_gameId, playerId) =>
    playerId === 'player-one' ? first : Promise.resolve(austin),
  );
  render(
    <MemoryRouter initialEntries={['/matchups/game-1?player=player-one']}>
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
    playerId: 'player-one',
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
    <MemoryRouter initialEntries={['/matchups/game-1?player=player-one']}>
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

test('player switches clamp the card stat and team toggles remain user-controlled', async () => {
  const empty = (playerId) => ({
    playerId,
    h2h: { thin: false, rows: [] },
    archetype: { thin: false, rows: [] },
  });
  fetchMatchupSelection.mockImplementation((_gameId, playerId) => Promise.resolve(empty(playerId)));
  render(
    <MemoryRouter initialEntries={['/matchups/game-1?player=player-one']}>
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
  expect(
    within(screen.getByRole('group', { name: 'Selection log stat' })).getByRole('button', {
      name: 'PTS',
    }),
  ).toHaveAttribute('aria-pressed', 'true');
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

test('selection request errors replace loading with an honest alert', async () => {
  fetchMatchupSelection.mockRejectedValueOnce(new Error('selection failed'));
  render(
    <MemoryRouter initialEntries={['/matchups/game-1?player=player-one']}>
      <Routes>
        <Route path="/matchups/:gameId" element={<MatchupDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
  expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load selection logs');
  expect(screen.queryByText('Loading selection logs…')).not.toBeInTheDocument();
});
