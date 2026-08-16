import { useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { KEYWORDS, OPPONENT_FILTERS, OPPONENT_RANK_NOTE, STACKED_EXAMPLES } from './queryHelp';
import './QueryReferencePage.css';

/**
 * The full query reference. It lives on its own route so it is linkable and
 * survives a reload, rather than covering the surface it describes.
 *
 * A query the reader was already typing arrives as router state and goes back
 * out the same way, so leaving the search page does not discard the draft.
 */
const QueryReferencePage = () => {
  const location = useLocation();
  const draftQuery = location.state?.query ?? '';
  const headingRef = useRef(null);

  // A client-side route change moves no focus on its own.
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <main className="query-reference">
      <Link className="query-reference-back" to="/" state={{ query: draftQuery }}>
        Back to search
      </Link>

      <h1 className="query-reference-title" tabIndex={-1} ref={headingRef}>
        Query reference
      </h1>
      <p className="query-reference-lede">
        Ask for a player in plain English, then add clauses until the sample is the one you mean.
      </p>

      <section className="query-reference-section" aria-labelledby="query-reference-clauses">
        <h2 id="query-reference-clauses">Clauses</h2>
        <table className="query-reference-table">
          <tbody>
            {KEYWORDS.map((entry) => (
              <tr key={entry.keyword}>
                <th scope="row">{entry.keyword}</th>
                <td>{entry.means}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="query-reference-section" aria-labelledby="query-reference-opponents">
        <h2 id="query-reference-opponents">Opponent filters</h2>
        <p className="query-reference-note">{OPPONENT_RANK_NOTE}</p>
        <div className="query-reference-columns">
          {OPPONENT_FILTERS.map((group) => (
            <div className="query-reference-column" key={group.category}>
              <h3>{group.category}</h3>
              <table className="query-reference-table">
                <tbody>
                  {group.items.map((item) => (
                    <tr key={item.token}>
                      <th scope="row">{item.token}</th>
                      <td>{item.means}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      </section>

      <section className="query-reference-section" aria-labelledby="query-reference-examples">
        <h2 id="query-reference-examples">Stacked examples</h2>
        <p className="query-reference-note">
          Any number of clauses can be combined in one question.
        </p>
        <ul className="query-reference-examples">
          {STACKED_EXAMPLES.map((example) => (
            <li key={example}>
              <Link to="/" state={{ query: example }}>
                {example}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
};

export default QueryReferencePage;
