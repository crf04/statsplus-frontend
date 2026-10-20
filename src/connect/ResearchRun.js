import CopyPrompt from './CopyPrompt';
import { RESEARCH_BRIEF, RESEARCH_PHASES, RESEARCH_PROMPT, RESEARCH_REPORT } from './researchData';
import './ResearchRun.css';

const VERDICT_LABEL = { lead: 'Lead', kept: 'Kept', mixed: 'Mixed', dropped: 'Dropped' };

const callCount = RESEARCH_PHASES.reduce(
  (sum, phase) => sum + phase.calls.reduce((n, call) => n + (call.calls || 1), 0),
  0,
);
const tally = (verdict) => RESEARCH_REPORT.filter((item) => item.verdict === verdict).length;

const Verdict = ({ verdict }) => (
  <span className={`rr-verdict rr-${verdict}`}>{VERDICT_LABEL[verdict]}</span>
);

const ResearchRun = () => (
  <div className="rr">
    <div className="rr-brief">
      <p className="oc-label">You send one message</p>
      <dl className="rr-brief-parts">
        {RESEARCH_BRIEF.map(({ part, text }) => (
          <div key={part}>
            <dt>{part}</dt>
            <dd>{text}</dd>
          </div>
        ))}
      </dl>
      <CopyPrompt text={RESEARCH_PROMPT} label="Copy brief" />
    </div>

    <ul className="rr-tally" aria-label="What the research did">
      <li>
        <strong>1</strong> message
      </li>
      <li>
        <strong>{callCount}</strong> calls
      </li>
      <li>
        <strong>{RESEARCH_REPORT.length}</strong> leads tested
      </li>
      <li className="rr-kept">
        <strong>{tally('kept')}</strong> kept
      </li>
      <li className="rr-mixed">
        <strong>{tally('mixed')}</strong> mixed
      </li>
      <li className="rr-dropped">
        <strong>{tally('dropped')}</strong> dropped
      </li>
    </ul>

    <div className="rr-trace">
      {RESEARCH_PHASES.map(({ phase, note, calls }) => (
        <section className="rr-phase" key={phase} aria-label={phase}>
          <header className="rr-phase-head">
            <h3>{phase}</h3>
            <p>{note}</p>
          </header>
          <ol className="rr-calls">
            {calls.map((call, index) => (
              <li key={index}>
                <p className="oc-call-head">
                  <span className="guide-chip">{call.tool}</span>
                  <code>{call.args}</code>
                  <Verdict verdict={call.verdict} />
                </p>
                <p className="oc-got">{call.found}</p>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>

    <div className="rr-report">
      <p className="oc-label">The report</p>
      <ul>
        {RESEARCH_REPORT.map(({ verdict, title, body }) => (
          <li key={title} className={`rr-item rr-item-${verdict}`}>
            <p className="rr-item-head">
              <Verdict verdict={verdict} />
              <strong>{title}</strong>
            </p>
            <p className="rr-item-body">{body}</p>
          </li>
        ))}
      </ul>
      <p className="oc-foot">
        Run with Claude and the CourtAI connector on October 19, 2026, for the March 20, 2026 slate
        (completed 2025-26 season). On a game day, ask about tonight.
      </p>
    </div>
  </div>
);

export default ResearchRun;
