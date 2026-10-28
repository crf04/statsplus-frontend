import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { fetchAuthorResearch, fetchResearch } from '../reportsApi';
import ResearchEntry from './ResearchEntry';
import SignUpPrompt from './SignUpPrompt';
import './research.css';

const HANDLE_PATH = /^@([a-z0-9_]{3,20})$/i;

const List = ({ entries, label, featured = false }) => (
  <ul className={`research-list${featured ? ' is-featured' : ''}`} aria-label={label}>
    {entries.map((entry) => (
      <li key={entry.id}>
        <ResearchEntry entry={entry} featured={featured} />
      </li>
    ))}
  </ul>
);

/*
 * The feed (`/research`) and an author's page (`/research/@handle`): Featured
 * on top of the feed's first page, then 20 listed reports at a time, newest
 * first, with Load more while the API hands back a cursor.
 */
const ResearchPage = () => {
  const { author } = useParams();
  const match = author === undefined ? null : author.match(HANDLE_PATH);
  const handle = match ? match[1].toLowerCase() : null;
  const [state, setState] = useState({ status: 'loading' });
  const [more, setMore] = useState({ loading: false, failed: false });
  const request = useRef(null);

  useEffect(() => {
    if (author !== undefined && !handle) return undefined;
    const controller = new AbortController();
    request.current = controller;
    setState({ status: 'loading' });
    setMore({ loading: false, failed: false });
    const load = handle
      ? fetchAuthorResearch(handle, { signal: controller.signal })
      : fetchResearch({ signal: controller.signal });
    load
      .then((page) => setState(page ? { status: 'ready', ...page } : { status: 'unknown' }))
      .catch(() => {
        if (!controller.signal.aborted) setState({ status: 'error' });
      });
    return () => controller.abort();
  }, [author, handle]);

  useEffect(() => {
    document.title = handle ? `@${handle} · Research | CourtAI` : 'Research | CourtAI';
  }, [handle]);

  if (author !== undefined && !handle) return <Navigate to="/research" replace />;

  const loadMore = async () => {
    const { signal } = request.current;
    setMore({ loading: true, failed: false });
    try {
      const page = handle
        ? await fetchAuthorResearch(handle, { cursor: state.nextCursor, signal })
        : await fetchResearch({ cursor: state.nextCursor, signal });
      if (signal.aborted) return;
      setState((current) => ({
        ...current,
        reports: [...current.reports, ...(page?.reports ?? [])],
        nextCursor: page?.nextCursor ?? null,
      }));
      setMore({ loading: false, failed: false });
    } catch {
      if (!signal.aborted) setMore({ loading: false, failed: true });
    }
  };

  const empty = state.status === 'ready' && !state.featured.length && !state.reports.length;
  return (
    <main className="research-page">
      <header className="research-head">
        {handle ? (
          <>
            <p className="research-eyebrow">
              <Link to="/research">Research</Link> <span aria-hidden="true">/</span> Author
            </p>
            <h1>@{handle}</h1>
            <p className="research-intro">
              Reports @{handle} chose to share. Each one is frozen as it was published.
            </p>
          </>
        ) : (
          <>
            <p className="research-eyebrow">CourtAI</p>
            <h1>Research</h1>
            <p className="research-intro">
              Reports CourtAI users chose to share, newest first. CourtAI reports facts; each report
              is its author&apos;s view, frozen as it was published.
            </p>
          </>
        )}
      </header>

      {state.status === 'loading' && <p className="research-status">Loading research…</p>}
      {state.status === 'error' && (
        <div className="research-status" role="alert">
          <h2>Research could not be loaded</h2>
          <p>Try again in a moment.</p>
        </div>
      )}
      {state.status === 'unknown' && (
        <div className="research-status">
          <h2>No author goes by @{handle}</h2>
          <p>
            <Link to="/research">Browse all research →</Link>
          </p>
        </div>
      )}
      {empty && (
        <p className="research-status">
          {handle ? `@${handle} hasn't listed any reports yet.` : 'Nothing has been listed yet.'}
        </p>
      )}
      {state.status === 'ready' && state.featured.length > 0 && (
        <section className="research-section" aria-labelledby="research-featured">
          <h2 id="research-featured" className="research-section-title">
            Featured
          </h2>
          <List entries={state.featured} label="Featured reports" featured />
        </section>
      )}
      {state.status === 'ready' && state.reports.length > 0 && (
        <section className="research-section" aria-labelledby="research-latest">
          <h2 id="research-latest" className="research-section-title">
            {handle ? 'Reports' : 'Latest'}
          </h2>
          <List
            entries={state.reports}
            label={handle ? `Reports by @${handle}` : 'Latest reports'}
          />
          {state.nextCursor && (
            <div className="research-more">
              <button type="button" onClick={loadMore} disabled={more.loading}>
                {more.loading ? 'Loading…' : 'Load more'}
              </button>
              {more.failed && <p role="alert">More reports could not be loaded. Try again.</p>}
            </div>
          )}
        </section>
      )}
      <SignUpPrompt />
    </main>
  );
};

export default ResearchPage;
