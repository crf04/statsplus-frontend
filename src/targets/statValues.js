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

const efficiencyParts = {
  'FG%': (line) => ({
    numerator: line?.field_goals_made,
    denominator: line?.field_goals_attempted,
    multiplier: 100,
  }),
  '3P%': (line) => ({
    numerator: line?.threes_made,
    denominator: line?.threes_attempted,
    multiplier: 100,
  }),
  'TS%': (line) => ({
    numerator: line?.points,
    denominator: 2 * (line?.field_goals_attempted + 0.44 * line?.free_throws_attempted),
    multiplier: 100,
  }),
  'PTS/FGA': (line) => ({
    numerator: line?.points,
    denominator: line?.field_goals_attempted,
    multiplier: 1,
  }),
};

function lineStat(line, key) {
  if (!line) return null;
  if (key.endsWith('/36')) return ratio(lineStat(line, key.slice(0, -3)), line.minutes, 36);
  if (efficiencyParts[key]) {
    const { numerator, denominator, multiplier } = efficiencyParts[key](line);
    return ratio(numerator, denominator, multiplier);
  }
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

/*
 * The record's individual margins intentionally remain simple game-vs-season
 * comparisons. Aggregate evidence needs the underlying production and its
 * exposure so that a short appearance or a low-volume shooting game cannot
 * outweigh a longer or higher-volume appearance. Legacy rate values have no
 * exposure, so they remain available to the individual record but cannot join
 * this aggregate.
 */
export const aggregateEvidence = (game, player, key) => {
  if (key.endsWith('/36')) {
    if (!game?.line || !player?.seasonTotals) return null;
    const productionKey = key.slice(0, -3);
    const actualProduction = lineStat(game.line, productionKey);
    const seasonProduction = lineStat(player.seasonTotals, productionKey);
    const gameMinutes = game.line.minutes;
    const seasonMinutes = player.seasonTotals.minutes;
    if (
      !Number.isFinite(actualProduction) ||
      !Number.isFinite(seasonProduction) ||
      !Number.isFinite(gameMinutes) ||
      gameMinutes <= 0 ||
      !Number.isFinite(seasonMinutes) ||
      seasonMinutes <= 0
    ) {
      return null;
    }
    const expectedProduction = (seasonProduction / seasonMinutes) * gameMinutes;
    return Number.isFinite(expectedProduction)
      ? {
          kind: 'weighted',
          excess: actualProduction - expectedProduction,
          expectedProduction,
          weight: gameMinutes,
          multiplier: 36,
        }
      : null;
  }

  if (efficiencyParts[key]) {
    if (!game?.line || !player?.seasonTotals) return null;
    const actual = efficiencyParts[key](game.line);
    const season = efficiencyParts[key](player.seasonTotals);
    if (
      !Number.isFinite(actual.numerator) ||
      !Number.isFinite(actual.denominator) ||
      actual.denominator <= 0 ||
      !Number.isFinite(season.numerator) ||
      !Number.isFinite(season.denominator) ||
      season.denominator <= 0
    ) {
      return null;
    }
    const baselineRatio = season.numerator / season.denominator;
    const expectedProduction = baselineRatio * actual.denominator;
    const excess = actual.numerator - expectedProduction;
    return Number.isFinite(expectedProduction) && Number.isFinite(excess)
      ? {
          kind: 'weighted',
          excess,
          expectedProduction,
          weight: actual.denominator,
          multiplier: actual.multiplier,
        }
      : null;
  }

  const actual = gameStat(game, key);
  const expected = seasonStat(player, key);
  return Number.isFinite(actual) && Number.isFinite(expected)
    ? { kind: 'raw', excess: actual - expected, expectedProduction: expected, weight: 1 }
    : null;
};
