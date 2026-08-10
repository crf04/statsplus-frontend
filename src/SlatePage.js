import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { fetchSlate } from './slateApi';
import { getRequestErrorMessage, isRequestCancelled } from './gameLogsApi';
import {
  formatCalendarDate,
  getTodaySlateDate,
  parseCalendarDate,
  shiftCalendarDate,
} from './calendarDate';
import { getStatusPresentation } from './slateStatus';
import './SlatePage.css';

const formatTip = (date) =>
  new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(date));

const formatAge = (retrievedAt) => {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(retrievedAt).getTime()) / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
};

const surfaceStatusText = (name, surface) => {
  const age = surface.retrievedAt ? ` — as of ${formatAge(surface.retrievedAt)}` : '';
  return `${name} is ${surface.status}${age}`;
};

function SurfaceFreshness({ name, surface }) {
  const warning = getStatusPresentation(surface.status).warning;
  return (
    <span
      className={warning ? 'freshness-warning' : undefined}
      role={warning ? 'alert' : undefined}
    >
      {surfaceStatusText(name, surface)}
    </span>
  );
}

function Freshness({ freshness }) {
  return (
    <div className="freshness" aria-label="Data freshness">
      <SurfaceFreshness name="Schedule" surface={freshness.schedule} />
      <SurfaceFreshness name="Player pool" surface={freshness.pool} />
      {freshness.pool.providers.map((provider) => (
        <SurfaceFreshness key={provider.name} name={`${provider.name} pool`} surface={provider} />
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

function GameCard({ game }) {
  const status = game.status === 'final' ? 'Final' : game.statusLabel;
  return (
    <article className="slate-card">
      <div className="slate-card-topline">
        <span>{formatTip(game.scheduledAt)}</span>
        <span>{status}</span>
      </div>
      <h2>
        {game.away.tricode} @ {game.home.tricode}
      </h2>
      <div className="team-row">
        <span>{game.away.name}</span>
        <span>{game.away.targetablePlayerCount} targetable</span>
      </div>
      <div className="team-row">
        <span>{game.home.name}</span>
        <span>{game.home.targetablePlayerCount} targetable</span>
      </div>
      <div className="badges">
        {game.classification && <span className="slate-badge">{game.classification}</span>}
        {game.preseason && <span className="slate-badge">Preseason</span>}
        {game.status === 'postponed' && <span className="slate-badge">Postponed</span>}
      </div>
    </article>
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
  const slateDate =
    state.status === 'ready'
      ? state.slate.slateDate
      : invalidRequestedDate
        ? null
        : parsedRequestedDate || todaySlateDate;
  const isPast = slateDate ? slateDate < todaySlateDate : false;

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

  const navigate = (nextDate) => setSearchParams({ date: nextDate });

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
        <p className="eyebrow">NBA slate</p>
        <h1>{slateDate ? formatCalendarDate(slateDate) : 'Invalid slate date'}</h1>
        <div className="date-controls">
          <button
            type="button"
            aria-label="Previous date"
            disabled={!slateDate}
            onClick={() => navigate(shiftCalendarDate(slateDate, -1))}
          >
            ←
          </button>
          <label>
            <span>Slate date</span>
            <input
              aria-label="Slate date"
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
        </div>
      </section>

      {!slateDate && <p>Requested date “{requestedDate}” is invalid.</p>}

      {state.status === 'loading' && <p role="status">Loading slate…</p>}
      {state.status === 'error' && <p role="alert">{state.error}</p>}
      {state.status === 'ready' && (
        <>
          <Freshness freshness={state.slate.freshness} />
          <PoolSummary isPast={isPast} poolStatus={state.slate.poolStatus} />
          {state.slate.games.length === 0 ? (
            <div className="empty-slate">
              <h2>No games on this slate.</h2>
              <p>Choose another date to keep browsing the season.</p>
            </div>
          ) : (
            <div className="slate-grid">
              {state.slate.games.map((game) => (
                <GameCard key={game.gameId} game={game} />
              ))}
            </div>
          )}
        </>
      )}
    </main>
  );
}
