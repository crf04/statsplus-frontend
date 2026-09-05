/*
 * PROTOTYPE — throwaway. The Matchups (slate) page with a partial-screen
 * region for the Targets active on that date. Standalone build: mock slate.
 *   A · a region above the board
 *   B · a sticky side column beside the board
 *   C · fits expanded under each game row that has a Target
 */
import { Link, useSearchParams } from 'react-router-dom';
import { formatCalendarDate, parseCalendarDate, shiftCalendarDate } from '../../calendarDate';
import '../../SlatePage.css';
import '../../matchups/MatchupDetailPage.css';
import './prototype.css';
import { DEMO_DATE, PAGE_PATH, protoQuery, useVariant } from './prototypeMode';
import { useTargetsStore } from './targetsStore';
import { useResolvedTargets } from './resolveTargets';
import PrototypeSwitcher from './PrototypeSwitcher';
import { Context, FitChips, FitTable, Title, formatTip } from './shared';

const groupByTip = (games) =>
  [...games]
    .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt))
    .reduce((groups, game) => {
      const tip = formatTip(game.scheduledAt);
      const current = groups.at(-1);
      if (current?.tip === tip) current.games.push(game);
      else groups.push({ tip, games: [game] });
      return groups;
    }, []);

function GameRow({ game, extra }) {
  const away = game.away.targetablePlayerCount;
  const home = game.home.targetablePlayerCount;
  return (
    <li>
      <span className="slate-row">
        <span className="slate-row-teams">
          <span className="slate-row-title">
            <h3>
              {game.away.tricode} @ {game.home.tricode}
            </h3>
            {game.status === 'final' && <span className="slate-badge is-muted">Final</span>}
          </span>
          <span className="slate-row-names">
            {game.away.name} at {game.home.name}
          </span>
        </span>
        <span className="slate-depth" aria-hidden="true">
          <span className="slate-depth-figure">
            <b className="slate-depth-total">{away + home}</b>
            <span className="slate-depth-unit">targetable</span>
          </span>
        </span>
        <span className="slate-row-go" aria-hidden="true">
          →
        </span>
      </span>
      {extra}
    </li>
  );
}

function Board({ games, renderExtra }) {
  return (
    <ol className="slate-board">
      {groupByTip(games).map((group) => (
        <li className="slate-window" key={group.tip}>
          <h2 className="slate-window-tip">{group.tip}</h2>
          <ul className="slate-rows">
            {group.games.map((game) => (
              <GameRow key={game.gameId} game={game} extra={renderExtra?.(game)} />
            ))}
          </ul>
        </li>
      ))}
    </ol>
  );
}

const fitCount = (r) => (r.availability === 'available' ? r.players.length : null);

/* ---- A · region above the board ---- */
function TopRegion({ live, variant, date }) {
  return (
    <section className="tp-region" aria-labelledby="tp-region-h">
      <div className="tp-region-head">
        <div>
          <p className="matchup-eyebrow" id="tp-region-h">
            Targets active · {live.length}
          </p>
          <h2>{live.reduce((n, r) => n + (fitCount(r) || 0), 0)} players fit today</h2>
        </div>
        <Link to={`${PAGE_PATH}?${protoQuery(variant, {}, { page: true })}`}>All Targets →</Link>
      </div>
      {live.length === 0 ? (
        <p className="honest-empty">No Target has a game on {formatCalendarDate(date)}.</p>
      ) : (
        <div className="tp-region-grid">
          {live.map((r) => (
            <article className="tp-region-item" key={r.target.id}>
              <header>
                <Title target={r.target} />
                <span className="tp-game-chip">
                  {r.game.away.tricode} @ {r.game.home.tricode}{' '}
                  <small>{formatTip(r.game.scheduledAt)}</small>
                </span>
              </header>
              <div className="tp-region-context">
                {r.context.map((c, i) => (
                  <Context key={i} item={c} compact />
                ))}
              </div>
              <FitChips result={r} />
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

/* ---- B · sticky side column ---- */
function SideColumn({ live, variant, date }) {
  return (
    <aside className="tp-side" aria-labelledby="tp-side-h">
      <div className="tp-region-head">
        <p className="matchup-eyebrow" id="tp-side-h">
          Active today · {live.length}
        </p>
        <Link to={`${PAGE_PATH}?${protoQuery(variant, {}, { page: true })}`}>All →</Link>
      </div>
      {live.length === 0 && <p className="honest-empty">Nothing on {formatCalendarDate(date)}.</p>}
      {live.map((r) => (
        <article className="tp-side-item" key={r.target.id}>
          <Title target={r.target} />
          <span className="tp-meta">
            {r.game.away.tricode} @ {r.game.home.tricode} · {formatTip(r.game.scheduledAt)}
          </span>
          {r.availability === 'available' && r.players.length > 0 ? (
            <ul className="tp-side-fits">
              {r.players.map(({ player, shares, thin }) => (
                <li key={player.id} className={thin ? 'is-thin' : ''}>
                  <span>{player.name}</span>
                  <b>{shares.map((s) => `${Math.round(s.entry.share * 100)}%`).join(' / ')}</b>
                </li>
              ))}
            </ul>
          ) : (
            <FitChips result={r} />
          )}
        </article>
      ))}
    </aside>
  );
}

/* ---- C · under each game row ---- */
const underGame = (live) => (game) => {
  const here = live.filter((r) => r.game.gameId === game.gameId);
  if (here.length === 0) return null;
  return (
    <div className="tp-under">
      {here.map((r) => (
        <article className="tp-under-item" key={r.target.id}>
          <div className="tp-under-head">
            <span className="tp-dot is-live" />
            <Title target={r.target} as="span" />
            {fitCount(r) !== null && <b className="tp-count">{fitCount(r)} fit</b>}
          </div>
          <FitTable result={r} dense />
        </article>
      ))}
    </div>
  );
};

/* Verdict 2026-09-04: Chris picked C for the slate. The slate is locked to
   C; the switcher letter now only drives the Targets page. */
const SLATE_VARIANT = 'C';

export default function SlatePrototypePage() {
  const { variant: pageVariant, step } = useVariant();
  const variant = SLATE_VARIANT;
  const [searchParams, setSearchParams] = useSearchParams();
  const date = parseCalendarDate(searchParams.get('date')) || DEMO_DATE;
  const { targets } = useTargetsStore();
  const resolved = useResolvedTargets(date, targets);
  const navigate = (next) => setSearchParams({ date: next || DEMO_DATE, v: variant });
  const games = resolved.slate?.games || [];
  const live = resolved.live;
  const activeCount = live.length;
  return (
    <main className="slate-page tp-page">
      <section className="slate-heading">
        <div className="slate-title">
          <p className="eyebrow">NBA slate · prototype · mock data</p>
          <h1>{formatCalendarDate(date)}</h1>
        </div>
        <div className="date-controls">
          <button
            type="button"
            aria-label="Previous date"
            onClick={() => navigate(shiftCalendarDate(date, -1))}
          >
            ←
          </button>
          <label className="date-field">
            <span className="visually-hidden">Slate date</span>
            <input type="date" value={date} onChange={(e) => navigate(e.target.value)} />
          </label>
          <button
            type="button"
            aria-label="Next date"
            onClick={() => navigate(shiftCalendarDate(date, 1))}
          >
            →
          </button>
          <button
            className="today-reset"
            type="button"
            disabled={date === DEMO_DATE}
            onClick={() => navigate(DEMO_DATE)}
          >
            Apr 10
          </button>
        </div>
      </section>
      {resolved.status === 'loading' && <p role="status">Loading slate…</p>}
      {resolved.status === 'ready' && (
        <>
          <div className="slate-status">
            <span className="slate-count">
              {games.length} {games.length === 1 ? 'game' : 'games'}
            </span>
            <span className="freshness">
              {variant === 'C'
                ? `${activeCount} Targets active · shown under their games`
                : 'mock slate · Targets in memory'}
            </span>
          </div>
          {variant === 'A' && <TopRegion live={live} variant={variant} date={date} />}
          <div className={variant === 'B' ? 'tp-split' : undefined}>
            {games.length === 0 ? (
              <div className="empty-slate">
                <h2>No games on this slate.</h2>
                <p>Only Apr 10 2026 is mocked.</p>
              </div>
            ) : (
              <Board games={games} renderExtra={variant === 'C' ? underGame(live) : undefined} />
            )}
            {variant === 'B' && <SideColumn live={live} variant={variant} date={date} />}
          </div>
        </>
      )}
      <PrototypeSwitcher variant={pageVariant} onStep={step} />
    </main>
  );
}
