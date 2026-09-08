import { fireEvent, render, screen, within } from '@testing-library/react';
import TargetRecord from './TargetRecord';
const backtest = {
  target: { opponent: 'OKC' },
  statColumns: ['PTS'],
  proxy: 'Box-score proxies',
  players: [
    {
      canonicalId: 1,
      name: 'Player One',
      tricode: 'LAL',
      seasonAverages: { PTS: 20 },
      games: [
        { gameDate: '2026-03-01', stats: { PTS: 28 } },
        { gameDate: '2026-01-01', stats: { PTS: 18 } },
        { gameDate: '2026-02-01', stats: { PTS: 20 } },
      ],
    },
  ],
};
test('the record grades all games oldest first and states the aggregate, hit rate and margin', () => {
  render(<TargetRecord backtest={backtest} />);
  const summary = screen.getByRole('list', { name: 'Backtest summary' });
  expect(within(summary).getByRole('listitem', { name: 'Player-games' })).toHaveTextContent('3');
  expect(within(summary).getByRole('listitem', { name: 'PTS' })).toHaveTextContent('33%');
  expect(within(summary).getByRole('listitem', { name: 'PTS' })).toHaveTextContent('+2.0');
  // The aggregate headline is positive, even when fewer than half the games hit.
  expect(within(summary).getByText('+2.0 PTS/game')).toHaveClass('is-hit');
  expect(within(summary).queryByRole('listitem', { name: 'Players' })).not.toBeInTheDocument();
  const cells = within(screen.getByRole('list', { name: /oldest to newest/ })).getAllByRole(
    'listitem',
  );
  expect(cells[0]).toHaveAttribute('title', expect.stringContaining('2026-01-01'));
  expect(cells[0]).toHaveClass('grade-miss-1');
  expect(cells[1]).toHaveClass('grade-neutral');
  expect(cells[2]).toHaveClass('grade-hit-4');
  expect(cells[2]).toHaveAttribute('title', expect.stringContaining('Player One'));
  expect(screen.getByText(/PTS vs the player/)).toBeVisible();
  expect(screen.queryByRole('table')).not.toBeInTheDocument();
});

test('the stats picker closes on Escape', () => {
  render(<TargetRecord backtest={backtest} onPreferencesChange={() => {}} />);
  fireEvent.click(screen.getByRole('button', { name: 'stats ▾' }));
  expect(screen.getByRole('group', { name: 'Stats picker' })).toBeInTheDocument();
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.queryByRole('group', { name: 'Stats picker' })).not.toBeInTheDocument();
});

test('an empty player-minutes result explains that appearances were filtered', () => {
  render(
    <TargetRecord
      backtest={{
        ...backtest,
        target: { ...backtest.target, conditions: { playerMinutes: 36 } },
        players: [],
      }}
    />,
  );
  expect(
    screen.getByText('No qualifying appearances match these backtest conditions.'),
  ).toBeVisible();
});

test('grades intermediate margins against the record’s p90, without letting an outlier flatten them', () => {
  // Eleven absolute margins: 0,1,2,3,3,4,5,6,7,8,40. P90 is 8,
  // so +3 and -3 occupy step 2 (not floor's step 1); max scaling
  // would also incorrectly flatten both to step 1.
  const points = [20, 21, 22, 23, 17, 24, 25, 26, 27, 28, 60];
  render(
    <TargetRecord
      backtest={{
        ...backtest,
        players: [
          {
            ...backtest.players[0],
            games: points.map((PTS, index) => ({
              gameDate: `2026-01-${String(index + 1).padStart(2, '0')}`,
              stats: { PTS },
            })),
          },
        ],
      }}
    />,
  );
  expect(screen.getByRole('listitem', { name: /2026-01-04/ })).toHaveClass('grade-hit-2');
  expect(screen.getByRole('listitem', { name: /2026-01-05/ })).toHaveClass('grade-miss-2');
  expect(screen.getByRole('listitem', { name: /2026-01-07/ })).toHaveClass('grade-hit-3');
  expect(screen.getByRole('listitem', { name: /2026-01-11/ })).toHaveClass('grade-hit-4');
});

test('a zero-minute game is absent from per36 arithmetic and never graded as zero production', () => {
  render(
    <TargetRecord
      columns={['PTS/36']}
      gradedBy="PTS/36"
      backtest={{
        ...backtest,
        players: [
          {
            ...backtest.players[0],
            seasonTotals: { points: 30, minutes: 60 },
            seasonGames: 2,
            games: [
              { gameDate: '2026-01-01', line: { points: 12, minutes: 24 } },
              { gameDate: '2026-01-02', line: { points: 0, minutes: 0 } },
            ],
          },
        ],
      }}
    />,
  );
  const summary = screen.getByRole('listitem', { name: 'PTS/36' });
  expect(summary).toHaveTextContent('0%');
  expect(summary).toHaveTextContent('0.0 PTS/36');
  expect(summary).toHaveTextContent('1 of 2 player-games used');
  const absent = screen.getByRole('listitem', { name: /2026-01-02/ });
  expect(absent).toHaveClass('grade-unavailable');
  expect(absent).toHaveAttribute('title', expect.stringContaining('— PTS/36'));
});

const line = ({
  points,
  minutes,
  fieldGoalsMade = 0,
  fieldGoalsAttempted = 0,
  threesMade = 0,
  threesAttempted = 0,
  freeThrowsAttempted = 0,
}) => ({
  points,
  minutes,
  field_goals_made: fieldGoalsMade,
  field_goals_attempted: fieldGoalsAttempted,
  threes_made: threesMade,
  threes_attempted: threesAttempted,
  free_throws_attempted: freeThrowsAttempted,
});

const player = ({ name, seasonPoints, seasonMinutes = 30, gamePoints, gameMinutes = 30 }) => ({
  canonicalId: name,
  name,
  tricode: 'LAL',
  seasonTotals: line({ points: seasonPoints, minutes: seasonMinutes }),
  seasonGames: 1,
  games: [{ gameDate: '2026-01-01', line: line({ points: gamePoints, minutes: gameMinutes }) }],
});

const renderPointsRecord = (players, columns = ['PTS']) =>
  render(
    <TargetRecord
      backtest={{ ...backtest, statColumns: columns, players }}
      columns={columns}
      gradedBy={columns[0]}
    />,
  );

test.each([
  {
    name: 'same point gain at different starting levels',
    players: [
      player({ name: 'A', seasonPoints: 10, gamePoints: 15 }),
      player({ name: 'B', seasonPoints: 25, gamePoints: 30 }),
    ],
    headline: '+5.0 PTS/game',
    relative: '+28.6% vs baseline',
  },
  {
    name: 'a small baseline does not dominate the aggregate percentage',
    players: [
      player({ name: 'A', seasonPoints: 1, gamePoints: 3 }),
      player({ name: 'B', seasonPoints: 25, gamePoints: 30 }),
    ],
    headline: '+3.5 PTS/game',
    relative: '+26.9% vs baseline',
  },
])('$name', ({ players, headline, relative }) => {
  renderPointsRecord(players);
  const summary = screen.getByRole('listitem', { name: 'PTS' });
  expect(summary).toHaveTextContent(headline);
  expect(summary).toHaveTextContent(relative);
  expect(summary).toHaveTextContent('Hit rate 100%');
  expect(screen.getByRole('listitem', { name: 'Player-games' })).toHaveTextContent(
    '2 player-games',
  );
});

test('the raw and minutes-adjusted views keep the same reduced-minute game distinct', () => {
  const reducedMinutes = player({
    name: 'A',
    seasonPoints: 20,
    seasonMinutes: 30,
    gamePoints: 10,
    gameMinutes: 15,
  });
  const { rerender } = renderPointsRecord([reducedMinutes]);
  let summary = screen.getByRole('listitem', { name: 'PTS' });
  expect(summary).toHaveTextContent('-10.0 PTS/game');
  expect(within(summary).getByText('-10.0 PTS/game')).toHaveClass('is-miss');
  expect(summary).toHaveTextContent('-50% vs baseline');

  rerender(
    <TargetRecord
      backtest={{ ...backtest, statColumns: ['PTS/36'], players: [reducedMinutes] }}
      columns={['PTS/36']}
      gradedBy="PTS/36"
    />,
  );
  summary = screen.getByRole('listitem', { name: 'PTS/36' });
  expect(summary).toHaveTextContent('0.0 PTS/36');
  expect(summary).toHaveTextContent('0% vs baseline');
});

test('minutes weighting keeps a short hot cameo from dominating a full appearance', () => {
  renderPointsRecord(
    [
      player({ name: 'A', seasonPoints: 18, seasonMinutes: 36, gamePoints: 3, gameMinutes: 2 }),
      player({ name: 'B', seasonPoints: 18, seasonMinutes: 36, gamePoints: 18, gameMinutes: 36 }),
    ],
    ['PTS/36'],
  );
  const summary = screen.getByRole('listitem', { name: 'PTS/36' });
  expect(summary).toHaveTextContent('+1.9 PTS/36');
  expect(summary).toHaveTextContent('+10.5% vs baseline');
});

test('efficiency aggregates use each column’s exposure and identify percentage-point units', () => {
  const season = line({
    points: 60,
    minutes: 90,
    fieldGoalsMade: 27,
    fieldGoalsAttempted: 60,
    threesMade: 18,
    threesAttempted: 30,
    freeThrowsAttempted: 20,
  });
  const games = [
    {
      gameDate: '2026-01-01',
      line: line({
        points: 30,
        minutes: 30,
        fieldGoalsMade: 12,
        fieldGoalsAttempted: 30,
        threesMade: 9,
        threesAttempted: 15,
        freeThrowsAttempted: 0,
      }),
    },
    {
      gameDate: '2026-01-02',
      line: line({
        points: 10,
        minutes: 30,
        fieldGoalsMade: 2,
        fieldGoalsAttempted: 4,
        threesMade: 1,
        threesAttempted: 2,
        freeThrowsAttempted: 10,
      }),
    },
  ];
  render(
    <TargetRecord
      backtest={{
        ...backtest,
        statColumns: ['FG%', '3P%', 'TS%', 'PTS/FGA'],
        players: [
          {
            ...player({ name: 'A', seasonPoints: 60, gamePoints: 30 }),
            seasonTotals: season,
            seasonGames: 2,
            games,
          },
        ],
      }}
      columns={['FG%', '3P%', 'TS%', 'PTS/FGA']}
      gradedBy="FG%"
    />,
  );
  expect(screen.getByRole('listitem', { name: 'FG%' })).toHaveTextContent('-3.8 pp');
  expect(screen.getByRole('listitem', { name: 'FG%' })).toHaveTextContent('-8.5% vs baseline');
  expect(screen.getByRole('listitem', { name: '3P%' })).toHaveTextContent('-1.2 pp');
  expect(screen.getByRole('listitem', { name: '3P%' })).toHaveTextContent('-2% vs baseline');
  expect(screen.getByRole('listitem', { name: 'TS%' })).toHaveTextContent('+8.5 pp');
  expect(screen.getByRole('listitem', { name: 'TS%' })).toHaveTextContent('+19.4% vs baseline');
  expect(
    within(screen.getByRole('listitem', { name: 'PTS/FGA' })).getByText('+0.2 PTS/FGA', {
      exact: true,
    }),
  ).toBeInTheDocument();
  expect(screen.getByRole('listitem', { name: 'PTS/FGA' })).toHaveTextContent('+17.6% vs baseline');
});

test('distinct player baselines remain distinct across multiple games', () => {
  render(
    <TargetRecord
      backtest={{
        ...backtest,
        players: [
          {
            ...player({ name: 'A', seasonPoints: 10, gamePoints: 15 }),
            games: [
              { gameDate: '2026-01-01', stats: { PTS: 15 } },
              { gameDate: '2026-01-02', stats: { PTS: 5 } },
            ],
          },
          {
            ...player({ name: 'B', seasonPoints: 30, gamePoints: 40 }),
            games: [{ gameDate: '2026-01-01', stats: { PTS: 40 } }],
          },
        ],
      }}
    />,
  );
  const summary = screen.getByRole('listitem', { name: 'PTS' });
  expect(summary).toHaveTextContent('+3.3 PTS/game');
  expect(summary).toHaveTextContent('+20% vs baseline');
  expect(summary).toHaveTextContent('Hit rate 67%');
});

test('per36 weighting keeps distinct player rates and unequal appearances separate', () => {
  const playerA = {
    ...player({ name: 'A', seasonPoints: 18, seasonMinutes: 36, gamePoints: 3, gameMinutes: 2 }),
    games: [{ gameDate: '2026-01-01', line: line({ points: 3, minutes: 2 }) }],
  };
  const playerB = {
    ...player({ name: 'B', seasonPoints: 48, seasonMinutes: 72, gamePoints: 24, gameMinutes: 36 }),
    games: [
      { gameDate: '2026-01-02', line: line({ points: 24, minutes: 36 }) },
      { gameDate: '2026-01-03', line: line({ points: 24, minutes: 36 }) },
    ],
  };
  renderPointsRecord([playerA, playerB], ['PTS/36']);
  const summary = screen.getByRole('listitem', { name: 'PTS/36' });
  expect(summary).toHaveTextContent('+1.0 PTS/36');
  expect(summary).toHaveTextContent('+4.1% vs baseline');
  expect(screen.getByRole('listitem', { name: 'Player-games' })).toHaveTextContent(
    '3 player-games',
  );
});

test('rounds aggregate values before choosing a sign, so a tiny negative is not negative zero', () => {
  render(
    <TargetRecord
      backtest={{
        ...backtest,
        players: [
          {
            ...backtest.players[0],
            seasonAverages: { PTS: 10 },
            games: [{ gameDate: '2026-01-01', stats: { PTS: 9.96 } }],
          },
        ],
      }}
    />,
  );
  const summary = screen.getByRole('listitem', { name: 'PTS' });
  expect(summary).toHaveTextContent('0.0 PTS/game');
  expect(summary).not.toHaveTextContent('-0.0');
});

test('zero expected production keeps the absolute result and drops relative change', () => {
  renderPointsRecord([player({ name: 'A', seasonPoints: 0, gamePoints: 3 })]);
  const summary = screen.getByRole('listitem', { name: 'PTS' });
  expect(summary).toHaveTextContent('+3.0 PTS/game');
  expect(summary).toHaveTextContent('— vs baseline');
});

test('missing game values reduce aggregate evidence without changing the valid hit-rate sample', () => {
  render(
    <TargetRecord
      backtest={{
        ...backtest,
        players: [
          {
            ...backtest.players[0],
            seasonAverages: { PTS: 10 },
            games: [
              { gameDate: '2026-01-01', stats: { PTS: 15 } },
              { gameDate: '2026-01-02', stats: {} },
            ],
          },
        ],
      }}
    />,
  );
  const summary = screen.getByRole('listitem', { name: 'PTS' });
  expect(summary).toHaveTextContent('+5.0 PTS/game');
  expect(summary).toHaveTextContent('+50% vs baseline');
  expect(summary).toHaveTextContent('Hit rate 100%');
  expect(summary).toHaveTextContent('1 of 2 player-games used');
  expect(screen.getByRole('listitem', { name: /2026-01-02/ })).toHaveClass('grade-unavailable');
});

test('an efficiency denominator of zero excludes that game from the aggregate', () => {
  const season = line({
    points: 20,
    minutes: 60,
    fieldGoalsMade: 10,
    fieldGoalsAttempted: 20,
  });
  render(
    <TargetRecord
      backtest={{
        ...backtest,
        statColumns: ['FG%'],
        players: [
          {
            ...player({ name: 'A', seasonPoints: 20, gamePoints: 10 }),
            seasonTotals: season,
            games: [
              {
                gameDate: '2026-01-01',
                line: line({ points: 10, minutes: 30, fieldGoalsMade: 5, fieldGoalsAttempted: 10 }),
              },
              {
                gameDate: '2026-01-02',
                line: line({ points: 0, minutes: 30, fieldGoalsMade: 0, fieldGoalsAttempted: 0 }),
              },
            ],
          },
        ],
      }}
      columns={['FG%']}
      gradedBy="FG%"
    />,
  );
  const summary = screen.getByRole('listitem', { name: 'FG%' });
  expect(summary).toHaveTextContent('0.0 pp');
  expect(summary).toHaveTextContent('1 of 2 player-games used');
  expect(screen.getByRole('listitem', { name: /2026-01-02/ })).toHaveClass('grade-unavailable');
});

test('missing minutes and legacy rates remain visible individually but leave aggregates unavailable', () => {
  const { rerender } = render(
    <TargetRecord
      backtest={{
        ...backtest,
        players: [
          {
            ...backtest.players[0],
            seasonAverages: { PTS: 20 },
            games: [{ gameDate: '2026-01-01', stats: { PTS: 25 } }],
          },
        ],
      }}
    />,
  );
  let summary = screen.getByRole('listitem', { name: 'PTS' });
  expect(summary).toHaveTextContent('+5.0 PTS/game');

  rerender(
    <TargetRecord
      backtest={{
        ...backtest,
        statColumns: ['FG%'],
        players: [
          {
            ...backtest.players[0],
            seasonAverages: { 'FG%': 50 },
            games: [{ gameDate: '2026-01-01', stats: { 'FG%': 60 } }],
          },
        ],
      }}
      columns={['FG%']}
      gradedBy="FG%"
    />,
  );
  summary = screen.getByRole('listitem', { name: 'FG%' });
  expect(summary).toHaveTextContent('— pp');
  expect(summary).toHaveTextContent('Hit rate 100% · 1 player-games');
  expect(summary).toHaveTextContent('0 of 1 player-games used');
  expect(screen.getByRole('listitem', { name: /2026-01-01/ })).toHaveAttribute(
    'title',
    expect.stringContaining('+10.0 margin'),
  );
});

test('the per36 column excludes a zero-minute row', () => {
  renderPointsRecord(
    [player({ name: 'A', seasonPoints: 20, seasonMinutes: 30, gamePoints: 10, gameMinutes: 0 })],
    ['PTS/36'],
  );
  const summary = screen.getByRole('listitem', { name: 'PTS/36' });
  expect(summary).toHaveTextContent('— PTS/36');
  expect(summary).toHaveTextContent('0 of 1 player-games used');
});

test('an empty record has no aggregate evidence', () => {
  render(<TargetRecord backtest={{ ...backtest, players: [] }} />);
  expect(screen.getByRole('listitem', { name: 'Player-games' })).toHaveTextContent('0');
  expect(screen.getByRole('listitem', { name: 'PTS' })).toHaveTextContent('— PTS/game');
  expect(screen.getByRole('listitem', { name: 'PTS' })).toHaveTextContent('— vs baseline');
});
