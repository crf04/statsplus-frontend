import { Link } from 'react-router-dom';
import { QUERY_LADDER, splitAddedClause } from './queryHelp';
import './QueryLadder.css';

/**
 * The landing page's empty state. Each rung loads a query that is the rung
 * above it plus one clause, so the stacking rule is taught by doing it.
 */
const QueryLadder = ({ onUseQuery, disabled = false }) => (
  <section className="query-ladder" aria-labelledby="query-ladder-heading">
    <div className="query-ladder-head">
      <h2 id="query-ladder-heading" className="query-ladder-title">
        One question, three steps
      </h2>
      <p className="query-ladder-sub">Each step adds to the query above it. Click to load it.</p>
    </div>

    <ol className="query-ladder-rungs">
      {QUERY_LADDER.map((step, index) => {
        const { before, added, after } = splitAddedClause(step.query, step.added);

        return (
          <li className="query-ladder-rung" key={step.id}>
            <button
              type="button"
              className="query-ladder-button"
              onClick={() => onUseQuery(step.query)}
              disabled={disabled}
            >
              <span className="query-ladder-index" aria-hidden="true">
                {index + 1}
              </span>
              <span className="query-ladder-body">
                <span className="query-ladder-rung-title">{step.rung}</span>
                <span className="query-ladder-query">
                  {before}
                  <mark>{added}</mark>
                  {after}
                </span>
                <span className="query-ladder-note">{step.note}</span>
              </span>
            </button>
          </li>
        );
      })}
    </ol>

    <p className="query-ladder-reference">
      <Link to="/help">Every filter we understand</Link>
    </p>
  </section>
);

export default QueryLadder;
