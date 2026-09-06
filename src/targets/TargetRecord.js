import { useState } from 'react';
import { Link } from 'react-router-dom';
import { filterSetToSearchParams } from '../filterUtils';
import { signed } from './targetCatalog';
import './TargetRecord.css';

const number = (value) => (value == null ? '—' : value.toFixed(1));
const formatMargin = (value) => (value == null ? '—' : signed(value));

// Keep full precision through grading and arithmetic; round only for display.
function recordGames(backtest, columns) {
  return backtest.players
    .flatMap((player) =>
      player.games.map((game, index) => ({
        player,
        game,
        key: `${player.canonicalId}-${game.gameDate}-${index}`,
        margins: Object.fromEntries(
          columns.map((column) => {
            const value = game.stats[column];
            const average = player.seasonAverages[column];
            return [
              column,
              Number.isFinite(value) && Number.isFinite(average) ? value - average : null,
            ];
          }),
        ),
      })),
    )
    .sort((a, b) => a.game.gameDate.localeCompare(b.game.gameDate));
}

function scaleFor(games, column) {
  const margins = games
    .map((row) => row.margins[column])
    .filter((margin) => margin !== null)
    .map(Math.abs)
    .sort((a, b) => a - b);
  return margins[Math.min(margins.length - 1, Math.floor(margins.length * 0.9))] || 1;
}

function grade(margin, scale) {
  if (margin === null) return 'grade-unavailable';
  if (margin === 0) return 'grade-neutral';
  return `grade-${margin > 0 ? 'hit' : 'miss'}-${Math.min(4, Math.max(1, Math.ceil((Math.abs(margin) / scale) * 4)))}`;
}

export default function TargetRecord({
  backtest,
  columns = backtest.statColumns,
  gradedBy = columns[0],
  onGrade,
  children,
}) {
  const games = recordGames(backtest, columns);
  const scale = scaleFor(games, gradedBy);
  return (
    <div className="target-record">
      <p className="target-backtest-proxy">{backtest.proxy}</p>
      <ul className="target-summary" aria-label="Backtest summary">
        <li aria-label="Games">
          <span className="target-label">Games</span>
          <b>{games.length}</b>
        </li>
        {columns.map((column) => {
          const margins = games
            .map((row) => row.margins[column])
            .filter((margin) => margin !== null);
          const mean = margins.length
            ? margins.reduce((total, margin) => total + margin, 0) / margins.length
            : null;
          const rate = margins.length
            ? `${Math.round((margins.filter((margin) => margin > 0).length / margins.length) * 100)}%`
            : '—';
          const label = (
            <>
              <span>{column}</span>
              <b>{rate} hit</b>
              <small>{formatMargin(mean)} mean margin</small>
            </>
          );
          return (
            <li aria-label={column} key={column}>
              {onGrade ? (
                <button
                  type="button"
                  aria-pressed={gradedBy === column}
                  onClick={() => onGrade(column)}
                >
                  {label}
                </button>
              ) : (
                label
              )}
            </li>
          );
        })}
      </ul>
      {children}
      {games.length === 0 ? (
        <p className="target-empty">Nobody qualifying has faced {backtest.target.opponent} yet.</p>
      ) : (
        <ul
          className="target-record-grid"
          aria-label={`${games.length} games, oldest to newest, graded by ${gradedBy} margin`}
        >
          {games.map((row) => {
            const label = `${row.game.gameDate} · ${row.player.name} · ${number(row.game.stats[gradedBy])} ${gradedBy} · season ${number(row.player.seasonAverages[gradedBy])} · ${formatMargin(row.margins[gradedBy])} margin`;
            return (
              <li
                key={row.key}
                tabIndex={0}
                className={grade(row.margins[gradedBy], scale)}
                title={label}
                aria-label={label}
              />
            );
          })}
        </ul>
      )}
      <div className="target-grade-key">
        <span>short by more</span>
        {[
          'miss-4',
          'miss-3',
          'miss-2',
          'miss-1',
          'neutral',
          'hit-1',
          'hit-2',
          'hit-3',
          'hit-4',
        ].map((tone) => (
          <i key={tone} className={`grade-${tone}`} aria-hidden="true" />
        ))}
        <span>beat by more</span>
        <small>{gradedBy} vs the player’s own season average</small>
      </div>
    </div>
  );
}

export function TargetGameRows({
  backtest,
  columns = backtest.statColumns,
  gradedBy = columns[0],
}) {
  const [expanded, setExpanded] = useState(false);
  const games = recordGames(backtest, columns);
  const scale = scaleFor(games, gradedBy);
  const newest = [...games].reverse();
  return (
    <section className="target-game-rows" aria-label="Backtest games">
      <h2 className="target-section-heading">Games · newest first</h2>
      <ol>
        {(expanded ? newest : newest.slice(0, 20)).map((row) => (
          <li key={row.key}>
            <i className={grade(row.margins[gradedBy], scale)} aria-hidden="true" />
            <div>
              <time>{row.game.gameDate}</time>
              <b>
                <Link
                  aria-label={`${row.player.name} games vs ${backtest.target.opponent}`}
                  to={`/?${filterSetToSearchParams({ player_name: row.player.name, opponent_tricode: backtest.target.opponent })}`}
                >
                  {row.player.name}
                </Link>{' '}
                · {row.player.tricode}
              </b>
              <span>
                {number(row.game.stats[gradedBy])} {gradedBy} vs{' '}
                {number(row.player.seasonAverages[gradedBy])} season avg ·{' '}
                {formatMargin(row.margins[gradedBy])} margin
              </span>
              <small>
                {columns
                  .filter((column) => column !== gradedBy)
                  .map((column) => `${number(row.game.stats[column])} ${column}`)
                  .join(' · ')}
              </small>
            </div>
          </li>
        ))}
      </ol>
      {games.length > 20 && (
        <button type="button" onClick={() => setExpanded(!expanded)}>
          {expanded ? 'Show first 20 games' : `Show all ${games.length} games`}
        </button>
      )}
    </section>
  );
}
