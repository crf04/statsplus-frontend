import { BacktestEvidence } from './TargetBacktest';
import { describeDraft } from './TargetForm';
import { useTargetPreview } from './useTargets';
import './TargetFits.css';

/*
 * The Lab: the season-to-date Backtest of the Draft Target above it, read
 * live as the draft is composed. It is not a destination; wherever a draft is
 * edited, this is the evidence beneath the form. Nothing is stored until Save,
 * and Save is the form's own — the Lab never touches it, so a slow or refused
 * read never blocks saving.
 */
export default function TargetLab({ draft }) {
  const { valid, request } = describeDraft(draft);
  const { status, preview, error, pending } = useTargetPreview(valid ? request : null);
  // The result on screen describes the draft it was read for; the moment the
  // draft moves on, the result is stale, whether or not the read has begun.
  const stale = pending || status !== 'ready';

  return (
    <section
      className="target-lab"
      aria-labelledby="target-lab-heading"
      aria-busy={status === 'loading'}
    >
      <h2 id="target-lab-heading" className="target-section-heading">
        Lab · Backtest · season to date · vs {draft.opponent}
      </h2>
      {/* A half-typed draft is not a Target to evaluate, so it is not sent. */}
      {!valid && <p className="target-empty">Complete the Qualifiers to see the Backtest.</p>}
      {status === 'loading' && <p role="status">Reading the season…</p>}
      {status === 'error' && (
        <p className="target-error" role="alert">
          {error}
        </p>
      )}
      {preview && (
        /* What was last read stays on screen, dimmed, while the next answer is
           on its way: a keystroke never blanks the screen. */
        <div className={`target-lab-result${stale ? ' is-stale' : ''}`}>
          <BacktestEvidence backtest={preview}>
            {/* Season to date is the evidence; whether the idea is actionable
                tonight is one line, present only when the opponent plays. */}
            {preview.today && (
              <p className={`target-lab-tonight${preview.today.fitCount ? ' has-fits' : ''}`}>
                <b>{preview.today.fitCount}</b> fit tonight vs {preview.target.opponent}
              </p>
            )}
          </BacktestEvidence>
        </div>
      )}
    </section>
  );
}
