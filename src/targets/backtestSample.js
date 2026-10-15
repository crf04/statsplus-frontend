import { createContext, useContext, useState } from 'react';
import { getRequestErrorMessage, withRequestReference } from '../gameLogsApi';

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

/*
 * The season the Lab is reading, the one the reader picked (null for the
 * backend's default), and whether it is other than the published one, for the
 * season-bound controls of the form beside it: the Defender roster is read for
 * the same season, date presets name that season's dates, and the published
 * season's league and opponent readings are not shown beside another season's
 * evidence. The Lab provides it to a form nested in it, and reports it to a
 * LabSeasonProvider above a form that is its sibling.
 */
const LabSeasonContext = createContext(null);
const ReportLabSeasonContext = createContext(null);

export const LabSeasonValueProvider = LabSeasonContext.Provider;
export const useLabSeason = () => useContext(LabSeasonContext);
export const useReportLabSeason = () => useContext(ReportLabSeasonContext);

export function LabSeasonProvider({ children }) {
  const [labSeason, setLabSeason] = useState(null);
  return (
    <ReportLabSeasonContext.Provider value={setLabSeason}>
      <LabSeasonContext.Provider value={labSeason}>{children}</LabSeasonContext.Provider>
    </ReportLabSeasonContext.Provider>
  );
}

export const countAppearances = (backtest) =>
  backtest ? backtest.players.reduce((total, player) => total + player.games.length, 0) : null;

/*
 * The two seasons a Backtest can read, in the order the Lab offers them. With
 * no season named, the backend reads the default one and says so; there is no
 * other.
 */
export const BACKTEST_SEASONS = ['2025-26', '2026-27'];
export const DEFAULT_BACKTEST_SEASON = '2025-26';

// A season names two consecutive years, as "2025-26".
export const isSeason = (value) =>
  typeof value === 'string' &&
  /^\d{4}-\d{2}$/.test(value) &&
  Number(value.slice(5)) === (Number(value.slice(0, 4)) + 1) % 100;

const nextSeason = (season) => {
  const start = Number(season.slice(0, 4)) + 1;
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`;
};

/*
 * The published season, as the backend names it, or as an earlier backend's
 * reason implies. Null for a read whose backend does not name it, which a
 * default read never implies: the default is not the published season. A
 * roster read carries the same metadata as a Backtest.
 */
export const publishedSeasonOf = (backtest) => {
  if (backtest?.publishedSeason) return backtest.publishedSeason;
  if (backtest?.seasonReason === 'published') return backtest.season;
  if (backtest?.seasonReason === 'fallback_no_games') return nextSeason(backtest.season);
  return null;
};

/*
 * Why the Backtest reads the season it does, when a backend deployed before
 * the default fell back from a published season with no games. The default
 * needs no note: the season alone names it.
 */
export const describeSeasonNote = (backtest) => {
  if (backtest?.seasonReason === 'fallback_no_games')
    return `${nextSeason(backtest.season)} has no games yet, showing ${backtest.season}`;
  return null;
};

// A season before the published one, read whole.
export const isPastSeason = (season, published) =>
  Boolean(season && published && season < published);

// Any season but the published one, whose readings are never mixed into it.
export const isOtherSeason = (season, published) =>
  Boolean(season && published && season !== published);

/*
 * A completed season is read whole, so only the published one is "to date".
 * A backend that does not echo the season reads the published one.
 */
export const describeBacktestSeason = (backtest, published = publishedSeasonOf(backtest)) => {
  if (!backtest?.season) return 'season to date';
  if (backtest.seasonReason === 'default') return backtest.season;
  return isPastSeason(backtest.season, published)
    ? `${backtest.season} season`
    : `${backtest.season} season to date`;
};

/*
 * A card's Backtest heading: which season it read, once it has read one, and
 * why that season.
 */
export function BacktestSeasonLabel({ backtest }) {
  const note = backtest?.seasonReason === 'fallback_no_games' && describeSeasonNote(backtest);
  return (
    <>
      Backtest
      {backtest && ` · ${describeBacktestSeason(backtest)}`}
      {note && <span className="target-backtest-note"> · {note}</span>}
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

/*
 * What a season_unavailable refusal says about the seasons: the one it
 * resolved, which is either Backtest season whatever is published, the
 * published one as it actually is, and the stream that is missing. Anything
 * that does not hold together is ignored rather than trusted.
 */
export const seasonUnavailableDetails = (error) => {
  const failure = error?.response?.data?.error;
  const details = failure?.details;
  if (
    failure?.code !== 'season_unavailable' ||
    !details ||
    !BACKTEST_SEASONS.includes(details.season) ||
    !isSeason(details.published_season) ||
    typeof details.stream !== 'string'
  )
    return null;
  return {
    season: details.season,
    publishedSeason: details.published_season,
    stream: details.stream,
  };
};

export const describeBacktestFailure = (error, fallback) => {
  const failure = error?.response?.data?.error;
  return failure?.code === 'season_unavailable'
    ? withRequestReference(describeSeasonUnavailable(failure.message), error)
    : getRequestErrorMessage(error, fallback);
};
