import { createContext, useContext, useState } from 'react';
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

/*
 * The season the Lab is reading, the one the reader picked (null for the
 * backend's default), and whether it is a past one, for the season-bound
 * controls of the form beside it: the Defender roster is read for the same
 * season, date presets name that season's dates, and the published season's
 * league and opponent readings are not shown beside a past season's evidence. The Lab provides it to a form nested in it,
 * and reports it to a LabSeasonProvider above a form that is its sibling.
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
 * The season a Backtest read, which is the published season or the one before
 * it. With no season named, the backend reads the published one, or the one
 * before it while the published season has no games yet, and says which.
 */
const isSeason = (value) =>
  typeof value === 'string' &&
  /^\d{4}-\d{2}$/.test(value) &&
  Number(value.slice(5)) === (Number(value.slice(0, 4)) + 1) % 100;

const shiftSeason = (season, years) => {
  const start = Number(season.slice(0, 4)) + years;
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`;
};

export const previousSeason = (season) => shiftSeason(season, -1);

/*
 * The published season, as the backend names it, or as a default read's
 * reason implies. Null for a read that named its season from a backend that
 * does not name the published one, or a backend that gives no reason. A roster
 * read carries the same metadata as a Backtest.
 */
export const publishedSeasonOf = (backtest) => {
  if (backtest?.publishedSeason) return backtest.publishedSeason;
  if (backtest?.seasonReason === 'published') return backtest.season;
  if (backtest?.seasonReason === 'fallback_no_games') return shiftSeason(backtest.season, 1);
  return null;
};

export const describeFallback = (backtest) =>
  backtest?.seasonReason === 'fallback_no_games'
    ? `${shiftSeason(backtest.season, 1)} has no games yet, showing ${backtest.season}`
    : null;

// A season before the published one, read whole and never mixed with it.
export const isPastSeason = (season, published) =>
  Boolean(season && published && season !== published);

/*
 * A completed season is read whole, so only the published one is "to date".
 * A backend that does not echo the season reads the published one.
 */
export const describeBacktestSeason = (backtest, published = publishedSeasonOf(backtest)) => {
  if (!backtest?.season) return 'season to date';
  return isPastSeason(backtest.season, published)
    ? `${backtest.season} season`
    : `${backtest.season} season to date`;
};

/*
 * How far the season to date has got for this opponent, so a thin one reads
 * as thin. Whether it is too thin is the reader's call; nothing here judges it.
 */
export const describeSeasonGames = (backtest, published = publishedSeasonOf(backtest)) => {
  if (!backtest?.season || !backtest.gamesConsidered || isPastSeason(backtest.season, published))
    return null;
  const { played } = backtest.gamesConsidered;
  return `${backtest.target.opponent} has played ${played} ${played === 1 ? 'game' : 'games'} in ${backtest.season}`;
};

/*
 * A card's Backtest heading: which season it read, once it has read one, and
 * why that season when it is not the published one, or how far the published
 * one has got.
 */
export function BacktestSeasonLabel({ backtest }) {
  const note = describeFallback(backtest) ?? describeSeasonGames(backtest);
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
 * resolved, the published one it resolved against, and the stream that is
 * missing. A refused first read still names the published season, so the
 * reader can pick the other one. Anything that does not hold together is
 * ignored rather than trusted.
 */
export const seasonUnavailableDetails = (error) => {
  const failure = error?.response?.data?.error;
  const details = failure?.details;
  if (
    failure?.code !== 'season_unavailable' ||
    !details ||
    !isSeason(details.season) ||
    !isSeason(details.published_season) ||
    typeof details.stream !== 'string' ||
    ![details.published_season, previousSeason(details.published_season)].includes(details.season)
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
    ? describeSeasonUnavailable(failure.message)
    : getRequestErrorMessage(error, fallback);
};
