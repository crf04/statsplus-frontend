import { UNAVAILABLE_RELATIVE_LABEL, bookName } from '../matchups/displayConfig';
import { formatPrice } from '../matchups/linePrices';
import { backtestGrade, formatAggregatePercent } from './backtestGrade';
import { positionFirst, formatQualifierParts, signed } from './targetCatalog';
import { WINDOW_REASONS } from '../windowReasons';
import '../readings.css';
import './TargetFits.css';

/*
 * What a Target looks like once it has been resolved against a day: the
 * readings on the opponent's Defense Sheet and the opposing players who meet
 * every Qualifier. The Slate shows the fits under the game row; the Target's
 * own page shows the readings as well. Both render them the same way, so the
 * two surfaces cannot disagree about the same Target.
 */

/*
 * The title is derived and stored by the backend, but a flat string cannot set
 * the opponent apart from the bound. These are the same parts that title is
 * derived from, weighted so a reader scanning a slate sees the team first.
 */
export function TargetTitle({ target }) {
  return (
    <span className="target-live-title">
      <span className="target-live-team">{target.opponent}</span>
      <span className="target-live-vs">vs</span>
      <span className="target-live-qualifiers">
        {positionFirst(target.qualifiers).map((qualifier, index) => {
          const { label, value } = formatQualifierParts(qualifier);
          return (
            <span key={index}>
              {index > 0 && <em> &amp; </em>}
              {label}
              {value && (
                <>
                  {' '}
                  <b>{value}</b>
                </>
              )}
            </span>
          );
        })}
      </span>
    </span>
  );
}

/*
 * One window of one Defense Sheet row, read as the Matchup reads it: the rank
 * against the league, what the opponent allows per 48, how far that is from
 * league average, and by how many sigma. A window its Base does not publish
 * says so rather than reading zero.
 */
function Reading({ reading, window }) {
  if (!reading) {
    return (
      <span className="target-reading is-empty">
        <span className="target-reading-window">{window}</span> n/a
      </span>
    );
  }
  const tone =
    reading.percentVsLeagueAverage === null
      ? 'neutral'
      : reading.percentVsLeagueAverage < 0
        ? 'under'
        : 'over';
  return (
    <span className={`target-reading is-${tone}`}>
      <span
        className="rank-pill"
        style={{ '--rank': reading.rank }}
        title={`Opponent rank ${reading.rank}/30 — 30 allows the most`}
      >
        {reading.rank}
      </span>
      <span className="target-reading-window">{window}</span>
      {/* The allowed figure leads, as it does on the Matchup sheet: the
          relative readings beside it are ways of reading that number. */}
      <b>{reading.allowedPer48.toFixed(1)}</b>
      <strong>
        {reading.percentVsLeagueAverage === null
          ? UNAVAILABLE_RELATIVE_LABEL
          : `${signed(reading.percentVsLeagueAverage)}% vs league`}
      </strong>
      <small>{signed(reading.sigmaDeviation)}σ</small>
    </span>
  );
}

export function TargetContext({ context }) {
  if (context.metrics.length === 0) {
    return <p className="target-empty">No Defense Sheet row publishes {context.label}.</p>;
  }
  return (
    <div className="target-context">
      {context.metrics.map((metric) => (
        <span className="target-context-row" key={metric.key}>
          <span className="target-context-label">{metric.label}</span>
          <Reading reading={metric.season} window="Season" />
          <Reading reading={metric.last15} window="L15" />
        </span>
      ))}
    </div>
  );
}

/*
 * The stat a fit is shown by: the one the Target is graded by, so a rebounding
 * Target lists rebounds rather than points. `gradedBy` is a card's live choice,
 * else the Target's saved one, else its first default column. A backend
 * without the Target's stats sends no columns, and the fit shows points.
 */
export function fitStat(entry, gradedBy) {
  if (!entry.statColumns?.length)
    return { key: 'PTS', label: 'PPG', value: (player) => player.seasonScoring };
  const stat = gradedBy ?? entry.target.statPreferences?.gradedBy ?? entry.statColumns[0];
  return { key: stat, label: stat, value: (player) => player.seasonAverages?.[stat] ?? null };
}

export const formatFitStat = (value) => (value === null ? '—' : value.toFixed(1));

// The posted-line market a Target stat is quoted in: 3PA is posted as FG3A
// (backend `target_stat_market`); every other stat is its own market.
const TARGET_MARKET_ALIASES = { '3PA': 'FG3A' };
export const targetStatMarket = (stat) => TARGET_MARKET_ALIASES[stat] ?? stat;

// Providers in the order they win a tied count, as the game-log picker's
// majority line does (crf04/statsplus#274): PrizePicks, then alphabetical.
const byProviderPreference = (a, b) =>
  (b === 'prizepicks') - (a === 'prizepicks') || (a < b ? -1 : a > b ? 1 : 0);

/*
 * The line a fit row shows in one market: the line most providers post, and
 * beside it the best Over price among the providers posting that line, with
 * that provider's Under. Null when nobody posts the stat; undefined when the
 * backend sent no lines at all (one deployed before crf04/statsplus#423).
 * A line whose providers price no pick (PrizePicks) comes back unpriced.
 */
export const fitLine = (player, stat) => {
  if (!player.lines) return undefined;
  const posted = Object.keys(player.lines)
    .sort(byProviderPreference)
    .filter((provider) => Number.isFinite(player.lines[provider]?.[stat]))
    .map((provider) => ({ provider, line: player.lines[provider][stat] }));
  if (posted.length === 0) return null;
  const count = (line) => posted.filter((source) => source.line === line).length;
  const lead = posted.reduce((best, source) =>
    count(source.line) > count(best.line) ? source : best,
  );
  const priced = posted
    .filter((source) => source.line === lead.line)
    .map((source) => ({ ...source, ...player.linePrices?.[source.provider]?.[stat] }))
    .filter((source) => Number.isInteger(source.over));
  const best = priced.reduce(
    (top, source) => (top === null || source.over > top.over ? source : top),
    null,
  );
  return best
    ? { line: lead.line, provider: best.provider, over: best.over, under: best.under ?? null }
    : { line: lead.line, provider: lead.provider, over: null, under: null };
};

/*
 * Why a Target is worth reading tonight: a FADE or BOOST lean from the sign of
 * its backtest in the graded stat, and one reason. The reason is the Target's
 * note, else the backtest in a sentence. No backtest is no lean; with neither
 * there is nothing to say.
 */
export const fitReason = (target, backtest, stat) => {
  const grade = backtest ? backtestGrade(backtest, stat) : null;
  const graded = grade && grade.relative !== null && grade.hitShare !== null ? grade : null;
  const sentence =
    graded &&
    `${backtest.season ? `${backtest.season} backtest` : 'Backtest'}: ${stat} ${formatAggregatePercent(graded.relative)} vs own average, ${Math.round(graded.hitShare * 100)}% of games over it.`;
  return {
    lean: graded ? (graded.relative < 0 ? 'fade' : 'boost') : null,
    text: target.note || sentence || null,
  };
};

const formatGameValue = (value) => (value === null ? '—' : String(Number(value.toFixed(1))));

function FitLine({ line }) {
  if (line === undefined) return '—';
  if (line === null) return <span className="target-fit-noline">no line</span>;
  return (
    <>
      <b>{line.line}</b>
      <small>
        {bookName(line.provider)}
        {line.over !== null &&
          ` o${formatPrice(line.over)} u${line.under === null ? '—' : formatPrice(line.under)}`}
      </small>
    </>
  );
}

function LastFive({ games, line, stat }) {
  return (
    <span
      className="target-fit-l5"
      role="group"
      aria-label={`Last ${games.length} ${stat}, newest first`}
    >
      {games.map(({ gameId, value }) => (
        <span
          className={value !== null && line && value > line.line ? 'is-over' : undefined}
          key={gameId}
        >
          {formatGameValue(value)}
        </span>
      ))}
    </span>
  );
}

/*
 * The fits for one live Target: per player, his last five games in the graded
 * stat against his posted line, his season average, and the line with one
 * price. An unavailable pool is stated in its own words so an empty table is
 * never read as "nobody fits"; only a live entry has a pool to report on, so
 * an idle Target never reaches here.
 */
export function TargetFitTable({ entry }) {
  const { availability, game, players, target } = entry;
  const stat = fitStat(entry);
  if (availability.status !== 'available') {
    const code = availability.unavailableReason;
    const reason = code && (WINDOW_REASONS[code] || `${code}.`);
    return (
      <p className="target-empty">
        {game.opposingTeam.tricode} pool unavailable
        {reason ? `: ${reason}` : '.'} Nobody can be listed, which is not the same as nobody
        fitting.
      </p>
    );
  }
  if (players.length === 0) {
    return (
      <p className="target-empty">
        No {game.opposingTeam.tricode} player meets every Qualifier today.
      </p>
    );
  }
  // A backend deployed before crf04/statsplus#423 sends neither, and the card
  // reads as it did: no chips, no line column.
  const showLastFive = players.some((player) => player.lastFiveGames?.length);
  const showLines = players.some((player) => player.lines);
  return (
    <table className="target-fits" aria-label={`Fits for ${target.title}`}>
      {/* A completed game has no Player Pool to read, so its participants are
          the game's own logs, as they are on the Matchup. */}
      {availability.source === 'game_logs' && <caption>from game logs</caption>}
      <thead>
        <tr>
          <th>Player</th>
          {showLastFive && <th className="num">Last 5 {stat.key}</th>}
          <th className="num">Avg {stat.key}</th>
          {showLines && <th className="num">Line</th>}
        </tr>
      </thead>
      <tbody>
        {players.map((player) => {
          const line = fitLine(player, targetStatMarket(stat.key));
          return (
            <tr className={player.thin ? 'is-thin' : undefined} key={player.canonicalId}>
              <td className="target-fit-name">
                <b>{player.name}</b>
                {player.position && <small> {player.position}</small>}
                {/* A thin diet is flagged rather than dropped, so this list
                    never disagrees with the Matchup about who is in the game. */}
                {player.thin && (
                  <span className="thin-flag" title="Thin Diet evidence">
                    thin
                  </span>
                )}
              </td>
              {showLastFive && (
                <td className="num">
                  {player.lastFiveGames?.length > 0 && (
                    <LastFive games={player.lastFiveGames} line={line} stat={stat.key} />
                  )}
                </td>
              )}
              <td className="num target-fit-avg">{formatFitStat(stat.value(player))}</td>
              {showLines && (
                <td className="num target-fit-line">
                  <FitLine line={line} />
                </td>
              )}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function FitReason({ entry, backtest }) {
  const stat = fitStat(entry);
  const { lean, text } = fitReason(entry.target, backtest, stat.key);
  if (!lean && !text) return null;
  return (
    <div className="target-fit-why">
      {lean && (
        <span className={`target-lean is-${lean}`}>
          {lean} {stat.key}
        </span>
      )}
      {text && <p>{text}</p>}
    </div>
  );
}

/*
 * The Slate's own view of a Target: it hangs under the game row it belongs to,
 * so the game states itself and only the Target, why it is worth reading, and
 * its fits are repeated. `backtests` holds the cached Target Backtests by
 * Target id; a Target with none has no lean.
 */
export function SlateGameTargets({ entries, backtests = {} }) {
  if (entries.length === 0) return null;
  return (
    <div className="target-under">
      {entries.map((entry) => (
        <article className="target-under-item" key={entry.target.id}>
          <div className="target-under-head">
            <span className="target-live-dot" aria-hidden="true" />
            <TargetTitle target={entry.target} />
            {entry.availability.status === 'available' && (
              <span className="target-under-count">
                <b>{entry.players.length}</b> fit
              </span>
            )}
          </div>
          <FitReason entry={entry} backtest={backtests[String(entry.target.id)]} />
          <TargetFitTable entry={entry} />
        </article>
      ))}
    </div>
  );
}
