import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { fetchSlate } from './slateApi';
import { getRequestErrorMessage, isRequestCancelled } from './gameLogsApi';
import {
  formatCalendarDate,
  getTodaySlateDate,
  parseCalendarDate,
  shiftCalendarDate,
} from './calendarDate';
import { getStatusPresentation, getSurfaceFreshnessPresentation } from './slateStatus';
import { formatAge, useMinuteNow } from './freshness';
import { SlateGameTargets } from './targets/TargetFits';
import { useResolvedTargets } from './targets/useResolvedTargets';
import './SlatePage.css';

const formatTip = (date) =>
  new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(date));

const surfaceStatusText = (name, surface, presentation, now) => {
  const age = surface.retrievedAt ? ` — as of ${formatAge(surface.retrievedAt, now)}` : '';
  const thresholdNote = presentation.thresholdNote ? ` (${presentation.thresholdNote})` : '';
  return `${name} is ${presentation.status}${age}${thresholdNote}`;
};

function SurfaceFreshness({ name, surface, surfaceName, now, presentation }) {
  const effectivePresentation =
    presentation || getSurfaceFreshnessPresentation(surface, surfaceName, now);
  return (
    <span className={effectivePresentation.warning ? 'freshness-warning' : undefined}>
      {surfaceStatusText(name, surface, effectivePresentation, now)}
    </span>
  );
}

function Freshness({ freshness, now, poolPresentation }) {
  return (
    <div className="freshness" role="group" aria-label="Data freshness">
      <SurfaceFreshness
        name="Schedule"
        surface={freshness.schedule}
        surfaceName="schedule"
        now={now}
      />
      <SurfaceFreshness
        name="Player pool"
        surface={freshness.pool}
        surfaceName="pool"
        now={now}
        presentation={poolPresentation}
      />
      {freshness.pool.providers.map((provider) => (
        <SurfaceFreshness
          key={provider.name}
          name={`${provider.name} pool`}
          surface={provider}
          surfaceName="pool"
          now={now}
        />
      ))}
    </div>
  );
}

function PoolSummary({ isPast, poolStatus }) {
  const presentation = getStatusPresentation(poolStatus);
  const message = isPast ? presentation.historicalPoolMessage : presentation.currentPoolMessage;

  return (
    <section className="pool-summary" aria-labelledby="player-pool-heading">
      <h2 id="player-pool-heading">Player pool</h2>
      <p>{message}</p>
    </section>
  );
}

/*
 * A scheduled game states itself with its tip time, so printing "Scheduled" on
 * every row is noise. A status the catalog bothered to name differently is
 * information, and so is any state other than scheduled.
 */
const statusBadge = (game) => {
  const fallbackLabels = { scheduled: 'Scheduled', postponed: 'Postponed', final: 'Final' };
  const label = game.statusLabel || fallbackLabels[game.status];
  if (game.status === 'scheduled' && label === fallbackLabels.scheduled) return null;
  return { label, tone: game.status === 'postponed' ? 'blocked' : 'muted' };
};

/*
 * Games grouped into the tip-time windows they share, in schedule order. The
 * slate's own organising fact is when its games start, and a reader picking one
 * already thinks in windows.
 */
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
  const total = away + home;
  const status = statusBadge(game);

  /*
   * The row is one control, so it gets one accessible name that reads as a
   * sentence. Everything inside it is decoration for that name, which is why
   * the depth figures below are aria-hidden rather than separately labelled.
   */
  const label = [
    `${game.away.tricode} @ ${game.home.tricode}`,
    formatTip(game.scheduledAt),
    status && status.label,
    `${total} targetable players, ${game.away.tricode} ${away}, ${game.home.tricode} ${home}`,
    'Open Team Sheets',
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <li>
      <Link
        className={`slate-row${game.status === 'postponed' ? ' is-blocked' : ''}`}
        to={`/matchups/${game.gameId}`}
        aria-label={label}
      >
        <span className="slate-row-teams">
          <span className="slate-row-title">
            <h3>
              {game.away.tricode} @ {game.home.tricode}
            </h3>
            {status && <span className={`slate-badge is-${status.tone}`}>{status.label}</span>}
            {game.classification && (
              <span className="slate-badge is-event">{game.classification}</span>
            )}
            {game.preseason && <span className="slate-badge is-event">Preseason</span>}
          </span>
          <span className="slate-row-names">
            {game.away.name} at {game.home.name}
          </span>
        </span>

        {/* One mark per targetable player, away then home. Deliberately a unit
            chart and not a bar: a bar needs a denominator, and there is no known
            cap on targetable players per game, so any full-width reference would
            be invented. Counting marks needs no such reference, and the two
            groups state the per-side split exactly. */}
        <span className="slate-depth" aria-hidden="true">
          <span className="slate-pips">
            <span className="slate-pip-group">
              {Array.from({ length: away }, (_, index) => (
                <i className="slate-pip is-away" key={index} />
              ))}
            </span>
            <span className="slate-pip-group">
              {Array.from({ length: home }, (_, index) => (
                <i className="slate-pip is-home" key={index} />
              ))}
            </span>
          </span>
          <span className="slate-depth-figure">
            <b className="slate-depth-total">{total}</b>
            <span className="slate-depth-unit">targetable</span>
          </span>
        </span>

        <span className="slate-row-go" aria-hidden="true">
          →
        </span>
      </Link>
      {/* The row itself is one link, so anything the game grows — today, the
          Targets aimed at it — hangs beneath it rather than inside it. */}
      {extra}
    </li>
  );
}

function SlateBoard({ games, renderExtra }) {
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

export default function SlatePage() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedDate = searchParams.get('date');
  const todaySlateDate = getTodaySlateDate();
  const parsedRequestedDate = parseCalendarDate(requestedDate);
  const invalidRequestedDate = requestedDate !== null && !parsedRequestedDate;
  const [state, setState] = useState({ status: 'idle', slate: null, error: null });
  /*
   * The day's Targets are read for the date being viewed, so a block always
   * belongs to the game row above it. The read is separate from the slate's:
   * a Target that cannot be resolved says so on its own line and leaves the
   * board intact.
   */
  const resolvedTargets = useResolvedTargets(requestedDate || undefined);
  const liveEntries = resolvedTargets.entries.filter((entry) => entry.game);
  const now = useMinuteNow(state.status === 'ready');
  const slateDate =
    state.status === 'ready'
      ? state.slate.slateDate
      : invalidRequestedDate
        ? null
        : parsedRequestedDate || todaySlateDate;
  const isPast = slateDate ? slateDate < todaySlateDate : false;
  const poolPresentation =
    state.status === 'ready'
      ? getSurfaceFreshnessPresentation(state.slate.freshness.pool, 'pool', now)
      : null;
  const effectivePoolStatus =
    state.status === 'ready' && state.slate.freshness.pool.status === 'fresh'
      ? poolPresentation.status
      : state.status === 'ready'
        ? state.slate.freshness.pool.status
        : null;

  useEffect(() => {
    if (authLoading || !isAuthenticated) {
      setState({ status: 'idle', slate: null, error: null });
      return undefined;
    }
    const controller = new AbortController();
    setState({ status: 'loading', slate: null, error: null });
    fetchSlate(requestedDate || undefined, { signal: controller.signal })
      .then((slate) => setState({ status: 'ready', slate, error: null }))
      .catch((error) => {
        if (!isRequestCancelled(error)) {
          setState({
            status: 'error',
            slate: null,
            error: getRequestErrorMessage(error, 'Unable to load this slate. Please try again.'),
          });
        }
      });
    return () => controller.abort();
  }, [authLoading, isAuthenticated, requestedDate]);

  const navigate = (nextDate) => setSearchParams(nextDate ? { date: nextDate } : {});

  if (!authLoading && !isAuthenticated) {
    return (
      <main className="slate-page signed-out-slate">
        <h1>Sign in to view the slate</h1>
        <p>Use the sign-in control in the navigation to load schedule and player-pool data.</p>
      </main>
    );
  }

  return (
    <main className="slate-page">
      <section className="slate-heading">
        <div className="slate-title">
          <p className="eyebrow">NBA slate</p>
          <h1>{slateDate ? formatCalendarDate(slateDate) : 'Invalid slate date'}</h1>
        </div>
        <div className="date-controls">
          <button
            type="button"
            aria-label="Previous date"
            disabled={!slateDate}
            onClick={() => navigate(shiftCalendarDate(slateDate, -1))}
          >
            ←
          </button>
          {/* The h1 already names the date in words, so the field's caption is
              for assistive technology only rather than a third line of chrome. */}
          <label className="date-field">
            <span className="visually-hidden">Slate date</span>
            <input
              type="date"
              value={slateDate || ''}
              onChange={(event) => navigate(event.target.value)}
            />
          </label>
          <button
            type="button"
            aria-label="Next date"
            disabled={!slateDate}
            onClick={() => navigate(shiftCalendarDate(slateDate, 1))}
          >
            →
          </button>
          {/* Always reachable, not only as recovery from a bad date. Disabled
              on today's slate so the control doubles as a statement of where
              you are. */}
          <button
            className="today-reset"
            type="button"
            disabled={slateDate === todaySlateDate}
            onClick={() => navigate('')}
          >
            Today
          </button>
        </div>
      </section>

      {!slateDate && <p>Requested date “{requestedDate}” is invalid.</p>}

      {state.status === 'loading' && <p role="status">Loading slate…</p>}
      {state.status === 'error' && <p role="alert">{state.error}</p>}
      {state.status === 'ready' && (
        <>
          <div className="slate-status">
            <span className="slate-count">
              {state.slate.games.length} {state.slate.games.length === 1 ? 'game' : 'games'}
            </span>
            {resolvedTargets.status === 'ready' && (
              <span className="slate-targets">
                {liveEntries.length} {liveEntries.length === 1 ? 'Target' : 'Targets'} active
                {' · '}
                <Link to="/targets">All Targets →</Link>
              </span>
            )}
            {resolvedTargets.status === 'error' && (
              <span className="slate-targets is-unavailable">
                Targets unavailable · <Link to="/targets">All Targets →</Link>
              </span>
            )}
            <Freshness
              freshness={state.slate.freshness}
              now={now}
              poolPresentation={poolPresentation}
            />
          </div>
          <PoolSummary isPast={isPast} poolStatus={effectivePoolStatus} />
          {state.slate.games.length === 0 ? (
            <div className="empty-slate">
              <h2>No games on this slate.</h2>
              <p>Choose another date to keep browsing the season.</p>
            </div>
          ) : (
            <SlateBoard
              games={state.slate.games}
              renderExtra={(game) => (
                <SlateGameTargets
                  entries={liveEntries.filter((entry) => entry.game.gameId === game.gameId)}
                />
              )}
            />
          )}
        </>
      )}
    </main>
  );
}
