import { useState } from 'react';
import { Link } from 'react-router-dom';
import { filterSetToSearchParams } from '../filterUtils';
import { formatObservedShare, formatQualifierParts, signed } from './targetCatalog';
import { useTargetBacktest } from './useTargets';
import './TargetFits.css';

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
    <div className="target-fits-wrap">
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
        {/* One row group per player, so every game reads under the player who
            played it rather than under the row above it. */}
        {players.map((player) => (
          <tbody key={player.canonicalId}>
            {player.games.map((game, index) => (
              <tr key={game.gameDate}>
                {index === 0 && (
                  <th scope="rowgroup" rowSpan={player.games.length}>
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
                  </th>
                )}
                <td className="target-backtest-date">{game.gameDate}</td>
                {statColumns.map((column) => {
                  // Read at the precision it is shown at, so a game that lands
                  // on the average is exactly zero rather than nearly zero.
                  const difference =
                    Math.round((game.stats[column] - player.seasonAverages[column]) * 10) / 10;
                  // A game at the average is neither a hit nor a miss, and
                  // says so by being coloured as neither.
                  const tone = difference === 0 ? '' : difference > 0 ? ' is-hit' : ' is-miss';
                  return (
                    <td className={`num${tone}`} key={column}>
                      {game.stats[column].toFixed(1)}
                      <small>{signed(difference)}</small>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        ))}
      </table>
    </div>
  );
}

export default function TargetBacktest({ target }) {
  const [open, setOpen] = useState(false);
  const { status, backtest, error, read } = useTargetBacktest(target.id);

  const toggle = () => {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    // A backtest already in hand is kept rather than read again. A refused one
    // is read again, because a backtest nobody can ask for twice is a dead end.
    if (status === 'idle' || status === 'error') read();
  };

  return (
    <section className="target-detail-section" aria-labelledby="backtest-heading">
      <h2 id="backtest-heading" className="target-section-heading">
        Backtest · season to date · vs {target.opponent}
      </h2>
      <button
        type="button"
        className="target-backtest-toggle"
        aria-controls="target-backtest-body"
        aria-expanded={open}
        onClick={toggle}
      >
        {open ? 'Collapse backtest' : 'Expand backtest'}
      </button>
      {open && (
        <div className="target-backtest-body" id="target-backtest-body">
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
        </div>
      )}
    </section>
  );
}
