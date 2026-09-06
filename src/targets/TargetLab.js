import { useState } from 'react';
import TargetRecord, { TargetGameRows } from './TargetRecord';
import { TargetConditionSummary } from './TargetConditions';
import { describeDraft } from './TargetForm';
import { useTargetPreview } from './useTargets';
import './TargetFits.css';

/*
 * One line that always says where the Lab stands, so a reader who cannot see
 * the results dim hears the draft change, the read begin, and the answer land.
 * A half-typed draft is not a Target to evaluate, so it is not sent, and the
 * line says what would make it one.
 */
const describeLab = ({ valid, status, pending }) => {
  if (!valid) return 'Complete the Qualifiers to see the Backtest.';
  if (status === 'loading') return 'Reading the season…';
  // A refusal is the answer to the draft in hand, so it outranks the draft
  // having moved on; the next read replaces both.
  if (status === 'error') return 'Backtest not updated.';
  if (pending) return 'Draft changed · reading shortly…';
  if (status === 'ready') return 'Backtest up to date.';
  return '';
};

/*
 * The Lab: the season-to-date Backtest of the Draft Target above it, read
 * live as the draft is composed. It is not a destination; wherever a draft is
 * edited, this is the evidence beneath the form. Nothing is stored until Save,
 * and Save is the form's own — the Lab never touches it, so a slow or refused
 * read never blocks saving.
 */
export default function TargetLab({ draft, workbench = false, children }) {
  const [gradedBy, setGradedBy] = useState(null);
  const { valid, request } = describeDraft(draft);
  const { status, preview, error, pending, retry } = useTargetPreview(valid ? request : null);
  // The result on screen describes the draft it was read for; the moment the
  // draft moves on, the result is stale, whether or not the read has begun.
  const stale = pending || status !== 'ready';

  return (
    <section className="target-lab" aria-labelledby="target-lab-heading">
      <div className="target-lab-left">
        {children}
        <h2 id="target-lab-heading" className="target-section-heading">
          Lab · Backtest · season to date · vs {draft.opponent}
        </h2>
        <p role="status" className="target-lab-status">
          {describeLab({ valid, status, pending })}
        </p>
        {preview && (
          <TargetConditionSummary
            target={preview.target}
            gamesConsidered={preview.gamesConsidered}
            stale={stale}
          />
        )}
        {status === 'error' && (
          <p className="target-error" role="alert">
            {error}
            <button type="button" onClick={retry}>
              Retry backtest
            </button>
          </p>
        )}
        {preview && (
          /* What was last read stays on screen, dimmed, while the next answer is
           on its way: a keystroke never blanks the screen. */
          <div
            className={`target-lab-result${stale ? ' is-stale' : ''}`}
            aria-busy={status === 'loading'}
          >
            <TargetRecord
              backtest={preview}
              gradedBy={preview.statColumns.includes(gradedBy) ? gradedBy : preview.statColumns[0]}
              onGrade={setGradedBy}
            >
              {/* Season to date is the evidence; whether the idea is actionable
                tonight is one line, present only when the opponent plays. */}
              {preview.today && (
                <p className={`target-lab-tonight${preview.today.fitCount ? ' has-fits' : ''}`}>
                  <b>{preview.today.fitCount}</b> fit tonight vs {preview.target.opponent}
                </p>
              )}
            </TargetRecord>
          </div>
        )}
      </div>
      {workbench && preview && (
        <div
          className={`target-lab-games${stale ? ' is-stale' : ''}`}
          aria-busy={status === 'loading'}
        >
          <TargetGameRows
            backtest={preview}
            gradedBy={preview.statColumns.includes(gradedBy) ? gradedBy : preview.statColumns[0]}
          />
        </div>
      )}
    </section>
  );
}
