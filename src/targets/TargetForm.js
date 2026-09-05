import {
  NBA_TEAM_TRICODES,
  TARGET_BASES,
  TARGET_COMPARATORS,
  TARGET_SLICES,
  deriveTargetTitle,
  parseThresholdPercent,
} from './targetCatalog';

/*
 * A new Qualifier starts without a threshold. A pre-filled one would make the
 * form saveable before anybody had composed anything, and the first Target of
 * the day would be whatever the defaults happened to say.
 */
export const blankQualifier = () => ({
  base: 'shot_zones',
  sliceKey: TARGET_SLICES.shot_zones[0][0],
  comparator: 'at_or_above',
  thresholdPercent: '',
});

export const blankTargetDraft = () => ({
  opponent: NBA_TEAM_TRICODES[0],
  qualifiers: [blankQualifier()],
  note: '',
});

export const targetDraftToRequest = (draft) => ({
  opponent: draft.opponent,
  qualifiers: draft.qualifiers.map((qualifier) => ({
    base: qualifier.base,
    sliceKey: qualifier.sliceKey,
    comparator: qualifier.comparator,
    threshold: parseThresholdPercent(qualifier.thresholdPercent),
  })),
  note: draft.note.trim(),
});

export const targetToDraft = (target) => ({
  opponent: target.opponent,
  qualifiers: target.qualifiers.map((qualifier) => ({
    base: qualifier.base,
    sliceKey: qualifier.sliceKey,
    comparator: qualifier.comparator,
    thresholdPercent: String(Math.round(qualifier.threshold * 1000) / 10),
  })),
  note: target.note,
});

/*
 * A draft is saveable only when every Qualifier is complete, because a Target
 * with a half-written criterion would filter for something nobody chose. The
 * two failures are worth different sentences, so the form says which one it is.
 */
export const describeDraft = (draft) => {
  if (draft.qualifiers.length === 0) {
    return { valid: false, problem: 'Add at least one Qualifier before saving.' };
  }
  const request = targetDraftToRequest(draft);
  if (request.qualifiers.some((qualifier) => qualifier.threshold === null)) {
    return { valid: false, problem: 'Every threshold must be a share between 0% and 100%.' };
  }
  return { valid: true, problem: null, request };
};

export default function TargetForm({
  draft,
  onChange,
  onSubmit,
  onCancel,
  submitLabel = 'Save Target',
  busy = false,
  lockOpponent = false,
}) {
  const { valid, problem, request } = describeDraft(draft);
  const patchQualifier = (index, patch) =>
    onChange({
      qualifiers: draft.qualifiers.map((qualifier, position) =>
        position === index ? { ...qualifier, ...patch } : qualifier,
      ),
    });

  return (
    <form
      className="target-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (valid && !busy) onSubmit(request);
      }}
    >
      <div className="target-form-row">
        {lockOpponent ? (
          <p className="target-form-opponent">
            <span className="target-label">Opponent</span>
            <b>{draft.opponent}</b>
          </p>
        ) : (
          <label className="target-form-opponent">
            <span className="target-label">Opponent</span>
            <select
              value={draft.opponent}
              onChange={(event) => onChange({ opponent: event.target.value })}
            >
              {NBA_TEAM_TRICODES.map((tricode) => (
                <option key={tricode} value={tricode}>
                  {tricode}
                </option>
              ))}
            </select>
          </label>
        )}
        {/* The title is the backend's to derive and store; this only shows what
            the draft would be called, so it is labelled as a preview. */}
        <div className="target-form-preview">
          <span className="target-label">Title preview · derived from the Qualifiers</span>
          {valid ? (
            <p className="target-title">{deriveTargetTitle(request)}</p>
          ) : (
            <p>Complete the Qualifiers to see the title.</p>
          )}
        </div>
      </div>

      <span className="target-label">Qualifiers · a player must meet every one</span>
      {draft.qualifiers.map((qualifier, index) => (
        <div className="target-qualifier" key={index}>
          <select
            aria-label={`Qualifier ${index + 1} diet base`}
            value={qualifier.base}
            onChange={(event) =>
              patchQualifier(index, {
                base: event.target.value,
                sliceKey: TARGET_SLICES[event.target.value][0][0],
              })
            }
          >
            {TARGET_BASES.map((base) => (
              <option key={base.key} value={base.key}>
                {base.label}
              </option>
            ))}
          </select>
          {/* A stored Target can name a slice this page has no label for. A
              picker would silently swap it for its first option, so an unknown
              slice is shown as it was stored and left alone. */}
          {TARGET_SLICES[qualifier.base].some(([key]) => key === qualifier.sliceKey) ? (
            <select
              aria-label={`Qualifier ${index + 1} slice`}
              value={qualifier.sliceKey}
              onChange={(event) => patchQualifier(index, { sliceKey: event.target.value })}
            >
              {TARGET_SLICES[qualifier.base].map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          ) : (
            <select
              aria-label={`Qualifier ${index + 1} slice`}
              className="target-unknown-slice"
              value={qualifier.sliceKey}
              disabled
            >
              <option value={qualifier.sliceKey}>{qualifier.sliceKey}</option>
            </select>
          )}
          <div
            className="target-comparator"
            role="group"
            aria-label={`Qualifier ${index + 1} comparator`}
          >
            {TARGET_COMPARATORS.map((comparator) => (
              <button
                type="button"
                key={comparator.key}
                aria-label={comparator.label}
                aria-pressed={qualifier.comparator === comparator.key}
                onClick={() => patchQualifier(index, { comparator: comparator.key })}
              >
                {comparator.symbol}
              </button>
            ))}
          </div>
          {/* A step would let the browser refuse a share the form had just
              previewed as a title. The parser is the only judge of a threshold,
              and it rounds to the decimal the title is written at. */}
          <span className="target-threshold">
            <input
              type="number"
              min="0"
              max="100"
              step="any"
              aria-label={`Qualifier ${index + 1} threshold percent`}
              value={qualifier.thresholdPercent}
              onChange={(event) => patchQualifier(index, { thresholdPercent: event.target.value })}
            />
            <span>%</span>
          </span>
          <button
            type="button"
            className="target-remove"
            aria-label={`Remove Qualifier ${index + 1}`}
            onClick={() =>
              onChange({
                qualifiers: draft.qualifiers.filter((_, position) => position !== index),
              })
            }
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        className="target-add"
        onClick={() => onChange({ qualifiers: [...draft.qualifiers, blankQualifier()] })}
      >
        + Add a Qualifier
      </button>

      <label className="target-note">
        <span className="target-label">Note · optional, never the title</span>
        <input
          value={draft.note}
          placeholder="Why you set this"
          maxLength={280}
          onChange={(event) => onChange({ note: event.target.value })}
        />
      </label>

      {!valid && <p className="target-form-problem">{problem}</p>}
      <div className="target-form-actions">
        <button type="submit" className="target-primary" disabled={!valid || busy}>
          {submitLabel}
        </button>
        {onCancel && (
          <button type="button" className="target-ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
