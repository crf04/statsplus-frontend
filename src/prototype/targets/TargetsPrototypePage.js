/*
 * PROTOTYPE — throwaway. The Targets page, three ways. See ./README.md.
 * Route: /prototype/targets?date=YYYY-MM-DD&v=A|B|C
 */
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { formatCalendarDate, parseCalendarDate, shiftCalendarDate } from '../../calendarDate';
import '../../SlatePage.css';
import '../../matchups/MatchupDetailPage.css';
import './prototype.css';
import { DEMO_DATE, PROTO_STANDALONE, protoQuery, useVariant } from './prototypeMode';
import {
  addTarget,
  dismissToast,
  emptyQualifier,
  removeTarget,
  updateTarget,
  useTargetsStore,
} from './targetsStore';
import { useResolvedTargets } from './resolveTargets';
import PrototypeSwitcher from './PrototypeSwitcher';
import TargetForm from './TargetForm';
import { Backtest, Context, FitChips, FitTable, MaybeLink, Title, formatTip } from './shared';

const blankDraft = () => ({ opponent: 'OKC', qualifiers: [emptyQualifier()], note: '' });

/* Edit-in-place: the card swaps for the form. */
function EditableTarget({ target, editing, onEdit, onDone, children }) {
  const [draft, setDraft] = useState(null);
  if (editing) {
    const current = draft || { ...target, qualifiers: target.qualifiers.map((q) => ({ ...q })) };
    return (
      <TargetForm
        draft={current}
        onChange={(patch) => setDraft({ ...current, ...patch })}
        onSave={() => {
          updateTarget(target.id, {
            opponent: current.opponent,
            qualifiers: current.qualifiers,
            note: current.note,
          });
          setDraft(null);
          onDone();
        }}
        onCancel={() => {
          setDraft(null);
          onDone();
        }}
        saveLabel="Save changes"
      />
    );
  }
  return children({ edit: onEdit, remove: () => removeTarget(target.id) });
}

function GameChip({ result, variant }) {
  const g = result.game;
  return (
    <MaybeLink className="tp-game-chip" to={`/matchups/${g.gameId}?${protoQuery(variant)}`}>
      {g.away.tricode} @ {g.home.tricode} <small>{formatTip(g.scheduledAt)}</small>
    </MaybeLink>
  );
}

const IdleRows = ({ idle, editingId, setEditingId }) =>
  idle.length === 0 ? (
    <p className="honest-empty">Every Target has a game on this date.</p>
  ) : (
    <ul className="tp-idle-rows">
      {idle.map((r) => (
        <li key={r.target.id}>
          <EditableTarget
            target={r.target}
            editing={editingId === r.target.id}
            onEdit={() => setEditingId(r.target.id)}
            onDone={() => setEditingId(null)}
          >
            {({ edit, remove }) => (
              <>
                <Title target={r.target} className="is-idle" />
                <span className="tp-meta">
                  {r.target.note || 'no note'} · set {r.target.createdAt.slice(0, 10)}
                </span>
                <span className="tp-actions">
                  <button type="button" onClick={edit}>
                    Edit
                  </button>
                  <button type="button" onClick={remove}>
                    Delete
                  </button>
                </span>
              </>
            )}
          </EditableTarget>
        </li>
      ))}
    </ul>
  );

/* ------------------------------------------------------------- A · Ledger */
function LedgerPage({ resolved, variant, date, editingId, setEditingId, newForm }) {
  const [openBt, setOpenBt] = useState({});
  return (
    <>
      {newForm}
      <section className="tp-ledger" aria-label="Live Targets">
        <div className="slate-status">
          <span className="slate-count">
            {resolved.live.length} live · {resolved.idle.length} idle
          </span>
          <span className="freshness">live matchup data · Targets in memory</span>
        </div>
        {resolved.live.length === 0 && (
          <div className="empty-slate">
            <h2>No Targets live on {formatCalendarDate(date)}.</h2>
            <p>Idle Targets are listed below.</p>
          </div>
        )}
        {resolved.live.map((r) => (
          <article className="tp-ledger-item" key={r.target.id}>
            <EditableTarget
              target={r.target}
              editing={editingId === r.target.id}
              onEdit={() => setEditingId(r.target.id)}
              onDone={() => setEditingId(null)}
            >
              {({ edit, remove }) => (
                <>
                  <header className="tp-ledger-head">
                    <Title target={r.target} as="h2" />
                    <GameChip result={r} variant={variant} />
                    <span className="tp-count">
                      <b>{r.players.length}</b> fit
                      {r.opposingTeam ? ` · ${r.opposingTeam.tricode}` : ''}
                    </span>
                  </header>
                  <div className="tp-ledger-context">
                    {r.context.map((c, i) => (
                      <Context key={i} item={c} />
                    ))}
                  </div>
                  <FitTable result={r} />
                  <footer className="tp-ledger-foot">
                    <button
                      type="button"
                      className="tp-ghost"
                      aria-expanded={Boolean(openBt[r.target.id])}
                      onClick={() => setOpenBt((s) => ({ ...s, [r.target.id]: !s[r.target.id] }))}
                    >
                      {openBt[r.target.id] ? 'Hide backtest' : 'Backtest ▸'}
                    </button>
                    {r.target.note && <span className="tp-meta">{r.target.note}</span>}
                    <span className="tp-actions">
                      <button type="button" onClick={edit}>
                        Edit
                      </button>
                      <button type="button" onClick={remove}>
                        Delete
                      </button>
                    </span>
                  </footer>
                  {openBt[r.target.id] && <Backtest result={r} />}
                </>
              )}
            </EditableTarget>
          </article>
        ))}
      </section>
      <section className="tp-idle" aria-labelledby="tp-idle-h">
        <p className="matchup-eyebrow" id="tp-idle-h">
          Idle on this date · {resolved.idle.length}
        </p>
        <IdleRows idle={resolved.idle} editingId={editingId} setEditingId={setEditingId} />
      </section>
    </>
  );
}

/* -------------------------------------------------------------- B · Board */
function BoardPage({ resolved, variant, editingId, setEditingId, newForm, showNew }) {
  const [selectedId, setSelectedId] = useState(null);
  const all = [...resolved.live, ...resolved.idle];
  const selected =
    all.find((r) => r.target.id === selectedId) || resolved.live[0] || all[0] || null;
  const RailItem = ({ r }) => (
    <button
      type="button"
      className={`tp-rail-item${selected?.target.id === r.target.id ? ' is-selected' : ''}`}
      aria-pressed={selected?.target.id === r.target.id}
      onClick={() => setSelectedId(r.target.id)}
    >
      <span className={`tp-dot ${r.game ? 'is-live' : ''}`} />
      <Title target={r.target} as="span" />
      {r.game && <small>{r.availability === 'available' ? `${r.players.length} fit` : '…'}</small>}
    </button>
  );
  return (
    <div className="detail-grid tp-board">
      <aside className="tp-rail" aria-label="Targets">
        <p className="matchup-eyebrow">Live · {resolved.live.length}</p>
        {resolved.live.map((r) => (
          <RailItem key={r.target.id} r={r} />
        ))}
        {resolved.live.length === 0 && <p className="honest-empty">None live.</p>}
        <p className="matchup-eyebrow">Idle · {resolved.idle.length}</p>
        {resolved.idle.map((r) => (
          <RailItem key={r.target.id} r={r} />
        ))}
      </aside>
      <section className="tp-workspace">
        {showNew ? (
          newForm
        ) : !selected ? (
          <div className="empty-slate">
            <h2>No Targets yet.</h2>
          </div>
        ) : (
          <EditableTarget
            target={selected.target}
            editing={editingId === selected.target.id}
            onEdit={() => setEditingId(selected.target.id)}
            onDone={() => setEditingId(null)}
          >
            {({ edit, remove }) => (
              <>
                <header className="tp-ws-head">
                  <div>
                    <p className="matchup-eyebrow">
                      {selected.game ? 'Live Target' : 'Idle Target'}
                    </p>
                    <Title target={selected.target} as="h2" className="is-large" />
                    <p className="tp-meta">
                      {selected.game ? (
                        <GameChip result={selected} variant={variant} />
                      ) : (
                        'No game on this date'
                      )}
                      {' · '}set {selected.target.createdAt.slice(0, 10)}
                      {selected.target.note ? ` · ${selected.target.note}` : ''}
                    </p>
                  </div>
                  <span className="tp-actions">
                    <button type="button" onClick={edit}>
                      Edit
                    </button>
                    <button type="button" onClick={remove}>
                      Delete
                    </button>
                  </span>
                </header>
                {selected.game && (
                  <div className="tp-context-cards">
                    {selected.context.map((c, i) => (
                      <div className="tp-context-card" key={i}>
                        <Context item={c} />
                      </div>
                    ))}
                  </div>
                )}
                {selected.game ? (
                  <>
                    <div className="section-heading">
                      <p className="matchup-eyebrow">
                        Fits · {selected.opposingTeam?.tricode} players
                      </p>
                      <h2>{selected.players.length} meet every Qualifier</h2>
                    </div>
                    <FitTable result={selected} />
                    <Backtest result={selected} />
                  </>
                ) : (
                  <p className="honest-empty">
                    Pick another date to resolve this Target. Qualifiers:{' '}
                    {selected.target.qualifiers.length}.
                  </p>
                )}
              </>
            )}
          </EditableTarget>
        )}
      </section>
    </div>
  );
}

/* --------------------------------------------------------- C · Game-first */
function GameFirstPage({ resolved, variant, date, editingId, setEditingId, newForm }) {
  const games = resolved.slate
    ? [...resolved.slate.games].sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt))
    : [];
  const withTargets = games.filter((g) => resolved.live.some((r) => r.game.gameId === g.gameId));
  return (
    <>
      {newForm}
      {withTargets.length === 0 && (
        <div className="empty-slate">
          <h2>No Targets live on {formatCalendarDate(date)}.</h2>
        </div>
      )}
      {withTargets.map((g) => (
        <section className="tp-game" key={g.gameId}>
          <header className="tp-game-head">
            <span className="slate-window-tip">{formatTip(g.scheduledAt)}</span>
            <h2>
              {g.away.tricode} @ {g.home.tricode}
            </h2>
            {!PROTO_STANDALONE && (
              <Link to={`/matchups/${g.gameId}?${protoQuery(variant)}`}>Open Team Sheets →</Link>
            )}
          </header>
          <div className="tp-game-cards">
            {resolved.live
              .filter((r) => r.game.gameId === g.gameId)
              .map((r) => (
                <article className="tp-card" key={r.target.id}>
                  <EditableTarget
                    target={r.target}
                    editing={editingId === r.target.id}
                    onEdit={() => setEditingId(r.target.id)}
                    onDone={() => setEditingId(null)}
                  >
                    {({ edit, remove }) => (
                      <>
                        <Title target={r.target} />
                        <div className="tp-card-context">
                          {r.context.map((c, i) => (
                            <Context key={i} item={c} compact />
                          ))}
                        </div>
                        <p className="matchup-eyebrow">
                          {r.players.length} {r.opposingTeam?.tricode} fit
                        </p>
                        <FitChips result={r} />
                        <details className="tp-details">
                          <summary>Backtest</summary>
                          <Backtest result={r} />
                        </details>
                        <span className="tp-actions">
                          <button type="button" onClick={edit}>
                            Edit
                          </button>
                          <button type="button" onClick={remove}>
                            Delete
                          </button>
                        </span>
                      </>
                    )}
                  </EditableTarget>
                </article>
              ))}
          </div>
        </section>
      ))}
      {games.length - withTargets.length > 0 && (
        <p className="honest-empty tp-others">
          {games.length - withTargets.length} other games on this slate have no Target.
        </p>
      )}
      <details className="tp-bench">
        <summary>
          <span className="matchup-eyebrow">Bench · idle Targets · {resolved.idle.length}</span>
        </summary>
        <IdleRows idle={resolved.idle} editingId={editingId} setEditingId={setEditingId} />
      </details>
    </>
  );
}

const PAGES = { A: LedgerPage, B: BoardPage, C: GameFirstPage };

export default function TargetsPrototypePage() {
  const auth = useAuth();
  const isAuthenticated = PROTO_STANDALONE || auth.isAuthenticated;
  const loading = PROTO_STANDALONE ? false : auth.loading;
  const { variant, step } = useVariant();
  const [searchParams, setSearchParams] = useSearchParams();
  const date = parseCalendarDate(searchParams.get('date')) || DEMO_DATE;
  const { targets, toast } = useTargetsStore();
  const resolved = useResolvedTargets(isAuthenticated ? date : null, targets);
  const [editingId, setEditingId] = useState(null);
  const [newDraft, setNewDraft] = useState(null);
  const navigate = (next) => setSearchParams({ date: next || DEMO_DATE, v: variant });
  if (!loading && !isAuthenticated)
    return (
      <main className="slate-page signed-out-slate">
        <h1>Sign in to view Targets</h1>
      </main>
    );
  const Page = PAGES[variant];
  const newForm = newDraft ? (
    <section className="tp-new">
      <p className="matchup-eyebrow">New Target</p>
      <TargetForm
        draft={newDraft}
        onChange={(p) => setNewDraft({ ...newDraft, ...p })}
        onSave={() => {
          addTarget(newDraft);
          setNewDraft(null);
        }}
        onCancel={() => setNewDraft(null)}
      />
    </section>
  ) : null;
  return (
    <main className="slate-page tp-page">
      <section className="slate-heading">
        <div className="slate-title">
          <p className="eyebrow">
            Targets · prototype{PROTO_STANDALONE ? ' · mock data, Apr 10 2026' : ''}
          </p>
          <h1>{formatCalendarDate(date)}</h1>
        </div>
        <div className="tp-head-controls">
          <button type="button" className="tp-primary" onClick={() => setNewDraft(blankDraft())}>
            + New Target
          </button>
          <div className="date-controls">
            <button
              type="button"
              aria-label="Previous date"
              onClick={() => navigate(shiftCalendarDate(date, -1))}
            >
              ←
            </button>
            <label className="date-field">
              <span className="visually-hidden">Date</span>
              <input type="date" value={date} onChange={(e) => navigate(e.target.value)} />
            </label>
            <button
              type="button"
              aria-label="Next date"
              onClick={() => navigate(shiftCalendarDate(date, 1))}
            >
              →
            </button>
            {!PROTO_STANDALONE && (
              <Link
                className="today-reset tp-slate-link"
                to={`/matchups?${protoQuery(variant, { date })}`}
              >
                Slate →
              </Link>
            )}
          </div>
        </div>
      </section>
      {toast && (
        <p className="tp-toast" role="status">
          Saved <b>{toast.target.opponent}</b> Target.{' '}
          <button type="button" onClick={dismissToast}>
            Dismiss
          </button>
        </p>
      )}
      {resolved.status === 'loading' && <p role="status">Loading slate…</p>}
      {resolved.status === 'error' && <p role="alert">Slate failed to load.</p>}
      {resolved.status === 'ready' && (
        <Page
          resolved={resolved}
          variant={variant}
          date={date}
          editingId={editingId}
          setEditingId={setEditingId}
          newForm={newForm}
          showNew={Boolean(newDraft)}
        />
      )}
      <PrototypeSwitcher variant={variant} onStep={step} />
    </main>
  );
}
