import { aggregateEvidence, gameStat, seasonStat } from './statValues';

/*
 * The arithmetic a Target Backtest is graded by, apart from any view of it:
 * the Targets page's record and the Slate's fit card both read it.
 */

export const rounded = (value) => {
  if (!Number.isFinite(value)) return null;
  const display = Number(value.toFixed(1));
  return Object.is(display, -0) ? 0 : display;
};

export const formatAggregatePercent = (value) => {
  const display = rounded(value);
  if (display === null) return '—';
  const text = display.toFixed(1).replace(/\.0$/, '');
  return `${display > 0 ? '+' : ''}${text}%`;
};

export const aggregateColumn = (games, column) => {
  const evidence = games
    .map((row) => aggregateEvidence(row.game, row.player, column))
    .filter(Boolean);
  if (evidence.length === 0) return { difference: null, relative: null, count: 0 };

  const excess = evidence.reduce((total, item) => total + item.excess, 0);
  const expected = evidence.reduce((total, item) => total + item.expectedProduction, 0);
  // Evidence kind and multiplier are homogeneous for each selected column.
  const first = evidence[0];
  const difference =
    first.kind === 'weighted'
      ? (excess / evidence.reduce((total, item) => total + item.weight, 0)) * first.multiplier
      : excess / evidence.length;
  const relative = expected === 0 ? null : (excess / expected) * 100;
  return {
    difference: Number.isFinite(difference) ? difference : null,
    relative: relative === null || Number.isFinite(relative) ? relative : null,
    count: evidence.length,
  };
};

// Keep full precision through grading and arithmetic; round only for display.
export function recordGames(backtest, columns) {
  return backtest.players
    .flatMap((player) =>
      player.games.map((game, index) => ({
        player,
        game,
        key: `${player.canonicalId}-${game.gameDate}-${index}`,
        margins: Object.fromEntries(
          columns.map((column) => {
            const value = gameStat(game, column);
            const average = seasonStat(player, column);
            return [
              column,
              Number.isFinite(value) && Number.isFinite(average) ? value - average : null,
            ];
          }),
        ),
      })),
    )
    .sort((a, b) => a.game.gameDate.localeCompare(b.game.gameDate));
}

/*
 * A backtest's headline in one stat, as the Targets page reads it: how far
 * the games ran from each player's own season average, as a percent rounded
 * for display, and the share of games over it. The Slate's fit card quotes it
 * (crf04/statsplus#423), so the two never disagree about the same Target.
 */
export const backtestGrade = (backtest, column) => {
  const games = recordGames(backtest, [column]);
  const margins = games.map((row) => row.margins[column]).filter((margin) => margin !== null);
  return {
    relative: rounded(aggregateColumn(games, column).relative),
    hitShare: margins.length
      ? margins.filter((margin) => margin > 0).length / margins.length
      : null,
  };
};
