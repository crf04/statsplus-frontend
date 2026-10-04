import { createContext, useContext } from 'react';
import { getRequestErrorMessage } from '../gameLogsApi';

/*
 * What the Backtest just read, offered to the form that composed it. The Lab
 * already holds the answer for the current draft, so a control that changes the
 * sample can say what it did without asking for the read again.
 *
 * Its own module so the Lab can provide it without the form importing the Lab,
 * which would close a cycle: Lab → Form → Conditions.
 */
const BacktestSampleContext = createContext(null);

export const BacktestSampleProvider = BacktestSampleContext.Provider;

// Null wherever no Lab is above, which is a form with no evidence beneath it.
export const useBacktestSample = () => useContext(BacktestSampleContext);

export const countAppearances = (backtest) =>
  backtest ? backtest.players.reduce((total, player) => total + player.games.length, 0) : null;

/*
 * The season a Backtest read, which is the published season or the one before
 * it. With no season named, the backend reads the published one, or the one
 * before it while the published season has no games yet, and says which.
 */
const shiftSeason = (season, years) => {
  const start = Number(season.slice(0, 4)) + years;
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`;
};

export const previousSeason = (season) => shiftSeason(season, -1);

// Null for a read that named its season, or a backend that gives no reason.
export const publishedSeasonOf = (backtest) => {
  if (backtest?.seasonReason === 'published') return backtest.season;
  if (backtest?.seasonReason === 'fallback_no_games') return shiftSeason(backtest.season, 1);
  return null;
};

export const describeFallback = (backtest) =>
  backtest?.seasonReason === 'fallback_no_games'
    ? `${shiftSeason(backtest.season, 1)} has no games yet, showing ${backtest.season}`
    : null;

/*
 * A completed season is read whole, so only the published one is "to date".
 * A backend that does not echo the season reads the published one.
 */
export const describeBacktestSeason = (backtest, published = publishedSeasonOf(backtest)) => {
  if (!backtest?.season) return 'season to date';
  return published && backtest.season !== published
    ? `${backtest.season} season`
    : `${backtest.season} season to date`;
};

/*
 * A card's Backtest heading: which season it read, once it has read one, and
 * why that season when it is not the published one.
 */
export function BacktestSeasonLabel({ backtest }) {
  const fallback = describeFallback(backtest);
  return (
    <>
      Backtest
      {backtest && ` · ${describeBacktestSeason(backtest)}`}
      {fallback && <span className="target-backtest-note"> · {fallback}</span>}
    </>
  );
}

/*
 * A season whose data the backend no longer holds is not a season nobody fit,
 * so it never reads as an empty Backtest. The backend's message names what is
 * missing.
 */
export const describeSeasonUnavailable = (message) =>
  ['That season’s data is unavailable.', message].filter(Boolean).join(' ');

export const describeBacktestFailure = (error, fallback) => {
  const failure = error?.response?.data?.error;
  return failure?.code === 'season_unavailable'
    ? describeSeasonUnavailable(failure.message)
    : getRequestErrorMessage(error, fallback);
};
