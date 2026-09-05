/* PROTOTYPE — throwaway. The one form every capture variant and the blank
   "new Target" path share. Title preview is derived live (ADR 0001). */
import { BASES, SLICES, TEAMS } from './catalog';
import { COMPARATOR_SYMBOL, emptyQualifier, titleOf } from './targetsStore';
import { Title } from './shared';

export default function TargetForm({
  draft,
  onChange,
  onSave,
  onCancel,
  saveLabel = 'Save Target',
  compact = false,
}) {
  const setQ = (i, patch) =>
    onChange({ qualifiers: draft.qualifiers.map((q, j) => (j === i ? { ...q, ...patch } : q)) });
  const valid =
    draft.opponent &&
    draft.qualifiers.length > 0 &&
    draft.qualifiers.every(
      (q) => Number.isFinite(q.threshold) && q.threshold >= 0 && q.threshold <= 1,
    );
  return (
    <form
      className={`tp-form${compact ? ' is-compact' : ''}`}
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) onSave();
      }}
    >
      <div className="tp-form-row">
        <label>
          <span className="proto-label">Opponent</span>
          <select value={draft.opponent} onChange={(e) => onChange({ opponent: e.target.value })}>
            {TEAMS.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
        <div className="tp-form-preview">
          <span className="proto-label">Title (derived)</span>
          {valid ? (
            <Title target={draft} as="p" />
          ) : (
            <p className="honest-empty">Complete the Qualifiers.</p>
          )}
        </div>
      </div>
      <span className="proto-label">Qualifiers · a player must meet every one</span>
      {draft.qualifiers.map((q, i) => (
        <div className="tp-qualifier" key={i}>
          <select
            value={q.base}
            onChange={(e) =>
              setQ(i, { base: e.target.value, sliceKey: SLICES[e.target.value][0][0] })
            }
          >
            {BASES.map((b) => (
              <option key={b.key} value={b.key}>
                {b.label}
              </option>
            ))}
          </select>
          <select value={q.sliceKey} onChange={(e) => setQ(i, { sliceKey: e.target.value })}>
            {SLICES[q.base].map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
          <div className="segmented tp-cmp" role="group" aria-label="Comparator">
            {Object.entries(COMPARATOR_SYMBOL).map(([key, sym]) => (
              <button
                type="button"
                key={key}
                aria-pressed={q.comparator === key}
                onClick={() => setQ(i, { comparator: key })}
              >
                {sym}
              </button>
            ))}
          </div>
          <label className="tp-threshold">
            <input
              type="number"
              min="0"
              max="100"
              step="1"
              value={Math.round(q.threshold * 100)}
              onChange={(e) => setQ(i, { threshold: Number(e.target.value) / 100 })}
            />
            <span>%</span>
          </label>
          <button
            type="button"
            className="tp-remove"
            aria-label="Remove qualifier"
            disabled={draft.qualifiers.length === 1}
            onClick={() => onChange({ qualifiers: draft.qualifiers.filter((_, j) => j !== i) })}
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        className="tp-add"
        onClick={() => onChange({ qualifiers: [...draft.qualifiers, emptyQualifier()] })}
      >
        + Add a Qualifier
      </button>
      <label className="tp-note">
        <span className="proto-label">Note (optional, never the title)</span>
        <input
          value={draft.note || ''}
          placeholder="Why you set this"
          onChange={(e) => onChange({ note: e.target.value })}
        />
      </label>
      <div className="tp-form-actions">
        <button
          type="submit"
          className="tp-primary"
          disabled={!valid}
          title={valid ? titleOf(draft) : undefined}
        >
          {saveLabel}
        </button>
        {onCancel && (
          <button type="button" className="tp-ghost" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
