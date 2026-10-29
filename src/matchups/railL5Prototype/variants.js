/*
 * PROTOTYPE — throwaway. Four takes on putting the Matchup Score and a Last 5
 * against the line into a rail row; O is today's row. Each take keeps the
 * row's own button (opens the selection card) and makes the Last 5 a link to
 * the player's Game Logs.
 */
import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { formatScorePercent } from '../displayConfig';
import { useLastFive } from './useLastFive';
import './railL5.css';

const fmt = (value) => (Number.isInteger(value) ? String(value) : value.toFixed(1));
const shortDate = (iso) => {
  const [, m, d] = String(iso).slice(0, 10).split('-');
  return `${Number(m)}/${Number(d)}`;
};
const opponentOf = (matchup) => String(matchup ?? '').split(/ (?:@|vs\.) /)[1] ?? '';

// Same rule as the row's score, keeping the thin flag the rail drops.
export const scoreCellFor = (player, stat, windowKey) => {
  const score = player.scores[stat]?.[windowKey];
  if (!score) return null;
  if (score.blend === null && score.missingInputs.length > 0) return null;
  return score.blend ?? Object.values(score.components)[0] ?? null;
};

const sideOf = (value, mark) =>
  mark === null ? 'flat' : value > mark ? 'over' : value < mark ? 'under' : 'push';

function ScoreLine({ score, compact }) {
  if (!score)
    return <span className="l5-score l5-score-none">{compact ? 'Score —' : 'No Matchup Score'}</span>;
  const pct = Math.round(score.value * 100);
  const tone = pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat';
  return (
    <span className={`l5-score l5-tone-${tone}`}>
      {compact ? 'Score' : 'Matchup Score'} <b>{formatScorePercent(score.value)}</b>
      {score.thin && <em> · thin</em>}
    </span>
  );
}

const hitSummary = (games, mark) => {
  const over = games.filter((g) => g.value > mark).length;
  return `${over}/${games.length}`;
};

function Tiles({ games, mark, to, label }) {
  return (
    <Link className="l5-tiles" to={to} aria-label={`${label} game logs`}>
      <span className="l5-caption">
        L{games.length}
        {mark !== null && (
          <>
            {' '}
            vs {fmt(mark)} <b>{hitSummary(games, mark)}</b>
          </>
        )}
      </span>
      <span className="l5-tile-row">
        {games.map((g) => (
          <span key={g.date} className={`l5-tile l5-${sideOf(g.value, mark)}`} title={`${g.matchup} ${g.date}`}>
            <b>{fmt(g.value)}</b>
            <small>{opponentOf(g.matchup) || shortDate(g.date)}</small>
          </span>
        ))}
      </span>
      <span className="l5-go">
        Game logs <ArrowUpRight size={12} strokeWidth={2.4} aria-hidden="true" />
      </span>
    </Link>
  );
}

function Bars({ games, mark, to, label }) {
  const W = 104;
  const H = 34;
  const max = Math.max(...games.map((g) => g.value), mark ?? 0, 1) * 1.08;
  const slot = W / 5;
  const y = (v) => H - (v / max) * H;
  return (
    <Link className="l5-bars" to={to} aria-label={`${label} game logs`}>
      <svg width={W} height={H + 12} viewBox={`0 0 ${W} ${H + 12}`} aria-hidden="true">
        {games.map((g, i) => (
          <g key={g.date}>
            <rect
              className={`l5-bar l5-${sideOf(g.value, mark)}`}
              x={i * slot + 3}
              y={y(g.value)}
              width={slot - 6}
              height={H - y(g.value)}
              rx="2"
            />
            <text x={i * slot + slot / 2} y={H + 10} textAnchor="middle">
              {fmt(g.value)}
            </text>
          </g>
        ))}
        {mark !== null && <line className="l5-mark" x1="0" x2={W} y1={y(mark)} y2={y(mark)} />}
      </svg>
      <span className="l5-caption">
        L{games.length}
        {mark !== null && <> · {hitSummary(games, mark)} over</>} <ArrowUpRight size={11} strokeWidth={2.4} aria-hidden="true" />
      </span>
    </Link>
  );
}

function Dots({ games, mark }) {
  return (
    <span className="l5-dots" aria-hidden="true">
      {games.map((g) => (
        <i key={g.date} className={`l5-${sideOf(g.value, mark)}`} />
      ))}
    </span>
  );
}

export function ProtoRailRow({
  variant,
  player,
  stat,
  season,
  windowKey,
  headline,
  seasonAverage,
  gameLogsPath,
  selected,
  nameLink,
  valueBlock,
  injury,
  openButton,
}) {
  const games = useLastFive(player.name, season, stat) ?? [];
  const score = scoreCellFor(player, stat, windowKey);
  // The line when one is posted; otherwise his season average stands in.
  const mark = headline ?? seasonAverage ?? null;
  const loading = games.length === 0;
  const cls = `rail-row l5-row l5-v${variant}${selected ? ' selected' : ''}`;

  if (variant === 'A') {
    return (
      <article aria-label={`${player.name} player`} className={cls}>
        <div className="rail-row-name">
          <h3>{nameLink}</h3>
          <p>
            <ScoreLine score={score} />
            {injury}
          </p>
        </div>
        <div className="rail-row-value">{valueBlock}</div>
        {!loading && <Tiles games={games} mark={mark} to={gameLogsPath} label={player.name} />}
        {openButton}
      </article>
    );
  }
  if (variant === 'B') {
    return (
      <article aria-label={`${player.name} player`} className={cls}>
        <div className="rail-row-name">
          <h3>{nameLink}</h3>
          <p>
            <ScoreLine score={score} compact />
            {injury}
          </p>
        </div>
        {!loading ? <Bars games={games} mark={mark} to={gameLogsPath} label={player.name} /> : <span />}
        <div className="rail-row-value">{valueBlock}</div>
        {openButton}
      </article>
    );
  }
  if (variant === 'C') {
    return (
      <article aria-label={`${player.name} player`} className={cls}>
        <div className="rail-row-name">
          <h3>{nameLink}</h3>
          <p className="l5-pills">
            <ScoreLine score={score} compact />
            {!loading && (
              <Link className="l5-pill" to={gameLogsPath} aria-label={`${player.name} game logs`}>
                L{games.length} {mark !== null && <b>{hitSummary(games, mark)}</b>}
                <Dots games={games} mark={mark} />
                <ArrowUpRight size={11} strokeWidth={2.4} aria-hidden="true" />
              </Link>
            )}
            {injury}
          </p>
        </div>
        <div className="rail-row-value">{valueBlock}</div>
        {openButton}
      </article>
    );
  }
  // D: one footer line under the whole row.
  return (
    <article aria-label={`${player.name} player`} className={cls}>
      <div className="rail-row-name">
        <h3>{nameLink}</h3>
        {injury && <p>{injury}</p>}
      </div>
      <div className="rail-row-value">{valueBlock}</div>
      <div className="l5-footer">
        <ScoreLine score={score} />
        {!loading && (
          <Link className="l5-footer-logs" to={gameLogsPath} aria-label={`${player.name} game logs`}>
            <span className="l5-caption">L{games.length}</span>
            {games.map((g) => (
              <b key={g.date} className={`l5-${sideOf(g.value, mark)}`}>
                {fmt(g.value)}
              </b>
            ))}
            <ArrowUpRight size={12} strokeWidth={2.4} aria-hidden="true" />
          </Link>
        )}
      </div>
      {openButton}
    </article>
  );
}
