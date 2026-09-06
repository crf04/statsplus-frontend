import { gameStat, seasonStat } from './statValues';
const line = {
  points: 24,
  rebounds: 8,
  assists: 6,
  minutes: 24,
  field_goals_made: 9,
  field_goals_attempted: 18,
  threes_made: 3,
  threes_attempted: 8,
  free_throws_made: 3,
  free_throws_attempted: 4,
  steals: 2,
  blocks: 1,
};
test('box combinations and per36 read the game line and the season total ratio', () => {
  expect(gameStat({ line }, 'PRA')).toBe(38);
  expect(gameStat({ line }, 'SB')).toBe(3);
  expect(gameStat({ line }, 'PTS/36')).toBe(36);
  // Two games: 24 points in24min and12 points in36min. Mean per-game rates
  // would24; the correct season total ratio is36/60*36 =21.6.
  const player = { seasonTotals: { ...line, points: 36, minutes: 60 }, seasonGames: 2 };
  expect(seasonStat(player, 'PTS/36')).toBeCloseTo(21.6);
  expect(seasonStat(player, 'PTS')).toBe(18);
});
test('efficiency uses attempts and TS includes weighted free throws', () => {
  expect(gameStat({ line }, 'FG%')).toBe(50);
  expect(gameStat({ line }, '3P%')).toBe(37.5);
  expect(gameStat({ line }, 'TS%')).toBeCloseTo(60.72874494);
  expect(gameStat({ line }, 'PTS/FGA')).toBeCloseTo(1.333333333);
});
test('missing evidence and zero denominators are absent, while real zero production remains zero', () => {
  expect(gameStat({ line: { ...line, minutes: 0 } }, 'PTS/36')).toBeNull();
  expect(gameStat({ line: { ...line, field_goals_attempted: 0 } }, 'FG%')).toBeNull();
  expect(gameStat({ line: { ...line, threes_attempted: 0 } }, '3P%')).toBeNull();
  expect(
    gameStat({ line: { ...line, field_goals_attempted: 0, free_throws_attempted: 0 } }, 'TS%'),
  ).toBeNull();
  expect(gameStat({ line: { ...line, field_goals_attempted: 0 } }, 'PTS/FGA')).toBeNull();
  expect(gameStat({ line: { ...line, points: 0 } }, 'PTS/36')).toBe(0);
  expect(seasonStat({ seasonTotals: line, seasonGames: 0 }, 'PTS')).toBeNull();
  expect(gameStat({ stats: { PTS: 17 } }, 'PTS')).toBe(17);
  expect(gameStat({ stats: { PTS: 17 } }, 'REB')).toBeNull();
});

test('season efficiency uses totals rather than an average of game percentages', () => {
  // A1-for2 game and a5-for8 game have a56.25% mean, but6/10 is60%.
  expect(
    seasonStat(
      { seasonTotals: { ...line, field_goals_made: 6, field_goals_attempted: 10 }, seasonGames: 2 },
      'FG%',
    ),
  ).toBe(60);
  expect(
    seasonStat({ seasonTotals: { ...line, minutes: 0 }, seasonGames: 2 }, 'PTS/36'),
  ).toBeNull();
});
