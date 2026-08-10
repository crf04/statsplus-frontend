import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { fetchSlate } from './slateApi';
import { getRequestErrorMessage, isRequestCancelled } from './gameLogsApi';
import './SlatePage.css';

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const today = () => {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(new Date());
};

const shiftDate = (date, days) => {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
};

const formatSlateDate = (date) =>
  new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T12:00:00Z`));

const formatTip = (date) =>
  new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(date));

const formatAge = (retrievedAt) => {
  if (!retrievedAt) return 'unavailable';
  const minutes = Math.max(0, Math.round((Date.now() - new Date(retrievedAt).getTime()) / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
};

function Freshness({ freshness }) {
  const schedule = freshness.schedule || {};
  const pool = freshness.pool || {};
  return (
    <div className="freshness" aria-label="Data freshness">
      <span className={schedule.status !== 'fresh' ? 'freshness-warning' : ''}>
        Schedule as of {formatAge(schedule.retrieved_at)}
      </span>
      <span className={pool.status !== 'fresh' ? 'freshness-warning' : ''}>
        Pool {pool.status === 'fresh' ? `as of ${formatAge(pool.retrieved_at)}` : 'unavailable'}
      </span>
    </div>
  );
}

function GameCard({ game, poolStatus }) {
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
        <span>{game.targetableCounts.away} targetable</span>
      </div>
      <div className="team-row">
        <span>{game.home.name}</span>
        <span>{game.targetableCounts.home} targetable</span>
      </div>
      <div className="badges">
        {game.classification && <span className="slate-badge">{game.classification}</span>}
        {game.preseason && <span className="slate-badge">Preseason</span>}
        {game.status === 'postponed' && <span className="slate-badge">Postponed</span>}
      </div>
      {poolStatus === 'unavailable' && <p className="pool-status">Pool unavailable</p>}
    </article>
  );
}

export default function SlatePage() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedDate = searchParams.get('date');
  const date = requestedDate && datePattern.test(requestedDate) ? requestedDate : today();
  const [state, setState] = useState({ status: 'idle', slate: null, error: null });
  const isPast = useMemo(() => date < today(), [date]);

  useEffect(() => {
    if (authLoading || !isAuthenticated) {
      setState({ status: 'idle', slate: null, error: null });
      return undefined;
    }
    const controller = new AbortController();
    setState({ status: 'loading', slate: null, error: null });
    fetchSlate(requestedDate ? date : undefined, { signal: controller.signal })
      .then((slate) => setState({ status: 'ready', slate, error: null }))
      .catch((error) => {
        if (!isRequestCancelled(error)) {
          const contractMessage = error.response?.data?.error?.message;
          setState({
            status: 'error',
            slate: null,
            error:
              typeof contractMessage === 'string'
                ? contractMessage
                : getRequestErrorMessage(error, 'Unable to load this slate. Please try again.'),
          });
        }
      });
    return () => controller.abort();
  }, [authLoading, date, isAuthenticated, requestedDate]);

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
        <h1>{formatSlateDate(date)}</h1>
        <div className="date-controls">
          <button
            type="button"
            aria-label="Previous date"
            onClick={() => navigate(shiftDate(date, -1))}
          >
            ←
          </button>
          <label>
            <span>Slate date</span>
            <input
              aria-label="Slate date"
              type="date"
              value={date}
              onChange={(event) => navigate(event.target.value)}
            />
          </label>
          <button type="button" aria-label="Next date" onClick={() => navigate(shiftDate(date, 1))}>
            →
          </button>
        </div>
      </section>

      {state.status === 'loading' && <p role="status">Loading slate…</p>}
      {state.status === 'error' && <p role="alert">{state.error}</p>}
      {state.status === 'ready' && (
        <>
          <Freshness freshness={state.slate.freshness} />
          {isPast && state.slate.poolStatus === 'unavailable' && (
            <p className="past-notice">Past slate — player pool unavailable.</p>
          )}
          {state.slate.games.length === 0 ? (
            <div className="empty-slate">
              <h2>No games on this slate.</h2>
              <p>Choose another date to keep browsing the season.</p>
            </div>
          ) : (
            <div className="slate-grid">
              {state.slate.games.map((game) => (
                <GameCard key={game.gameId} game={game} poolStatus={state.slate.poolStatus} />
              ))}
            </div>
          )}
        </>
      )}
    </main>
  );
}
