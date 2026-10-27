import { formatVsLeague } from './opponentProfile/opponentReadings';

/*
 * The Total Matchup Rating: how much more (or less) the opponent allows of the
 * player's mix than league average, each category weighted by how often he
 * uses it. Rows carry `frequency` and the opponent's `teamDefense` ratio to
 * league (1.06 = allows 6% more). Null when there is no frequency to weigh.
 */
export const matchupRatingPercent = (rows) => {
  const total = rows.reduce((sum, row) => sum + row.frequency, 0);
  if (!(total > 0)) return null;
  const weighted = rows.reduce((sum, row) => sum + row.frequency * row.teamDefense, 0);
  return (weighted / total - 1) * 100;
};

export const formatMatchupRating = formatVsLeague;

// Red where the opponent allows less of his mix, green where it allows more.
export const matchupRatingColor = (percent) => {
  const value = 1 - percent / 100;
  return `hsl(${(1 - (value - 0.8) / (1.2 - 0.8)) * 120}, 100%, 40%)`;
};
