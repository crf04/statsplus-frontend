import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { QUERY_LADDER, splitAddedClause } from './queryHelp';
import './QueryLadder.css';

/**
 * The landing page's empty state. Each rung loads the rung above it plus what
 * it adds, so the stacking rule is taught by doing it. With `answers` (one per
 * rung, signed in) each rung also shows what its query returns: average
 * points, the change from the rung before, and a bar per game.
 *
 * `currentQuery` rides along to the reference page so a half-typed query
 * survives the trip there and back.
 */
// What a screen reader hears for an answered rung.
const answerLabel = (answer, previous) => {
  const change = previous ? Math.round((answer.points - previous.points) * 10) / 10 : null;
  const delta = change === null ? '' : `, ${signed(change)} from the step before`;
  return `${answer.points.toFixed(1)} points per game${delta}, over ${answer.games} games.`;
};

const signed = (value) => `${value >= 0 ? '+' : '−'}${Math.abs(value).toFixed(1)}`;

/* One bar per kept game, oldest first; gold where the game was above this rung's average. */
const LadderAnswer = ({ answer, previous }) => {
  const peak = Math.max(...answer.series, 1);
  const change = previous ? Math.round((answer.points - previous.points) * 10) / 10 : null;
  return (
    <span className="query-ladder-answer">
      <span className="query-ladder-points">
        <b>{answer.points.toFixed(1)}</b> PTS
        {change !== null && (
          <small className={change >= 0 ? 'is-up' : 'is-down'}>{signed(change)}</small>
        )}
      </span>
      <span className="query-ladder-games">{answer.games} games</span>
      <span className="query-ladder-bars" aria-hidden="true">
        {answer.series.map((points, game) => (
          <i
            // Bars never reorder: a game's position is its date.
            key={game}
            className={points > answer.points ? 'is-over' : undefined}
            style={{ height: `${Math.max(6, (points / peak) * 100)}%` }}
          />
        ))}
      </span>
    </span>
  );
};

const QueryLadder = ({ onUseQuery, disabled = false, currentQuery = '', answers = null }) => {
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
          Get more specific
        </h2>
        <Link
          to="/help"
          state={{ query: currentQuery }}
          onClick={openReference}
          className="query-ladder-reference"
        >
          All filters <ArrowRight size={13} aria-hidden="true" />
        </Link>
      </div>

      <ol className="query-ladder-rungs">
        {QUERY_LADDER.map((step, index) => {
          const { before, added, after } = splitAddedClause(step.query, step.added);

          return (
            <li className="query-ladder-rung" key={step.id}>
              <button
                type="button"
                className="query-ladder-button"
                aria-label={`${step.rung}. Loads ${step.query}. Adds ${step.added}.${
                  answers ? ` ${answerLabel(answers[index], answers[index - 1])}` : ''
                }`}
                onClick={() => onUseQuery(step.query)}
                disabled={disabled}
              >
                {answers ? (
                  <span className="query-ladder-body">
                    <span className="query-ladder-query">
                      {before}
                      <mark>{added}</mark>
                      {after}
                    </span>
                    <LadderAnswer answer={answers[index]} previous={answers[index - 1]} />
                  </span>
                ) : (
                  <>
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
                  </>
                )}
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
};

export default QueryLadder;
