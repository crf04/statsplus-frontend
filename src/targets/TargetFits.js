import { UNAVAILABLE_RELATIVE_LABEL } from '../matchups/displayConfig';
import { formatQualifierParts } from './targetCatalog';
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
 * An observed share is an estimate from a season of shots, so it reads to the
 * whole percent the Matchup's Diet chips use. A Qualifier's threshold is not:
 * it is what was typed, and keeps the decimal its title was derived with.
 */
const formatObservedShare = (share) => `${Math.round(share * 100)}%`;

const signed = (value) => `${value > 0 ? '+' : ''}${value.toFixed(1)}`;

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
        {target.qualifiers.map((qualifier, index) => {
          const { label, value } = formatQualifierParts(qualifier);
          return (
            <span key={index}>
              {index > 0 && <em> &amp; </em>}
              {label} <b>{value}</b>
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
 * The fits for one live Target. An unavailable pool is stated in its own words
 * so an empty table is never read as "nobody fits"; only a live entry has a
 * pool to report on, so an idle Target never reaches here.
 */
export function TargetFitTable({ entry, dense = false }) {
  const { availability, game, players, target } = entry;
  if (availability.status !== 'available') {
    return (
      <p className="target-empty">
        {game.opposingTeam.tricode} pool unavailable
        {availability.unavailableReason ? `: ${availability.unavailableReason}` : ''}. Nobody can be
        listed, which is not the same as nobody fitting.
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
  return (
    /* One column per Qualifier, so a Target with several outgrows a phone.
       The table scrolls inside its own bounds rather than the page. */
    <div className="target-fits-wrap">
      <table
        className={`target-fits${dense ? ' is-dense' : ''}`}
        aria-label={`Fits for ${target.title}`}
      >
        {/* A completed game has no Player Pool to read, so its participants are
            the game's own logs, as they are on the Matchup. */}
        {availability.source === 'game_logs' && <caption>from game logs</caption>}
        <thead>
          <tr>
            <th>Player</th>
            {target.qualifiers.map((qualifier, index) => (
              <th className="num" key={index}>
                {formatQualifierParts(qualifier).label}
              </th>
            ))}
            <th className="num">PPG</th>
          </tr>
        </thead>
        <tbody>
          {players.map((player) => (
            <tr className={player.thin ? 'is-thin' : undefined} key={player.canonicalId}>
              <td>
                <b>{player.name}</b>
                <small>{player.tricode}</small>
                {/* A thin diet is flagged rather than dropped, so this list
                    never disagrees with the Matchup about who is in the game. */}
                {player.thin && (
                  <span className="thin-flag" title="Thin Diet evidence">
                    thin
                  </span>
                )}
              </td>
              {player.shares.map((share, index) => (
                <td className="num" key={index}>
                  <b>{formatObservedShare(share.share)}</b>
                  {share.leagueAverageShare !== null && (
                    <small>lg {formatObservedShare(share.leagueAverageShare)}</small>
                  )}
                </td>
              ))}
              <td className="num">
                {player.seasonScoring === null ? '—' : player.seasonScoring.toFixed(1)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/*
 * The Slate's own view of a Target: it hangs under the game row it belongs to,
 * so the game states itself and only the Target and its fits are repeated.
 */
export function SlateGameTargets({ entries }) {
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
          <TargetFitTable entry={entry} dense />
        </article>
      ))}
    </div>
  );
}
