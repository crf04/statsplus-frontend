import { Link, useLocation, useNavigate } from 'react-router-dom';
import { QUERY_LADDER, splitAddedClause } from './queryHelp';
import './QueryLadder.css';

/**
 * The landing page's empty state. Each rung loads the rung above it plus what
 * it adds, so the stacking rule is taught by doing it.
 *
 * `currentQuery` rides along to the reference page so a half-typed query
 * survives the trip there and back.
 */
const QueryLadder = ({ onUseQuery, disabled = false, currentQuery = '' }) => {
  const navigate = useNavigate();
  const location = useLocation();

  // Stamp the draft onto the entry being left, so the browser's own Back
  // button restores it too, not just the reference page's link. Modified
  // clicks are left to the browser, which is what opens a new tab.
  const openReference = (event) => {
    const modified = event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
    if (event.defaultPrevented || event.button !== 0 || modified) return;

    event.preventDefault();
    navigate(
      { pathname: location.pathname, search: location.search, hash: location.hash },
      { replace: true, state: { query: currentQuery } },
    );
    navigate('/help', { state: { query: currentQuery } });
  };

  return (
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
                aria-label={`${step.rung}. Loads ${step.query}. Adds ${step.added}.`}
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
        <Link to="/help" state={{ query: currentQuery }} onClick={openReference}>
          Every filter we understand
        </Link>
      </p>
    </section>
  );
};

export default QueryLadder;
