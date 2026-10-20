import { useState } from 'react';
import CopyPrompt from './CopyPrompt';
import { ANATOMY, ANATOMY_SENTENCE, OUTCOMES } from './outcomeData';
import './OutcomeRuns.css';

export const Anatomy = () => (
  <figure className="oc-anatomy" aria-label="The parts of an outcome prompt">
    <p className="oc-anatomy-sentence">
      {ANATOMY_SENTENCE.map((piece, index) =>
        typeof piece === 'string' ? (
          piece
        ) : (
          <mark key={index} className={`oc-part oc-part-${piece[0]}`}>
            {piece[1]}
            <span className="oc-part-tag">{ANATOMY[piece[0]].part}</span>
          </mark>
        ),
      )}
    </p>
    <dl className="oc-anatomy-key">
      {ANATOMY.map(({ part, hint }, index) => (
        <div key={part}>
          <dt className={`oc-key oc-part-${index}`}>{part}</dt>
          <dd>{hint}</dd>
        </div>
      ))}
    </dl>
  </figure>
);

export const OutcomeRuns = () => {
  const [active, setActive] = useState(0);
  const run = OUTCOMES[active];
  return (
    <div className="oc-runs">
      <div className="oc-tabs" role="tablist" aria-label="Example outcome">
        {OUTCOMES.map((o, index) => (
          <button
            key={o.id}
            type="button"
            role="tab"
            aria-selected={index === active}
            className="oc-tab"
            onClick={() => setActive(index)}
          >
            {o.label}
          </button>
        ))}
      </div>

      <div className="oc-run" role="tabpanel">
        <div className="oc-prompt">
          <p className="oc-label">You ask once</p>
          <p className="oc-prompt-text">{run.prompt}</p>
          {run.note && <p className="oc-note">{run.note}</p>}
          <CopyPrompt text={run.prompt} label="Copy prompt" />
        </div>

        <div className="oc-plan">
          <p className="oc-label">
            It chose {run.calls.length} calls <span>you named none of them</span>
          </p>
          <ol className="oc-calls">
            {run.calls.map((call, index) => (
              <li key={index}>
                <p className="oc-call-head">
                  <span className="guide-chip">{call.tool}</span>
                  <code>{call.args}</code>
                </p>
                <p className="oc-why">{call.why}</p>
                <p className="oc-got">{call.got}</p>
              </li>
            ))}
          </ol>
        </div>

        <div className="oc-answer">
          <p className="oc-label">The outcome</p>
          <div className="oc-answer-text">{run.answer}</div>
          <p className="oc-foot">
            Run with Claude and the CourtAI connector on October 19, 2026, on the completed 2025-26
            season.
          </p>
        </div>
      </div>
    </div>
  );
};
