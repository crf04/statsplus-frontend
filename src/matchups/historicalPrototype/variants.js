/*
 * PROTOTYPE — throwaway (branch prototype/historical-matchup-declutter).
 *
 * Question: how much of the historical Matchup page's provenance text can go,
 * and how should a player's line from this game read in the rail?
 *
 * Every variant drops the sheet provenance line, the "Completed-season context"
 * line, the rail instruction and the repeated "No displayed Diet Shares" note,
 * and bumps the small type. They differ in how the evidence header collapses
 * and how the rail shows the game line.
 */
import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { filterSetToSearchParams } from '../../filterUtils';

const MISSING_LABELS = {
  last15Defense: 'Last 15 defense',
  injuries: 'Injuries',
  seasonDefense: 'Season defense',
  participants: 'Players',
  schedule: 'Schedule',
};

const gameDate = (game) =>
  new Date(game.scheduledAt).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'America/New_York',
  });

const missingSections = (sections) =>
  Object.keys(MISSING_LABELS).filter((key) => sections[key]?.status !== 'available');

const fmt = (value) => (Number.isInteger(value) ? String(value) : value.toFixed(1));
const formatPercent = (value) => `${value >= 0 ? '+' : ''}${Math.round(value * 100)}%`;
const gameLogsPath = (player) => `/?${filterSetToSearchParams({ player_name: player.name })}`;
const BOX = ['PTS', 'REB', 'AST', '3PM'];
const boxColumns = (market) => (market === 'All' || BOX.includes(market) ? BOX : [...BOX, market]);

const bySeasonScoring = (players, market) =>
  players
    .filter((player) => market === 'All' || player.statCategories.includes(market))
    .sort((a, b) => (b.seasonScoring ?? -1) - (a.seasonScoring ?? -1));

/* ------------------------------ Evidence ------------------------------ */

export function ProtoEvidence({ variant, sections, game, reasonFor }) {
  const missing = missingSections(sections);
  if (variant === 'A') {
    const chips = [
      ['seasonDefense', 'Season defense'],
      ['last15Defense', 'Last 15'],
      ['injuries', 'Injuries'],
    ];
    return (
      <div className="pe-a" aria-label="Historical matchup evidence">
        <span className="pe-date">{gameDate(game)} · Final</span>
        <ul>
          {chips.map(([key, label]) => {
            const ok = sections[key].status === 'available';
            return (
              <li
                key={key}
                className={ok ? 'ok' : 'missing'}
                title={ok ? 'Saved' : reasonFor(sections[key])}
              >
                <span aria-hidden="true">{ok ? '●' : '○'}</span> {label}
                {ok ? '' : ' n/a'}
              </li>
            );
          })}
        </ul>
      </div>
    );
  }
  if (variant === 'B') {
    return (
      <div className="pe-b">
        <span className="pe-date">{gameDate(game)} · Final</span>
        <details>
          <summary>About this data</summary>
          <dl>
            {Object.entries(MISSING_LABELS)
              .reverse()
              .map(([key, label]) => (
                <div key={key}>
                  <dt>{label}</dt>
                  <dd>
                    {sections[key].status === 'available'
                      ? key === 'seasonDefense'
                        ? 'Full-season ranks'
                        : 'Saved'
                      : reasonFor(sections[key])}
                  </dd>
                </div>
              ))}
          </dl>
        </details>
      </div>
    );
  }
  return (
    <p className="pe-c">
      {gameDate(game)} · Final.{' '}
      <span>
        Full-season defense ranks
        {missing.length
          ? `; no ${missing.map((key) => MISSING_LABELS[key].toLowerCase()).join(' or ')} saved for this game.`
          : '.'}
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

// A: one card per player, the game line as a small labelled grid.
function RailGrid({ players, market, selectedId, onSelect, registerTrigger, teamTricode }) {
  const columns = ['MIN', ...boxColumns(market)];
  return (
    <aside className="player-rail pr-a" aria-label="Players in game">
      <p className="matchup-eyebrow">{teamTricode} players · this game</p>
      <div className="pr-a-list">
        {bySeasonScoring(players, market).map((player) => {
          const id = String(player.id);
          const line = player.focalGameLine;
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
                {player.seasonScoring !== null && (
                  <span className="pr-a-ppg">{player.seasonScoring.toFixed(1)} PPG</span>
                )}
              </div>
              <button
                type="button"
                ref={(node) => registerTrigger(id, node)}
                className="pr-a-grid"
                style={{ '--cols': columns.length }}
                aria-expanded={selectedId === id}
                aria-controls="matchup-selection-card"
                aria-label={`Open ${player.name} selection card`}
                onClick={() => onSelect(player)}
              >
                {columns.map((column) => (
                  <span key={column} className={column === market ? 'hot' : undefined}>
                    <small>{column}</small>
                    <b>
                      {line
                        ? column === 'MIN'
                          ? Math.round(line.minutes)
                          : fmt(line.stats[column])
                        : '–'}
                    </b>
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

// B: a real box score. Rows open the card; the market column is lit, and with
// a market picked the Matchup Score sorts and joins as the last column.
function RailTable({
  players,
  market,
  windowKey,
  selectedId,
  onSelect,
  registerTrigger,
  teamTricode,
}) {
  const columns = ['MIN', ...boxColumns(market)];
  const scoreFor = (player) => {
    const score = player.scores[market]?.[windowKey];
    if (!score || (score.blend === null && score.missingInputs.length > 0)) return null;
    return score.blend?.value ?? Object.values(score.components)[0]?.value ?? null;
  };
  const showScore = market !== 'All';
  const rows = bySeasonScoring(players, market);
  return (
    <aside className="player-rail pr-b" aria-label="Players in game">
      <div className="pr-b-head">
        <p className="matchup-eyebrow">{teamTricode} box score</p>
        <span>Tap a row for the full card</span>
      </div>
      <table>
        <thead>
          <tr>
            <th scope="col">Player</th>
            {columns.map((column) => (
              <th key={column} scope="col" className={column === market ? 'hot' : undefined}>
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
          {rows.map((player) => {
            const id = String(player.id);
            const line = player.focalGameLine;
            const score = showScore ? scoreFor(player) : null;
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
                {columns.map((column) => (
                  <td key={column} className={column === market ? 'hot' : undefined}>
                    {line
                      ? column === 'MIN'
                        ? Math.round(line.minutes)
                        : fmt(line.stats[column])
                      : '–'}
                  </td>
                ))}
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

// C: one number per player, the stat the sheet is filtered to (PTS on All),
// read against his season average where the payload has one.
function RailFocus({ players, market, selectedId, onSelect, registerTrigger, teamTricode }) {
  const stat = market === 'All' ? 'PTS' : market;
  const rows = bySeasonScoring(players, market);
  const max = Math.max(1, ...rows.map((player) => player.focalGameLine?.stats[stat] ?? 0));
  return (
    <aside className="player-rail pr-c" aria-label="Players in game">
      <p className="matchup-eyebrow">
        {teamTricode} · {stat} this game
      </p>
      <div className="pr-c-list">
        {rows.map((player) => {
          const id = String(player.id);
          const line = player.focalGameLine;
          const value = line?.stats[stat] ?? null;
          const average = stat === 'PTS' ? player.seasonScoring : null;
          const delta = value !== null && average !== null ? value - average : null;
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
                {player.name}
                <small>
                  {line ? `${Math.round(line.minutes)} min` : 'DNP'}
                  {delta !== null && (
                    <em className={delta >= 0 ? 'up' : 'down'}>
                      {' · '}
                      {delta >= 0 ? '+' : '−'}
                      {Math.abs(delta).toFixed(1)} vs {average.toFixed(1)} avg
                    </em>
                  )}
                </small>
              </span>
              <b>{value === null ? '–' : fmt(value)}</b>
              <i style={{ width: `${((value ?? 0) / max) * 100}%` }} aria-hidden="true" />
            </button>
          );
        })}
      </div>
    </aside>
  );
}
