import {
  NBA_TEAM_TRICODES,
  TARGET_BASES,
  TARGET_SLICES,
  deriveTargetTitle,
  nudgeThresholdPercent,
  parseThresholdPercent,
  shareToThresholdPercent,
  findTargetBase,
} from './targetCatalog';
import { useDietBaselines } from './useTargets';
import './TargetWorkbench.css';

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
    thresholdPercent: shareToThresholdPercent(qualifier.threshold),
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
  showActions = true,
  cancelLabel = 'Cancel',
  title,
}) {
  const { valid, problem, request } = describeDraft(draft);
  const baselines = useDietBaselines();
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
      <fieldset disabled={busy} className="target-form-fields">
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
          {/* Stored titles remain authoritative until the criteria move. */}
          <div className="target-form-preview">
            {!title && (
              <span className="target-label">Title preview · derived from the Qualifiers</span>
            )}
            {valid ? (
              <h1 className="target-title">{title || deriveTargetTitle(request)}</h1>
            ) : (
              <p>Complete the Qualifiers to see the title.</p>
            )}
          </div>
        </div>

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
            <QualifierSlider
              qualifier={qualifier}
              index={index}
              leagueShare={baselines.shares[qualifier.base]?.[qualifier.sliceKey]}
              onChange={(patch) => patchQualifier(index, patch)}
            />
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
          + and
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
        {showActions && (
          <div className="target-form-actions">
            <button type="submit" className="target-primary" disabled={!valid || busy}>
              {submitLabel}
            </button>
            {onCancel && (
              <button type="button" className="target-ghost" onClick={onCancel} disabled={busy}>
                {cancelLabel}
              </button>
            )}
          </div>
        )}
      </fieldset>
    </form>
  );
}

function QualifierSlider({ qualifier, index, leagueShare, onChange }) {
  const value = Number(qualifier.thresholdPercent) || 0;
  const league = typeof leagueShare === 'number' ? leagueShare * 100 : null;
  const ceiling = Math.max(60, (Math.floor(Math.max(value, league || 0) / 10) + 1) * 10);
  const above = qualifier.comparator === 'at_or_above';
  return (
    <div className={`target-slider-row ${above ? 'is-at-or-above' : 'is-at-or-below'}`}>
      <button
        type="button"
        className="target-comparator-toggle"
        aria-label={
          above ? 'At or above; switch to at or below' : 'At or below; switch to at or above'
        }
        onClick={() => onChange({ comparator: above ? 'at_or_below' : 'at_or_above' })}
      >
        {above ? '≥' : '≤'}
      </button>
      <div
        className="target-slider-track"
        style={{ '--threshold-position': `${(value / ceiling) * 100}%` }}
      >
        <output className="target-slider-value">
          {qualifier.thresholdPercent === '' ? 'Choose' : `${value}%`}
        </output>
        <input
          type="range"
          min="0"
          max={ceiling}
          step="any"
          aria-label={`Qualifier ${index + 1} threshold percent`}
          aria-valuetext={qualifier.thresholdPercent === '' ? 'Choose a threshold' : `${value}%`}
          value={value}
          onChange={(event) =>
            onChange({ thresholdPercent: String(Math.min(100, Number(event.target.value))) })
          }
          onKeyDown={(event) => {
            const delta = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[event.key];
            if (!delta) return;
            event.preventDefault();
            onChange({
              thresholdPercent: nudgeThresholdPercent(qualifier.thresholdPercent, delta),
            });
          }}
        />
        {league !== null && (
          <span className="target-league-tick" style={{ left: `${(league / ceiling) * 100}%` }}>
            league {Math.round(league * 10) / 10}%
          </span>
        )}
      </div>
      <small className="target-slider-unit">{findTargetBase(qualifier.base)?.unit}</small>
    </div>
  );
}
