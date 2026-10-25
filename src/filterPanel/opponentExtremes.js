// The base stats each Line Type bears on, in the codes the next-opponent rows
// carry in `markets`. A Line Type missing here applies no stat filter.
const LINE_TYPE_MARKETS = {
  PTS: ['PTS'],
  REB: ['REB'],
  AST: ['AST'],
  FG3M: ['FG3M'],
  FTA: ['FTA'],
  FTM: ['FTM'],
  STL: ['STL'],
  BLK: ['BLK'],
  TOV: ['TOV'],
  PRA: ['PTS', 'REB', 'AST'],
  PR: ['PTS', 'REB'],
  PA: ['PTS', 'AST'],
  RA: ['REB', 'AST'],
  STKS: ['STL', 'BLK'],
};

const bearsOn = (stat, markets) =>
  !markets || !stat.markets || stat.markets.some((market) => markets.includes(market));

// The opponent's top- and bottom-8 ranks that bear on the selected stat, best
// place first, one row per family. Rows without `family` stand alone.
export const opponentExtremes = (rows, lineType) => {
  const markets = LINE_TYPE_MARKETS[lineType];
  const families = new Set();
  return rows
    .filter((stat) => stat.most_rank <= 8 || stat.most_rank > stat.ranked_teams - 8)
    .filter((stat) => bearsOn(stat, markets))
    .map((stat) => {
      const fewest = stat.ranked_teams - stat.most_rank + 1 < stat.most_rank;
      return {
        ...stat,
        token: stat.team_filter,
        fewest,
        place: fewest ? stat.ranked_teams - stat.most_rank + 1 : stat.most_rank,
        tier: fewest ? [Math.max(1, stat.ranked_teams - 7), stat.ranked_teams] : [1, 8],
      };
    })
    .sort((a, b) => a.place - b.place || a.label.localeCompare(b.label))
    .filter((stat) => {
      if (!stat.family) return true;
      if (families.has(stat.family)) return false;
      families.add(stat.family);
      return true;
    });
};
