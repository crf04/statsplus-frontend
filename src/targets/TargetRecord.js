import { useState } from 'react';
import { Link } from 'react-router-dom';
import { filterSetToSearchParams } from '../filterUtils';
import { gameStat, seasonStat } from './statValues';
import StatPicker from './StatPicker';
import { signed } from './targetCatalog';
import './TargetRecord.css';

const gameDateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});
const number = (value) => (value == null ? '—' : value.toFixed(1));
const gameNumber = (value) => (value == null ? '—' : Number(value.toFixed(1)).toString());
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
            const value = gameStat(game, column);
            const average = seasonStat(player, column);
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
  onPreferencesChange,
  children,
}) {
  const games = recordGames(backtest, columns);
  const scale = scaleFor(games, gradedBy);
  return (
    <div className="target-record">
      <ul className="target-summary" aria-label="Backtest summary">
        <li aria-label="Games">
          <b>{games.length}</b>
          <small>games</small>
        </li>
        {columns.map((column) => {
          const margins = games
            .map((row) => row.margins[column])
            .filter((margin) => margin !== null);
          const mean = margins.length
            ? margins.reduce((total, margin) => total + margin, 0) / margins.length
            : null;
          const hitShare = margins.length
            ? margins.filter((margin) => margin > 0).length / margins.length
            : null;
          const rate = hitShare === null ? '—' : `${Math.round(hitShare * 100)}%`;
          const label = (
            <>
              <small>{column}</small>
              <b
                className={
                  hitShare === null
                    ? undefined
                    : hitShare > 0.5
                      ? 'is-hit'
                      : hitShare < 0.5
                        ? 'is-miss'
                        : undefined
                }
              >
                {rate}
                <span className="visually-hidden"> hit</span>
              </b>
              <small>{formatMargin(mean)} avg</small>
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
        {onPreferencesChange && (
          <li className="target-summary-picker">
            <StatPicker columns={columns} gradedBy={gradedBy} onChange={onPreferencesChange} />
          </li>
        )}
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
            const label = `${row.game.gameDate} · ${row.player.name} · ${number(gameStat(row.game, gradedBy))} ${gradedBy} · season ${number(seasonStat(row.player, gradedBy))} · ${formatMargin(row.margins[gradedBy])} margin`;
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
        <small title={backtest.proxy}>{gradedBy} vs the player’s own season average</small>
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
      <h2 className="target-section-heading target-games-heading">
        <span>Games</span>
        <small>
          {games.length} · newest first · graded on {gradedBy}
        </small>
      </h2>
      <ol>
        {(expanded ? newest : newest.slice(0, 12)).map((row) => (
          <li key={row.key}>
            <i className={grade(row.margins[gradedBy], scale)} aria-hidden="true" />
            <time dateTime={row.game.gameDate}>
              {gameDateFormatter.format(new Date(`${row.game.gameDate}T12:00:00Z`))}
            </time>
            <span className="target-game-who">
              <Link
                aria-label={`${row.player.name} games vs ${backtest.target.opponent}`}
                to={`/?${filterSetToSearchParams({ player_name: row.player.name, opponent_tricode: backtest.target.opponent })}`}
              >
                {row.player.name}
              </Link>{' '}
              <small>{row.player.tricode}</small>
            </span>
            <span className="target-game-line">
              <b>{gameNumber(gameStat(row.game, gradedBy))}</b> {gradedBy}
              <small> vs {number(seasonStat(row.player, gradedBy))}</small>
            </span>
            <span
              className={`target-game-margin ${row.margins[gradedBy] > 0 ? 'is-hit' : row.margins[gradedBy] < 0 ? 'is-miss' : ''}`}
              aria-label="margin"
            >
              {formatMargin(row.margins[gradedBy])}
            </span>
            <span className="target-game-rest">
              {columns
                .filter((column) => column !== gradedBy)
                .map((column) => (
                  <span key={column}>
                    {column} {gameNumber(gameStat(row.game, column))}{' '}
                    <em
                      className={
                        row.margins[column] > 0
                          ? 'is-hit'
                          : row.margins[column] < 0
                            ? 'is-miss'
                            : undefined
                      }
                    >
                      {formatMargin(row.margins[column])}
                    </em>
                  </span>
                ))}
            </span>
          </li>
        ))}
      </ol>
      {games.length > 12 && (
        <button type="button" onClick={() => setExpanded(!expanded)}>
          {expanded ? 'Show first 12 games' : `Show all ${games.length} games`}
        </button>
      )}
    </section>
  );
}
