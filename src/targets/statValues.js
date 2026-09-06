import catalogue from './targetStatCatalogue.json';

export const STAT_GROUPS = {
  'Box score': catalogue.filter((key) => !key.includes('/') && !key.includes('%')),
  'Per 36 minutes': catalogue.filter((key) => key.endsWith('/36')),
  Efficiency: catalogue.filter((key) => key.includes('%') || key === 'PTS/FGA'),
};

export const BOX_FIELDS = {
  PTS: 'points',
  REB: 'rebounds',
  AST: 'assists',
  '3PM': 'threes_made',
  '3PA': 'threes_attempted',
  FGM: 'field_goals_made',
  FGA: 'field_goals_attempted',
  FTM: 'free_throws_made',
  FTA: 'free_throws_attempted',
  STL: 'steals',
  BLK: 'blocks',
  TOV: 'turnovers',
  OREB: 'offensive_rebounds',
  DREB: 'defensive_rebounds',
  PF: 'fouls',
  MIN: 'minutes',
};
const combinations = {
  PA: ['PTS', 'AST'],
  PR: ['PTS', 'REB'],
  RA: ['REB', 'AST'],
  PRA: ['PTS', 'REB', 'AST'],
  SB: ['STL', 'BLK'],
};
const ratio = (numerator, denominator, multiplier = 1) =>
  Number.isFinite(numerator) && Number.isFinite(denominator) && denominator > 0
    ? (numerator / denominator) * multiplier
    : null;

function lineStat(line, key) {
  if (!line) return null;
  if (key.endsWith('/36')) return ratio(lineStat(line, key.slice(0, -3)), line.minutes, 36);
  if (key === 'FG%') return ratio(line.field_goals_made, line.field_goals_attempted, 100);
  if (key === '3P%') return ratio(line.threes_made, line.threes_attempted, 100);
  if (key === 'TS%')
    return ratio(
      line.points,
      2 * (line.field_goals_attempted + 0.44 * line.free_throws_attempted),
      100,
    );
  if (key === 'PTS/FGA') return ratio(line.points, line.field_goals_attempted);
  if (combinations[key]) {
    const values = combinations[key].map((part) => lineStat(line, part));
    return values.every(Number.isFinite) ? values.reduce((sum, value) => sum + value, 0) : null;
  }
  const value = line[BOX_FIELDS[key]];
  return Number.isFinite(value) ? value : null;
}

export const gameStat = (game, key) =>
  game.line
    ? lineStat(game.line, key)
    : Number.isFinite(game.stats?.[key])
      ? game.stats[key]
      : null;
export const seasonStat = (player, key) => {
  if (!player.seasonTotals)
    return Number.isFinite(player.seasonAverages?.[key]) ? player.seasonAverages[key] : null;
  const value = lineStat(player.seasonTotals, key);
  return key.endsWith('/36') || STAT_GROUPS.Efficiency.includes(key)
    ? value
    : ratio(value, player.seasonGames);
};
