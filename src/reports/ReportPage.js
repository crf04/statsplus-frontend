import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { deleteReport, fetchReport } from '../reportsApi';
import SignUpPrompt from '../research/SignUpPrompt';
import ReportCard from './ReportCard';
import ReportEditor from './ReportEditor';
import ReportBlocks from './blocks/ReportBlocks';
import { cardLabel, TAG_LABEL } from './reportText';
import { AuthorTools, Published, ReportThis, SharedBy } from './ReportListing';
import '../research/research.css';
import './ReportPage.css';

const Paragraphs = ({ items }) => items.map((text, index) => <p key={index}>{text}</p>);

/* Who the notes are from: the handle when the page shows its author. */
const notesLabel = (report) => {
  const shown = report.listed ? `@${report.authorHandle}` : report.author;
  return shown ? `Notes from ${shown}` : 'Notes from the author';
};

/*
 * The author's own words under the opening: plain text in paragraphs, never
 * turned into links (crf04/statsplus#377).
 */
const Notes = ({ report }) =>
  report.notes?.trim() ? (
    <section className="report-notes" aria-labelledby="report-notes-label">
      <h2 id="report-notes-label">{notesLabel(report)}</h2>
      <Paragraphs items={report.notes.split(/\n\s*\n/).filter((text) => text.trim())} />
    </section>
  ) : null;

export const Sources = ({ sources }) =>
  sources.length ? (
    <p className="report-sources">
      Sources:{' '}
      {sources.map(([fact, url], index) => (
        <span key={url + index}>
          {index ? ' · ' : ''}
          <a href={url} target="_blank" rel="noreferrer">
            {fact}
          </a>
        </span>
      ))}
    </p>
  ) : null;

export const Tag = ({ tag }) =>
  tag ? <span className={`report-tag ${tag}`}>{TAG_LABEL[tag]}</span> : null;

/* An item's cards, one at a time behind chips: the first is the one that carries it. */
export const Deck = ({ ids, report }) => {
  const [active, setActive] = useState(0);
  if (!ids.length) return null;
  const call = report.calls[ids[Math.min(active, ids.length - 1)]];
  return (
    <div className="report-deck">
      {ids.length > 1 && (
        <div className="report-chips" role="group" aria-label="Cards">
          {ids.map((id, index) => (
            <button
              key={id}
              type="button"
              aria-pressed={index === active}
              onClick={() => setActive(index)}
            >
              {cardLabel(report.calls[id])}
            </button>
          ))}
        </div>
      )}
      <ReportCard
        key={call.id}
        html={report.cards[call.card]}
        call={call}
        label={cardLabel(call)}
      />
    </div>
  );
};

const Bullets = ({ bullets }) =>
  bullets.length ? (
    <ul className="report-bullets">
      {bullets.map(([label, text], index) => (
        <li key={index}>
          <strong>{label}</strong> · {text}
        </li>
      ))}
    </ul>
  ) : null;

// Every layout shows all of an item: a list item with more than a line opens like a row.
const hasDetail = (item) =>
  Boolean(
    item.subtitle ||
    item.body.length ||
    item.bullets.length ||
    item.watch ||
    item.cards.length ||
    item.sources.length,
  );

const ItemText = ({ item, withBody = true, withBullets = false }) => (
  <>
    {withBullets && <Bullets bullets={item.bullets} />}
    {withBody && <Paragraphs items={item.body} />}
    {item.watch && <p className="report-watch">{item.watch}</p>}
    <Sources sources={item.sources} />
  </>
);

const Tile = ({ item, report }) => {
  const [open, setOpen] = useState(false);
  const hasMore = item.body.length || item.watch || item.cards.length || item.sources.length;
  return (
    <section className={`report-tile${open ? ' open' : ''}`}>
      <div className="report-tile-text">
        <h3>
          <Tag tag={item.tag} /> {item.title}
        </h3>
        {item.subtitle && <p className="report-subtitle">{item.subtitle}</p>}
        {item.key && <p className="report-key">{item.key}</p>}
        <Bullets bullets={item.bullets} />
        {hasMore ? (
          <details onToggle={(event) => setOpen(event.currentTarget.open)}>
            <summary>{item.cards.length ? 'The read and cards' : 'The read'}</summary>
            <ItemText item={item} />
          </details>
        ) : null}
      </div>
      {open && item.cards.length > 0 && (
        <div className="report-tile-cards">
          <Deck ids={item.cards} report={report} />
        </div>
      )}
    </section>
  );
};

const Row = ({ item, report, id }) => {
  const [open, setOpen] = useState(false);
  return (
    <details
      className={`report-row ${item.tag || ''}`}
      id={id}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>
        <span className="report-row-tag">
          <Tag tag={item.tag} />
        </span>
        <span className="report-row-title">
          {item.title}
          {item.subtitle && <span className="report-subtitle">{item.subtitle}</span>}
        </span>
        <span className="report-key">{item.key}</span>
      </summary>
      {open && (
        <div className="report-row-body">
          <div>
            <ItemText item={item} withBullets />
          </div>
          <div>
            <Deck ids={item.cards} report={report} />
          </div>
        </div>
      )}
    </details>
  );
};

export const Tab = ({ tab, report, index }) => {
  if (tab.layout === 'tiles') {
    return (
      <div className="report-tiles">
        {tab.items.map((item, i) => (
          <Tile key={i} item={item} report={report} />
        ))}
      </div>
    );
  }
  if (tab.layout === 'rows') {
    return tab.items.map((item, i) => (
      <Row key={i} item={item} report={report} id={`item-${index}-${i}`} />
    ));
  }
  return (
    <div className="report-list">
      {tab.items.map((item, i) =>
        hasDetail(item) ? (
          <Row key={i} item={item} report={report} id={`item-${index}-${i}`} />
        ) : (
          <p key={i} className="report-list-item">
            <Tag tag={item.tag} /> <strong>{item.title}</strong>
            {item.key ? ` · ${item.key}` : ''}
          </p>
        ),
      )}
    </div>
  );
};

const longDate = (iso) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });

const Report = ({ report, onDeleted, onChanged, onEdited }) => {
  const signedIn = useAuth().isAuthenticated;
  const [active, setActive] = useState(0);
  const [deleting, setDeleting] = useState(false);
  const [editing, setEditing] = useState(false);
  const { document: doc } = report;
  // A tab whose every item its author hid is left out.
  const tabs = doc.tabs?.filter((tab) => tab.items.length) ?? [];
  const tabRefs = useRef([]);
  const editButton = useRef(null);
  const heading = useRef(null);
  const canEdit = report.isAuthor && signedIn && report.original !== null;

  const onKeyDown = (event) => {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
    if (!step) return;
    event.preventDefault();
    const next = (active + step + tabs.length) % tabs.length;
    setActive(next);
    tabRefs.current[next]?.focus();
  };

  const remove = async () => {
    if (!window.confirm('Delete this report? Its link will stop working for everyone.')) return;
    setDeleting(true);
    try {
      await deleteReport(report.id);
      onDeleted();
    } catch {
      setDeleting(false);
      window.alert('The report could not be deleted. Try again.');
    }
  };

  const finishEditing = (saved) => {
    setEditing(false);
    if (saved) {
      onEdited(saved);
      setActive(0);
      // The saved report is what readers now see; start reading it from the top.
      requestAnimationFrame(() => heading.current?.focus());
    } else {
      requestAnimationFrame(() => editButton.current?.focus());
    }
  };

  if (editing) {
    return (
      <ReportEditor
        report={report}
        notesLabel={notesLabel(report)}
        onSaved={finishEditing}
        onCancel={() => finishEditing(null)}
      />
    );
  }

  const [lede, ...rest] = doc.opening;
  return (
    <>
      <header className="report-head">
        <p className="report-eyebrow">CourtAI report</p>
        <h1 tabIndex={-1} ref={heading}>
          {doc.title}
        </h1>
        <div className="report-byline">
          <p className="report-meta">
            {[
              doc.date && longDate(doc.date),
              `by ${report.listed ? `@${report.authorHandle}` : report.author || 'a CourtAI user'}`,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
          {report.isAuthor && signedIn && (
            <AuthorTools
              report={report}
              onChanged={onChanged}
              canEdit={canEdit}
              editRef={editButton}
              onEdit={() => setEditing(true)}
              onDelete={remove}
              deleting={deleting}
            />
          )}
        </div>
        <Published createdAt={report.createdAt} editedAt={report.editedAt} />
        {lede && <p className="report-lede">{lede}</p>}
        {rest.length > 0 && (
          <div className="report-opening">
            <Paragraphs items={rest} />
          </div>
        )}
        <Notes report={report} />
      </header>

      {doc.blocks ? (
        <ReportBlocks blocks={doc.blocks} report={report} />
      ) : (
        <>
          <div className="report-tablist" role="tablist" aria-label="Report sections">
            {tabs.map((tab, index) => (
              <button
                key={index}
                ref={(node) => {
                  tabRefs.current[index] = node;
                }}
                type="button"
                role="tab"
                id={`report-tab-${index}`}
                aria-selected={index === active}
                aria-controls={`report-panel-${index}`}
                tabIndex={index === active ? 0 : -1}
                onClick={() => setActive(index)}
                onKeyDown={onKeyDown}
              >
                {tab.title} <span className="report-tab-count">{tab.items.length}</span>
              </button>
            ))}
          </div>
          {tabs.map((tab, index) => (
            <div
              key={index}
              role="tabpanel"
              id={`report-panel-${index}`}
              aria-labelledby={`report-tab-${index}`}
              hidden={index !== active}
            >
              {index === active && <Tab tab={tab} report={report} index={index} />}
            </div>
          ))}
        </>
      )}

      <footer className="report-foot">
        {report.listed && <SharedBy handle={report.authorHandle} />}
        {doc.footnote && <p>{doc.footnote}</p>}
        <p>
          Built by an AI from CourtAI data{doc.skill ? ` using the ${doc.skill.name} skill` : ''}. A
          spot is a place to look, not a pick.{' '}
          {doc.skill?.url ? (
            <a href={doc.skill.url}>Make your own →</a>
          ) : (
            <Link to="/connect">Make your own →</Link>
          )}
        </p>
        <p>
          <ReportThis reportId={report.id} />
        </p>
      </footer>
      <SignUpPrompt />
    </>
  );
};

const REMOVED = {
  author: {
    title: 'This report was removed by its author',
    body: 'Its author deleted it, so the link no longer opens it.',
  },
  takedown: {
    title: 'This report was taken down',
    body: 'CourtAI removed it, so the link no longer opens it.',
  },
};

/* A dead link that still leads somewhere: more research, and a way in. */
const Removed = ({ by }) => (
  <div className="report-status">
    <p className="report-eyebrow">CourtAI report</p>
    <h1>{REMOVED[by].title}</h1>
    <p>{REMOVED[by].body}</p>
    <p>
      <Link to="/research">Browse more research →</Link>
    </p>
    <SignUpPrompt />
  </div>
);

const ReportPage = () => {
  const { id } = useParams();
  // Whether the viewer is the author changes with the account, so a sign-in
  // or sign-out reads the report again.
  const uid = useAuth().currentUser?.uid ?? null;
  const [state, setState] = useState({ status: 'loading' });

  const settle = (found) => {
    if (!found) return { status: 'missing' };
    return found.removedBy
      ? { status: 'removed', by: found.removedBy }
      : { status: 'ready', report: found.report };
  };

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: 'loading' });
    fetchReport(id, { signal: controller.signal })
      .then((found) => setState(settle(found)))
      .catch((error) => {
        if (!controller.signal.aborted) setState({ status: 'error', error });
      });
    return () => controller.abort();
  }, [id, uid]);

  // After a listing change: the report as the public now sees it.
  const reload = async () => {
    try {
      setState(settle(await fetchReport(id)));
    } catch (error) {
      setState({ status: 'error', error });
    }
  };

  useEffect(() => {
    if (state.status === 'ready') document.title = `${state.report.document.title} | CourtAI`;
  }, [state]);

  return (
    <main className="report-page">
      {state.status === 'loading' && <p className="report-status">Loading report…</p>}
      {state.status === 'missing' && (
        <div className="report-status">
          <h1>This report isn&apos;t available</h1>
          <p>It may have been deleted. You can build your own from CourtAI&apos;s data.</p>
          <Link to="/skills/injury-brief">See how →</Link>
        </div>
      )}
      {state.status === 'removed' && <Removed by={state.by} />}
      {state.status === 'deleted' && (
        <div className="report-status">
          <h1>Report deleted</h1>
          <p>Its link no longer works.</p>
        </div>
      )}
      {state.status === 'error' && (
        <div className="report-status" role="alert">
          <h1>The report could not be loaded</h1>
          <p>Try again in a moment.</p>
        </div>
      )}
      {state.status === 'ready' && (
        <Report
          report={state.report}
          onDeleted={() => setState({ status: 'deleted' })}
          onChanged={reload}
          onEdited={(report) => setState({ status: 'ready', report })}
        />
      )}
    </main>
  );
};

export default ReportPage;
