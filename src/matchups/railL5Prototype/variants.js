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
  const SLOT = 30;
  const BAR = 20;
  const H = 36;
  const W = SLOT * 5;
  const max = Math.max(...games.map((g) => g.value), mark ?? 0, 1) * 1.1;
  const y = (v) => H - (v / max) * H;
  return (
    <Link className="l5-bars" to={to} aria-label={`${label} game logs`}>
      <svg width={W} height={H + 13} viewBox={`0 0 ${W} ${H + 13}`} aria-hidden="true">
        {Array.from({ length: 5 }, (_, i) => {
          const g = games[i];
          const x = i * SLOT + (SLOT - BAR) / 2;
          if (!g)
            return <rect key={i} className="l5-bar-empty" x={x} y={H - 2} width={BAR} height={2} rx="1" />;
          return (
            <g key={g.date}>
              <rect
                className={`l5-bar l5-${sideOf(g.value, mark)}`}
                x={x}
                y={y(g.value)}
                width={BAR}
                height={Math.max(H - y(g.value), 2)}
                rx="2"
              />
              <text x={x + BAR / 2} y={H + 11} textAnchor="middle">
                {fmt(g.value)}
              </text>
            </g>
          );
        })}
        {mark !== null && <line className="l5-mark" x1="0" x2={W} y1={y(mark)} y2={y(mark)} />}
      </svg>
      <span className="l5-bars-side">
        <span className="l5-caption">Last {games.length}</span>
        <span className="l5-go">
          Game logs <ArrowUpRight size={12} strokeWidth={2.4} aria-hidden="true" />
        </span>
      </span>
    </Link>
  );
}

function MicroBars({ games, mark }) {
  const H = 16;
  const max = Math.max(...games.map((g) => g.value), mark ?? 0, 1) * 1.1;
  const y = (v) => H - (v / max) * H;
  return (
    <svg className="l5-micro" width={5 * 9} height={H} viewBox={`0 0 ${5 * 9} ${H}`} aria-hidden="true">
      {Array.from({ length: 5 }, (_, i) => {
        // Newest on the right; a game not yet played is an empty stub on the left.
        const g = games[i - (5 - games.length)];
        if (!g) return <rect key={i} className="l5-bar-empty" x={i * 9} y={H - 1.5} width="7" height="1.5" rx="0.75" />;
        return (
          <rect
            key={g.date}
            className={`l5-bar l5-${sideOf(g.value, mark)}`}
            x={i * 9}
            y={y(g.value)}
            width="7"
            height={Math.max(H - y(g.value), 1.5)}
            rx="1"
          />
        );
      })}
      {mark !== null && <line className="l5-mark" x1="0" x2={5 * 9} y1={y(mark)} y2={y(mark)} />}
    </svg>
  );
}

function ScoreBadge({ score }) {
  if (!score) return <span className="l5-badge l5-score-none" title="No Matchup Score">—</span>;
  const pct = Math.round(score.value * 100);
  const tone = pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat';
  return (
    <span
      className={`l5-badge l5-tone-${tone}${score.thin ? ' l5-thin' : ''}`}
      title={`Matchup Score ${formatScorePercent(score.value)}${score.thin ? ' · thin sample' : ''}`}
    >
      {formatScorePercent(score.value)}
    </span>
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
            <ScoreLine score={score} />
            {injury}
          </p>
        </div>
        <div className="rail-row-value">{valueBlock}</div>
        {!loading && <Bars games={games} mark={mark} to={gameLogsPath} label={player.name} />}
        {openButton}
      </article>
    );
  }
  if (variant === 'E') {
    return (
      <article aria-label={`${player.name} player`} className={cls}>
        <div className="rail-row-name">
          <h3>
            <Link aria-label={`${player.name} game logs`} className="player-game-logs" to={gameLogsPath}>
              {player.name}
            </Link>{' '}
            <ScoreBadge score={score} />
          </h3>
          {injury && <p>{injury}</p>}
        </div>
        <div className="rail-row-value">{valueBlock}</div>
        {!loading && (
          <Link className="l5-pill" to={gameLogsPath} aria-label={`${player.name} game logs`}>
            <span>L5</span>
            <MicroBars games={games} mark={mark} />
            <span className="l5-go">
              Game logs <ArrowUpRight size={12} strokeWidth={2.4} aria-hidden="true" />
            </span>
          </Link>
        )}
        {openButton}
      </article>
    );
  }
  if (variant === 'C') {
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
        {!loading && (
            <Link className="l5-pill" to={gameLogsPath} aria-label={`${player.name} game logs`}>
              <span>L{games.length}</span>
              <Dots games={games} mark={mark} />
              <span className="l5-go">
                Game logs <ArrowUpRight size={12} strokeWidth={2.4} aria-hidden="true" />
              </span>
            </Link>
          )}
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
