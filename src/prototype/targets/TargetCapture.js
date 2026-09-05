/*
 * PROTOTYPE — throwaway. Saving a Target from a Defense Sheet row.
 *   A · inline: the row expands into the form
 *   B · modal: the row opens a dialog
 *   C · builder: rows add Qualifiers to a sticky drawer, save once
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { baseOf } from './catalog';
import { PAGE_PATH, protoQuery, useVariant } from './prototypeMode';
import {
  addTarget,
  closeDraft,
  dismissToast,
  openDraft,
  patchDraft,
  useTargetsStore,
} from './targetsStore';
import { leagueAverageShare } from './resolveTargets';
import TargetForm from './TargetForm';
import { Title, pct } from './shared';
import './prototype.css';

const draftFromRow = (team, base, row, players) => {
  const lg = leagueAverageShare(players, base, row.sliceKey);
  return {
    opponent: team.tricode,
    qualifiers: [
      {
        base: baseOf(base).key,
        sliceKey: row.sliceKey,
        comparator: 'at_or_above',
        threshold: lg === null ? 0.25 : Math.round(lg * 100) / 100,
      },
    ],
    note: '',
    prefilledFromLeague: lg !== null,
  };
};

/* Rendered inside every sheet-row. `players` are the opposing pool. */
export function SaveAsTargetAction({ team, base, row, players }) {
  const { active, variant } = useVariant();
  const { draft } = useTargetsStore();
  const [inline, setInline] = useState(null);
  if (!active || base === 'traditional') return null;
  const seed = () => draftFromRow(team, base, row, players);

  if (variant === 'A') {
    return (
      <>
        {!inline && (
          <button type="button" className="tp-row-action" onClick={() => setInline(seed())}>
            Save as Target
          </button>
        )}
        {inline && (
          <div className="tp-inline-form">
            <p className="proto-label">
              New Target from this row{' '}
              {inline.prefilledFromLeague ? '· threshold = league-average share' : ''}
            </p>
            <TargetForm
              compact
              draft={inline}
              onChange={(p) => setInline({ ...inline, ...p })}
              onSave={() => {
                addTarget(inline);
                setInline(null);
              }}
              onCancel={() => setInline(null)}
            />
          </div>
        )}
      </>
    );
  }
  if (variant === 'B') {
    return (
      <button
        type="button"
        className="tp-row-action"
        onClick={() => openDraft({ ...seed(), mode: 'modal' })}
      >
        Save as Target
      </button>
    );
  }
  // C · builder
  const inDraft =
    draft?.mode === 'builder' &&
    draft.opponent === team.tricode &&
    draft.qualifiers.some((q) => q.base === baseOf(base).key && q.sliceKey === row.sliceKey);
  const add = () => {
    const q = seed().qualifiers[0];
    if (!draft || draft.mode !== 'builder' || draft.opponent !== team.tricode)
      openDraft({ ...seed(), mode: 'builder' });
    else if (!inDraft) patchDraft({ qualifiers: [...draft.qualifiers, q] });
  };
  return (
    <button
      type="button"
      className={`tp-row-action${inDraft ? ' is-added' : ''}`}
      onClick={add}
      disabled={inDraft}
    >
      {inDraft
        ? '✓ In Target'
        : draft?.mode === 'builder' && draft.opponent === team.tricode
          ? '+ Add to Target'
          : '+ Start a Target'}
    </button>
  );
}

/* Rendered once on the matchup page: modal (B), drawer (C), toast (all). */
export function CaptureSurface() {
  const { active, variant } = useVariant();
  const { draft, toast } = useTargetsStore();
  if (!active) return null;
  const save = () => {
    addTarget(draft);
    closeDraft();
  };
  return (
    <>
      {toast && (
        <p className="tp-toast is-floating" role="status">
          Saved · <Title target={toast.target} as="span" /> ·{' '}
          <Link to={`${PAGE_PATH}?${protoQuery(variant, {}, { page: true })}`}>View Targets →</Link>
          <button type="button" onClick={dismissToast} aria-label="Dismiss">
            ×
          </button>
        </p>
      )}
      {variant === 'B' && draft?.mode === 'modal' && (
        <div className="tp-modal-backdrop" onClick={closeDraft} role="presentation">
          <div
            className="tp-modal"
            role="dialog"
            aria-modal="true"
            aria-label="New Target"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="matchup-eyebrow">
              New Target{' '}
              {draft.prefilledFromLeague ? '· threshold prefilled at league-average share' : ''}
            </p>
            <TargetForm draft={draft} onChange={patchDraft} onSave={save} onCancel={closeDraft} />
          </div>
        </div>
      )}
      {variant === 'C' && draft?.mode === 'builder' && (
        <div className="tp-drawer" role="region" aria-label="Target builder">
          <div className="tp-drawer-head">
            <span className="matchup-eyebrow">Target builder</span>
            <Title target={draft} as="span" />
            <button type="button" className="tp-ghost" onClick={closeDraft}>
              Discard
            </button>
          </div>
          <div className="tp-drawer-body">
            {draft.qualifiers.map((q, i) => (
              <span className="tp-builder-chip" key={i}>
                {q.sliceKey}
                <button
                  type="button"
                  className="tp-cmp-toggle"
                  onClick={() =>
                    patchDraft({
                      qualifiers: draft.qualifiers.map((x, j) =>
                        j === i
                          ? {
                              ...x,
                              comparator:
                                x.comparator === 'at_or_above' ? 'at_or_below' : 'at_or_above',
                            }
                          : x,
                      ),
                    })
                  }
                >
                  {q.comparator === 'at_or_above' ? '≥' : '≤'}
                </button>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={Math.round(q.threshold * 100)}
                  onChange={(e) =>
                    patchDraft({
                      qualifiers: draft.qualifiers.map((x, j) =>
                        j === i ? { ...x, threshold: Number(e.target.value) / 100 } : x,
                      ),
                    })
                  }
                />
                %
                <button
                  type="button"
                  aria-label="Remove"
                  onClick={() =>
                    patchDraft({ qualifiers: draft.qualifiers.filter((_, j) => j !== i) })
                  }
                >
                  ×
                </button>
              </span>
            ))}
            <span className="honest-empty">
              Tap more sheet rows to add Qualifiers. Prefill is league-average share (
              {pct(draft.qualifiers[0].threshold)}).
            </span>
            <input
              className="tp-drawer-note"
              placeholder="Note (optional)"
              value={draft.note}
              onChange={(e) => patchDraft({ note: e.target.value })}
            />
            <button
              type="button"
              className="tp-primary"
              disabled={draft.qualifiers.length === 0}
              onClick={save}
            >
              Save Target
            </button>
          </div>
        </div>
      )}
    </>
  );
}
