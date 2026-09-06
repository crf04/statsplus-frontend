/*
 * PROTOTYPE — throwaway. See ./README.md.
 *
 * The league-average share of every diet slice, so a threshold is typed
 * against a number rather than into the dark. The backend publishes these
 * per player on the Matchup (each slice's `league_average_share`, season
 * window) and nowhere on its own; this table was lifted from one Matchup's
 * payload. Shipping this means a small read of the diet baselines.
 */
import table from './mock/league-averages.json';

export const leagueAverageShare = (base, sliceKey) => table.shares[base]?.[sliceKey] ?? null;

export const leagueAveragePercent = (base, sliceKey) => {
  const share = leagueAverageShare(base, sliceKey);
  return share === null ? null : Math.round(share * 100);
};

/* The hint beside a threshold: the league average for the slice in hand,
   and a press to start from it. */
export function LeagueHint({ base, sliceKey, onUse }) {
  const percent = leagueAveragePercent(base, sliceKey);
  if (percent === null) return null;
  return (
    <button
      type="button"
      className="pt-lg"
      title="League-average share for this slice · press to use it as the threshold"
      onClick={() => onUse(String(percent))}
    >
      lg {percent}%
    </button>
  );
}
