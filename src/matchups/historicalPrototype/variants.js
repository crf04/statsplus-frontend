/*
 * PROTOTYPE — throwaway (branch prototype/historical-matchup-declutter).
 *
 * Question: how much of the Matchup page's provenance text can go, and what
 * should the player rail say about each player, for a finished game (his line
 * from that game) and for an upcoming one (his posted lines)?
 *
 * Every variant drops the sheet provenance line, the "Completed-season context"
 * line, the rail instruction and the repeated "No displayed Diet Shares" note,
 * and bumps the small type. They differ in how the evidence header collapses
 * and how the rail reads. The same slot holds the box score after the game and
 * the lines before it, so the rail keeps its shape across the two.
 */
import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { filterSetToSearchParams } from '../../filterUtils';
import { orderCategories } from '../displayConfig';
import { lineFor } from './demo';

const BOOK_SHORT = { prizepicks: 'PP', underdog: 'UD' };
const BOOK_NAMES = { prizepicks: 'PrizePicks', underdog: 'Underdog' };

const ET = { timeZone: 'America/New_York' };
const gameDate = (game) =>
  new Date(game.scheduledAt).toLocaleDateString('en-US', {
    ...ET,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
const clock = (iso) =>
  new Date(iso).toLocaleTimeString('en-US', { ...ET, hour: 'numeric', minute: '2-digit' });
const gameWhen = (game) =>
  `${gameDate(game)} · ${game.status === 'final' ? 'Final' : game.statusLabel || 'Scheduled'}`;

const fmt = (value) => (Number.isInteger(value) ? String(value) : value.toFixed(1));
const formatPercent = (value) => `${value >= 0 ? '+' : ''}${Math.round(value * 100)}%`;
const gameLogsPath = (player) => `/?${filterSetToSearchParams({ player_name: player.name })}`;
const average = (values) =>
  values.length ? values.reduce((total, value) => total + value, 0) / values.length : null;
const BOX = ['PTS', 'REB', 'AST', '3PM'];
const boxColumns = (market) => (market === 'All' || BOX.includes(market) ? BOX : [...BOX, market]);

const bySeasonScoring = (players, market) =>
  players
    .filter((player) => market === 'All' || player.statCategories.includes(market))
    .sort((a, b) => (b.seasonScoring ?? -1) - (a.seasonScoring ?? -1));

const scoreFor = (player, market, windowKey) => {
  const score = player.scores[market]?.[windowKey];
  if (!score || (score.blend === null && score.missingInputs.length > 0)) return null;
  return score.blend?.value ?? Object.values(score.components)[0]?.value ?? null;
};

const booksFor = (player) => Object.keys(player.provenance || {});
const hasNoLineNumbers = (players) => players.every((player) => lineFor(player, 'PTS') === null);

/*
 * One cell of the rail. After the game: his number. Before it: his line, or,
 * with today's contract (no line numbers), whether the market is posted.
 */
const cellFor = (player, column) => {
  const line = player.focalGameLine;
  if (line) return column === 'MIN' ? String(Math.round(line.minutes)) : fmt(line.stats[column]);
  if (column === 'MIN') {
    const minutes = average(player.last10Minutes);
    return minutes === null ? '–' : String(Math.round(minutes));
  }
  if (!player.postedMarkets.includes(column)) return '–';
  const value = lineFor(player, column);
  return value === null ? '✓' : fmt(value);
};

/* ------------------------------ Evidence ------------------------------ */

// What the header still has to say, as [key, label, ok, detail] facts.
const evidenceFacts = (matchup, reasonFor) => {
  const { sections } = matchup.experience;
  const upcoming = matchup.experience.mode !== 'historical';
  const pool = matchup.freshness.pool;
  const books = pool.providers.map((provider) => provider.name);
  return [
    upcoming
      ? [
          'lines',
          'Lines',
          pool.status !== 'missing' && pool.status !== 'unavailable',
          books.length
            ? `${books.map((name) => BOOK_NAMES[name] || name).join(', ')} · ${clock(pool.retrievedAt)}`
            : 'No lines posted yet',
        ]
      : ['seasonDefense', 'Season defense', true, 'Full-season ranks'],
    [
      'last15Defense',
      'Last 15',
      sections.last15Defense.status === 'available',
      reasonFor(sections.last15Defense),
    ],
    [
      'injuries',
      'Injuries',
      upcoming
        ? matchup.injuries.status !== 'unavailable'
        : sections.injuries.status === 'available',
      upcoming ? 'No injury report yet' : reasonFor(sections.injuries),
    ],
  ];
};

export function ProtoEvidence({ variant, matchup, reasonFor }) {
  const { game } = matchup;
  const upcoming = matchup.experience.mode !== 'historical';
  const facts = evidenceFacts(matchup, reasonFor);
  if (variant === 'A') {
    return (
      <div className="pe-a" aria-label="Matchup evidence">
        <span className="pe-date">{gameWhen(game)}</span>
        <ul>
          {facts.map(([key, label, ok, detail]) => (
            <li key={key} className={ok ? 'ok' : 'missing'} title={detail}>
              <span aria-hidden="true">{ok ? '●' : '○'}</span> {label}
              {ok ? (key === 'lines' ? ` · ${detail}` : '') : ' n/a'}
            </li>
          ))}
        </ul>
      </div>
    );
  }
  if (variant === 'B') {
    return (
      <div className="pe-b">
        <span className="pe-date">{gameWhen(game)}</span>
        <details>
          <summary>About this data</summary>
          <dl>
            {facts.map(([key, label, ok, detail]) => (
              <div key={key}>
                <dt>{label}</dt>
                <dd>{ok ? detail : `Unavailable — ${detail}`}</dd>
              </div>
            ))}
            {!upcoming && (
              <div>
                <dt>Players</dt>
                <dd>From game logs</dd>
              </div>
            )}
          </dl>
        </details>
      </div>
    );
  }
  const missing = facts.filter(([, , ok]) => !ok).map(([, label]) => label.toLowerCase());
  const lines = facts.find(([key]) => key === 'lines');
  return (
    <p className="pe-c">
      {gameWhen(game)}.{' '}
      <span>
        {upcoming
          ? lines[2]
            ? `Lines from ${lines[3]}`
            : 'No lines posted yet'
          : 'Full-season defense ranks'}
        {missing.length ? `; no ${missing.join(' or ')} yet.` : '.'}
      </span>
    </p>
  );
}

/* -------------------------------- Rails -------------------------------- */

export function ProtoRail(props) {
  if (props.variant === 'A') return <RailGrid {...props} />;
  if (props.variant === 'B') return <RailTable {...props} />;
  return <RailFocus {...props} />;
}

const Books = ({ player }) => {
  const books = booksFor(player);
  if (!books.length) return null;
  return (
    <span className="pr-books" title={books.map((name) => BOOK_NAMES[name] || name).join(', ')}>
      {books.map((name) => (
        <i key={name}>{BOOK_SHORT[name] || name}</i>
      ))}
    </span>
  );
};

// A: one card per player; a small labelled grid holds the box score after the
// game and the lines before it. Today's contract has no line numbers, so it
// falls back to the posted markets as chips.
function RailGrid({
  players,
  market,
  selectedId,
  onSelect,
  registerTrigger,
  teamTricode,
  upcoming,
}) {
  const bare = upcoming && hasNoLineNumbers(players);
  const columns = [upcoming ? 'L10 MIN' : 'MIN', ...boxColumns(market)];
  return (
    <aside className="player-rail pr-a" aria-label="Players in game">
      <p className="matchup-eyebrow">
        {teamTricode} players · {upcoming ? (bare ? 'posted markets' : 'lines') : 'this game'}
      </p>
      <div className="pr-a-list">
        {bySeasonScoring(players, market).map((player) => {
          const id = String(player.id);
          return (
            <article
              key={player.id}
              aria-label={`${player.name} player`}
              className={`pr-a-card${selectedId === id ? ' selected' : ''}`}
            >
              <div className="pr-a-top">
                <Link className="player-game-logs" to={gameLogsPath(player)}>
                  {player.name}
                  <ArrowUpRight size={12} strokeWidth={2.4} aria-hidden="true" />
                </Link>
                <span className="pr-a-ppg">
                  {upcoming && <Books player={player} />}
                  {player.seasonScoring !== null && `${player.seasonScoring.toFixed(1)} PPG`}
                </span>
              </div>
              <button
                type="button"
                ref={(node) => registerTrigger(id, node)}
                className={bare ? 'pr-a-chips' : 'pr-a-grid'}
                style={{ '--cols': columns.length }}
                aria-expanded={selectedId === id}
                aria-controls="matchup-selection-card"
                aria-label={`Open ${player.name} selection card`}
                onClick={() => onSelect(player)}
              >
                {bare
                  ? orderCategories(player.postedMarkets).map((posted) => (
                      <span key={posted} className={posted === market ? 'hot' : undefined}>
                        {posted}
                      </span>
                    ))
                  : columns.map((column) => (
                      <span key={column} className={column === market ? 'hot' : undefined}>
                        <small>{column}</small>
                        <b>{cellFor(player, column === 'L10 MIN' ? 'MIN' : column)}</b>
                      </span>
                    ))}
              </button>
            </article>
          );
        })}
      </div>
    </aside>
  );
}

// B: one table, box score after the game and lines before it. Rows open the
// card; with a market picked its column is lit and the Matchup Score joins.
function RailTable({
  players,
  market,
  windowKey,
  selectedId,
  onSelect,
  registerTrigger,
  teamTricode,
  upcoming,
}) {
  const bare = upcoming && hasNoLineNumbers(players);
  const columns = [upcoming ? 'L10' : 'MIN', ...boxColumns(market)];
  const showScore = market !== 'All';
  return (
    <aside className="player-rail pr-b" aria-label="Players in game">
      <div className="pr-b-head">
        <p className="matchup-eyebrow">
          {teamTricode} {upcoming ? (bare ? 'posted markets' : 'lines') : 'box score'}
        </p>
        <span>Tap a row for the full card</span>
      </div>
      <table>
        <thead>
          <tr>
            <th scope="col">Player</th>
            {columns.map((column) => (
              <th
                key={column}
                scope="col"
                className={column === market ? 'hot' : undefined}
                title={column === 'L10' ? 'Minutes, last 10 games' : undefined}
              >
                {column}
              </th>
            ))}
            {showScore && (
              <th scope="col" title={`${market} Matchup Score`}>
                Score
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {bySeasonScoring(players, market).map((player) => {
            const id = String(player.id);
            const score = showScore ? scoreFor(player, market, windowKey) : null;
            return (
              <tr
                key={player.id}
                className={selectedId === id ? 'selected' : undefined}
                onClick={() => onSelect(player)}
              >
                <th scope="row">
                  <span className="pr-b-name">
                    <button
                      type="button"
                      ref={(node) => registerTrigger(id, node)}
                      aria-expanded={selectedId === id}
                      aria-controls="matchup-selection-card"
                      onClick={(event) => {
                        event.stopPropagation();
                        onSelect(player);
                      }}
                    >
                      {player.name.replace(/^(\S)\S*\s/, '$1. ')}
                    </button>
                    <Link
                      aria-label={`${player.name} game logs`}
                      to={gameLogsPath(player)}
                      onClick={(event) => event.stopPropagation()}
                    >
                      <ArrowUpRight size={11} strokeWidth={2.4} aria-hidden="true" />
                    </Link>
                  </span>
                </th>
                {columns.map((column) => {
                  const value = cellFor(player, column === 'L10' ? 'MIN' : column);
                  const classes = [
                    column === market && 'hot',
                    (value === '–' || column === 'L10') && 'muted',
                  ].filter(Boolean);
                  return (
                    <td key={column} className={classes.join(' ') || undefined}>
                      {value}
                    </td>
                  );
                })}
                {showScore && (
                  <td className={score === null ? 'muted' : score >= 0 ? 'up' : 'down'}>
                    {score === null ? '–' : formatPercent(score)}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </aside>
  );
}

// C: one number per player for the stat the sheet is filtered to (PTS on All).
// After the game: what he did, against his average. Before it: his line,
// against his average. With no line numbers: his Matchup Score for that stat.
function RailFocus({
  players,
  market,
  windowKey,
  selectedId,
  onSelect,
  registerTrigger,
  teamTricode,
  upcoming,
}) {
  const stat = market === 'All' ? 'PTS' : market;
  const rows = bySeasonScoring(players, market);
  const bare = upcoming && hasNoLineNumbers(rows);
  const valueOf = (player) =>
    upcoming
      ? bare
        ? scoreFor(player, stat, windowKey)
        : lineFor(player, stat)
      : (player.focalGameLine?.stats[stat] ?? null);
  const max = Math.max(1, ...rows.map((player) => Math.abs(valueOf(player) ?? 0)));
  return (
    <aside className="player-rail pr-c" aria-label="Players in game">
      <p className="matchup-eyebrow">
        {teamTricode} · {stat} {upcoming ? (bare ? 'Matchup Score' : 'line') : 'this game'}
      </p>
      <div className="pr-c-list">
        {rows.map((player) => {
          const id = String(player.id);
          const value = valueOf(player);
          const seasonAverage = stat === 'PTS' ? player.seasonScoring : null;
          const delta =
            !bare && value !== null && seasonAverage !== null ? value - seasonAverage : null;
          const minutes = player.focalGameLine
            ? `${Math.round(player.focalGameLine.minutes)} min`
            : `${Math.round(average(player.last10Minutes) ?? 0)} min L10`;
          return (
            <button
              type="button"
              key={player.id}
              ref={(node) => registerTrigger(id, node)}
              className={`pr-c-row${selectedId === id ? ' selected' : ''}`}
              aria-expanded={selectedId === id}
              aria-controls="matchup-selection-card"
              onClick={() => onSelect(player)}
            >
              <span className="pr-c-name">
                <span>
                  {player.name}
                  {upcoming && <Books player={player} />}
                </span>
                <small>
                  {minutes}
                  {delta !== null && (
                    <em className={upcoming ? undefined : delta >= 0 ? 'up' : 'down'}>
                      {' · '}
                      {upcoming ? 'line ' : ''}
                      {delta >= 0 ? '+' : '−'}
                      {Math.abs(delta).toFixed(1)} vs {seasonAverage.toFixed(1)} avg
                    </em>
                  )}
                </small>
              </span>
              <b className={bare && value !== null ? (value >= 0 ? 'up' : 'down') : undefined}>
                {value === null ? '–' : bare ? formatPercent(value) : fmt(value)}
              </b>
              <i style={{ width: `${(Math.abs(value ?? 0) / max) * 100}%` }} aria-hidden="true" />
            </button>
          );
        })}
      </div>
    </aside>
  );
}
