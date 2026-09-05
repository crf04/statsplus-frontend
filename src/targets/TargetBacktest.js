import { useState } from 'react';
import { Link } from 'react-router-dom';
import { filterSetToSearchParams } from '../filterUtils';
import { formatObservedShare, signed } from './TargetFits';
import { formatQualifierParts } from './targetCatalog';
import { useTargetBacktest } from './useTargets';

/*
 * Whether the idea has cashed. The backtest is a league-wide game-log scan
 * rather than a day-scoped read, so it is the one thing on this page that
 * costs something to ask for: nothing is requested until a reader opens the
 * disclosure. It is season-to-date rather than about today, so a Target whose
 * opponent is idle has one all the same.
 */

/*
 * A Direct Filter Set fixing the player and the one opponent, so a row opens
 * the Log Workspace on exactly the games that row is about.
 */
const logWorkspacePath = (name, opponent) =>
  `/?${filterSetToSearchParams({ player_name: name, opponent_tricode: opponent })}`;

/*
 * One row per game, grouped under the player it belongs to. Every stat is
 * shown against that player's own season average for the same market, because
 * 30 points only means something beside the 25 he usually scores.
 *
 * The Target read out here is the one the response carries rather than the one
 * the page is holding, so the shares are labelled by the Qualifiers the
 * backend actually ran them against.
 */
function BacktestTable({ backtest }) {
  const { players, statColumns, target } = backtest;
  return (
    /* One column per outcome market, so a Target with several Qualifiers
       outgrows a phone. The table scrolls inside its own bounds, as the fit
       table does. */
    <div className="target-backtest-wrap">
      <table className="target-backtest" aria-label={`Backtest for ${target.title}`}>
        <thead>
          <tr>
            <th>Player</th>
            <th>Game</th>
            {statColumns.map((column) => (
              <th className="num" key={column}>
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {players.map((player) =>
            player.games.map((game, index) => (
              <tr key={`${player.canonicalId}-${game.gameDate}`}>
                {index === 0 && (
                  <td rowSpan={player.games.length}>
                    <Link
                      aria-label={`${player.name} games vs ${target.opponent}`}
                      className="target-backtest-player"
                      to={logWorkspacePath(player.name, target.opponent)}
                    >
                      {player.name}
                    </Link>
                    {/* The shares that made him qualify, and the baseline the
                        games beside him are being read against. */}
                    <small>
                      {player.tricode} ·{' '}
                      {target.qualifiers
                        .map(
                          (qualifier, position) =>
                            `${formatQualifierParts(qualifier).label} ${formatObservedShare(
                              player.shares[position].share,
                            )}`,
                        )
                        .join(' · ')}
                    </small>
                    <small>
                      season{' '}
                      {statColumns
                        .map((column) => `${player.seasonAverages[column].toFixed(1)} ${column}`)
                        .join(' · ')}
                    </small>
                  </td>
                )}
                <td className="target-backtest-date">{game.gameDate}</td>
                {statColumns.map((column) => {
                  const difference = game.stats[column] - player.seasonAverages[column];
                  return (
                    <td className={`num is-${difference >= 0 ? 'hit' : 'miss'}`} key={column}>
                      {game.stats[column].toFixed(1)}
                      <small>{signed(difference)}</small>
                    </td>
                  );
                })}
              </tr>
            )),
          )}
        </tbody>
      </table>
    </div>
  );
}

export default function TargetBacktest({ target }) {
  const [open, setOpen] = useState(false);
  // Nothing has been asked for at 0. A refused read is asked for again on the
  // next open, because a backtest nobody can request again is a dead end.
  const [attempt, setAttempt] = useState(0);
  const { status, backtest, error } = useTargetBacktest(target.id, attempt);

  const toggle = () => {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    if (status === 'idle' || status === 'error') setAttempt((count) => count + 1);
  };

  return (
    <section className="target-detail-section">
      <button
        type="button"
        className="target-backtest-toggle"
        aria-expanded={open}
        onClick={toggle}
      >
        {open ? 'Collapse backtest' : 'Expand backtest'}
      </button>
      {open && (
        <>
          <p className="eyebrow">Backtest · season to date · vs {target.opponent}</p>
          {status === 'loading' && <p role="status">Reading the season…</p>}
          {/* The backtest failing is its own failure. The Qualifiers, the
              readings and the fits above it are already on screen and stay
              there. */}
          {status === 'error' && (
            <p className="target-error" role="alert">
              {error}
            </p>
          )}
          {status === 'ready' && (
            <>
              {/* Box-score outcomes are the closest thing to a slice the game
                  logs hold, and saying so is the difference between reading
                  "points" and reading "corner 3s made". */}
              <p className="target-backtest-proxy">{backtest.proxy}</p>
              {backtest.players.length === 0 ? (
                <p className="target-empty">
                  Nobody qualifying has faced {backtest.target.opponent} yet.
                </p>
              ) : (
                <BacktestTable backtest={backtest} />
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}
