/*
 * PROTOTYPE — throwaway. The Targets page: every Target irrespective of game.
 * A grid of cards with the basics; clicking into one shows everything.
 *   A · the card expands in place (full row)
 *   B · the card is a link to /prototype/targets/:id
 *   C · a side drawer slides over the grid
 */
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import '../../SlatePage.css';
import '../../matchups/MatchupDetailPage.css';
import './prototype.css';
import {
  DEMO_DATE,
  PAGE_PATH,
  PROTO_STANDALONE,
  SLATE_PATH,
  protoQuery,
  useVariant,
} from './prototypeMode';
import {
  addTarget,
  dismissToast,
  emptyQualifier,
  qualifierLabel,
  removeTarget,
  unitOf,
  updateTarget,
  useTargetsStore,
  COMPARATOR_SYMBOL,
} from './targetsStore';
import { useResolvedTargets } from './resolveTargets';
import PrototypeSwitcher from './PrototypeSwitcher';
import TargetForm from './TargetForm';
import { Backtest, Context, FitTable, Title, formatTip, pct } from './shared';
import { sliceLabel, baseOf } from './catalog';

const blankDraft = () => ({ opponent: 'OKC', qualifiers: [emptyQualifier()], note: '' });

/* ---- the card: basics only ---- */
function TargetCard({ target, result, open, onOpen, as: Tag = 'button', to }) {
  const fits = result && result.availability === 'available' ? result.players.length : null;
  const body = (
    <>
      <div className="tp-tc-head">
        <span className="tp-tc-opp">{target.opponent}</span>
        {fits !== null && (
          <span className={`tp-tc-fits${fits ? ' has-fits' : ''}`}>
            {fits} fit <small>Apr 10</small>
          </span>
        )}
      </div>
      <div className="tp-tc-q">
        {target.qualifiers.map((q, i) => (
          <span key={i}>
            {sliceLabel(q.base, q.sliceKey)}{' '}
            <b>
              {COMPARATOR_SYMBOL[q.comparator]} {pct(q.threshold)}
            </b>
          </span>
        ))}
      </div>
      {target.note ? (
        <p className="tp-tc-note">{target.note}</p>
      ) : (
        <p className="tp-tc-note is-empty">No note</p>
      )}
      <span className="tp-tc-go">{open ? 'Close ↑' : 'Open →'}</span>
    </>
  );
  if (Tag === 'link')
    return (
      <Link className={`tp-tc${open ? ' is-open' : ''}`} to={to}>
        {body}
      </Link>
    );
  return (
    <button
      type="button"
      className={`tp-tc${open ? ' is-open' : ''}`}
      aria-expanded={open}
      onClick={onOpen}
    >
      {body}
    </button>
  );
}

/* ---- the detail: everything ---- */
function TargetDetail({ target, result, onClose, closeLabel = 'Close' }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(null);
  if (editing) {
    const current = draft || { ...target, qualifiers: target.qualifiers.map((q) => ({ ...q })) };
    return (
      <div className="tp-detail">
        <TargetForm
          draft={current}
          onChange={(p) => setDraft({ ...current, ...p })}
          onSave={() => {
            updateTarget(target.id, {
              opponent: current.opponent,
              qualifiers: current.qualifiers,
              note: current.note,
            });
            setDraft(null);
            setEditing(false);
          }}
          onCancel={() => {
            setDraft(null);
            setEditing(false);
          }}
          saveLabel="Save changes"
        />
      </div>
    );
  }
  return (
    <div className="tp-detail">
      <header className="tp-detail-head">
        <div>
          <p className="matchup-eyebrow">Target · set {target.createdAt.slice(0, 10)}</p>
          <Title target={target} as="h2" className="is-large" />
          {target.note && <p className="tp-detail-note">{target.note}</p>}
        </div>
        <span className="tp-actions">
          <button type="button" onClick={() => setEditing(true)}>
            Edit
          </button>
          <button
            type="button"
            onClick={() => {
              removeTarget(target.id);
              onClose();
            }}
          >
            Delete
          </button>
          <button type="button" onClick={onClose}>
            {closeLabel}
          </button>
        </span>
      </header>

      <section className="tp-detail-section">
        <p className="matchup-eyebrow">Qualifiers · a player must meet every one</p>
        <div className="tp-detail-qs">
          {target.qualifiers.map((q, i) => {
            const ctx = result?.context?.[i];
            return (
              <div className="tp-detail-q" key={i}>
                <div className="tp-detail-qhead">
                  <span className="tp-detail-qbase">{baseOf(q.base).label}</span>
                  <b>{qualifierLabel(q)}</b>
                  <em>{unitOf(q)}</em>
                </div>
                {ctx ? (
                  <Context item={ctx} />
                ) : (
                  <p className="honest-empty">
                    Opponent context appears when {target.opponent} has a game loaded.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="tp-detail-section">
        <p className="matchup-eyebrow">
          {result?.game ? (
            <>
              Fits · {result.game.away.tricode} @ {result.game.home.tricode} ·{' '}
              {formatTip(result.game.scheduledAt)}
            </>
          ) : (
            'Fits'
          )}
        </p>
        {result?.game ? (
          <FitTable result={result} />
        ) : (
          <p className="honest-empty">
            {target.opponent} has no game on {DEMO_DATE}.
          </p>
        )}
      </section>

      {result?.game && <Backtest result={result} />}
    </div>
  );
}

export default function TargetsPrototypePage() {
  const auth = useAuth();
  const isAuthenticated = PROTO_STANDALONE || auth.isAuthenticated;
  const loading = PROTO_STANDALONE ? false : auth.loading;
  const { variant, step } = useVariant();
  const { targetId } = useParams();
  const navigate = useNavigate();
  const { targets, toast } = useTargetsStore();
  const resolved = useResolvedTargets(isAuthenticated ? DEMO_DATE : null, targets);
  const resultFor = (t) => resolved.results.find((r) => r.target.id === t.id) || null;
  const [selectedId, setSelectedId] = useState(null);
  const [newDraft, setNewDraft] = useState(null);
  if (!loading && !isAuthenticated)
    return (
      <main className="slate-page signed-out-slate">
        <h1>Sign in to view Targets</h1>
      </main>
    );

  const q = protoQuery(variant, {}, { page: true });
  const routeTarget = targetId ? targets.find((t) => String(t.id) === targetId) : null;
  const openId = variant === 'B' ? (routeTarget?.id ?? null) : selectedId;
  const openTarget = targets.find((t) => t.id === openId) || null;
  const open = (id) =>
    variant === 'B'
      ? navigate(`${PAGE_PATH}/${id}?${q}`)
      : setSelectedId(id === selectedId ? null : id);
  const close = () => (variant === 'B' ? navigate(`${PAGE_PATH}?${q}`) : setSelectedId(null));

  /* B · the detail is its own page */
  if (variant === 'B' && targetId) {
    return (
      <main className="slate-page tp-page">
        <p className="tp-back">
          <Link to={`${PAGE_PATH}?${q}`}>← All Targets</Link>
        </p>
        {openTarget ? (
          <TargetDetail
            target={openTarget}
            result={resultFor(openTarget)}
            onClose={close}
            closeLabel="Back"
          />
        ) : (
          <div className="empty-slate">
            <h2>That Target is gone.</h2>
          </div>
        )}
        <PrototypeSwitcher variant={variant} onStep={step} />
      </main>
    );
  }

  return (
    <main className="slate-page tp-page">
      <section className="slate-heading">
        <div className="slate-title">
          <p className="eyebrow">Targets · prototype{PROTO_STANDALONE ? ' · mock data' : ''}</p>
          <h1>
            {targets.length} {targets.length === 1 ? 'Target' : 'Targets'}
          </h1>
        </div>
        <div className="tp-head-controls">
          <button type="button" className="tp-primary" onClick={() => setNewDraft(blankDraft())}>
            + New Target
          </button>
          <Link className="tp-ghost tp-slate-link" to={`${SLATE_PATH}?${q}`}>
            Today's slate →
          </Link>
        </div>
      </section>
      <div className="slate-status">
        <span className="slate-count">every Target · irrespective of game</span>
        <span className="freshness">tap a card for qualifiers, context, fits, backtest</span>
      </div>
      {toast && (
        <p className="tp-toast" role="status">
          Saved <b>{toast.target.opponent}</b> Target.{' '}
          <button type="button" onClick={dismissToast}>
            Dismiss
          </button>
        </p>
      )}
      {newDraft && (
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
      )}
      {targets.length === 0 ? (
        <div className="empty-slate">
          <h2>No Targets yet.</h2>
        </div>
      ) : (
        <div className="tp-tc-grid">
          {targets.map((t) => (
            <div
              className={`tp-tc-cell${variant === 'A' && openId === t.id ? ' is-expanded' : ''}`}
              key={t.id}
            >
              {variant === 'B' ? (
                <TargetCard
                  target={t}
                  result={resultFor(t)}
                  as="link"
                  to={`${PAGE_PATH}/${t.id}?${q}`}
                />
              ) : (
                <TargetCard
                  target={t}
                  result={resultFor(t)}
                  open={openId === t.id}
                  onOpen={() => open(t.id)}
                />
              )}
              {variant === 'A' && openId === t.id && (
                <TargetDetail target={t} result={resultFor(t)} onClose={close} />
              )}
            </div>
          ))}
        </div>
      )}
      {/* C · side drawer */}
      {variant === 'C' && openTarget && (
        <div className="tp-drawer-backdrop" onClick={close} role="presentation">
          <aside
            className="tp-side-drawer"
            role="dialog"
            aria-modal="true"
            aria-label={`${openTarget.opponent} Target`}
            onClick={(e) => e.stopPropagation()}
          >
            <TargetDetail target={openTarget} result={resultFor(openTarget)} onClose={close} />
          </aside>
        </div>
      )}
      <PrototypeSwitcher variant={variant} onStep={step} />
    </main>
  );
}
