import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { deleteReport, fetchReport } from '../reportsApi';
import ReportCard from './ReportCard';
import './ReportPage.css';

const TAG_LABEL = { strong: 'Strong', lean: 'Lean', thin: 'Thin', pass: 'Pass', tipped: 'Tipped' };

const lastName = (name) =>
  String(name || '')
    .trim()
    .split(/\s+/)
    .slice(-1)[0];

/* A chip's name for one card: whose card and what it shows ("Bane PTS w/o Banchero", "ORL on/off"). */
export const cardLabel = (call) => {
  const s = call.structured || {};
  const player = s.player && (s.player.name || s.player);
  const who = typeof player === 'string' ? lastName(player) : '';
  const applied = s.applied || {};
  if (call.tool === 'query_game_logs') {
    const without = (applied.without || []).map((w) => lastName(w.name || w));
    const minutes = applied.minutes;
    const scope = without.length
      ? `w/o ${without.join(', ')}`
      : minutes
        ? minutes.high >= 48
          ? `${minutes.low}+ min`
          : `${minutes.low}-${minutes.high} min`
        : (applied.filters || []).length
          ? 'vs defenses'
          : applied.last_n
            ? `last ${applied.last_n}`
            : 'season';
    return `${who} ${s.chart_stat || ''} ${scope}`.replace(/\s+/g, ' ').trim();
  }
  const named = {
    get_on_off: `${s.team || ''} on/off`,
    get_matchup: `${who} matchup`,
    get_rotation: 'Rotation',
    get_injuries: 'Report',
    get_injury_scenarios: 'Scenarios',
  }[call.tool];
  return (named || 'Card').trim();
};

const Paragraphs = ({ items }) => items.map((text, index) => <p key={index}>{text}</p>);

const Sources = ({ sources }) =>
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

const Tag = ({ tag }) =>
  tag ? <span className={`report-tag ${tag}`}>{TAG_LABEL[tag]}</span> : null;

/* An item's cards, one at a time behind chips: the first is the one that carries it. */
const Deck = ({ ids, report }) => {
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

const Tab = ({ tab, report, index }) => {
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

const Report = ({ report, onDeleted }) => {
  const [active, setActive] = useState(0);
  const [deleting, setDeleting] = useState(false);
  const { document: doc } = report;
  const tabRefs = useRef([]);

  const onKeyDown = (event) => {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
    if (!step) return;
    event.preventDefault();
    const next = (active + step + doc.tabs.length) % doc.tabs.length;
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

  const [lede, ...rest] = doc.opening;
  return (
    <>
      <header className="report-head">
        <p className="report-eyebrow">CourtAI report</p>
        <h1 tabIndex={-1}>{doc.title}</h1>
        <p className="report-meta">
          {[doc.date && longDate(doc.date), `by ${report.author || 'a CourtAI user'}`]
            .filter(Boolean)
            .join(' · ')}
        </p>
        {lede && <p className="report-lede">{lede}</p>}
        {rest.length > 0 && (
          <div className="report-opening">
            <Paragraphs items={rest} />
          </div>
        )}
      </header>

      <div className="report-tablist" role="tablist" aria-label="Report sections">
        {doc.tabs.map((tab, index) => (
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
            {tab.title}
            <span className="report-tab-count">{tab.items.length}</span>
          </button>
        ))}
      </div>
      {doc.tabs.map((tab, index) => (
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

      <footer className="report-foot">
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
        {report.isAuthor && (
          <button type="button" className="report-delete" onClick={remove} disabled={deleting}>
            {deleting ? 'Deleting…' : 'Delete this report'}
          </button>
        )}
      </footer>
    </>
  );
};

const ReportPage = () => {
  const { id } = useParams();
  const [state, setState] = useState({ status: 'loading' });

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: 'loading' });
    fetchReport(id, { signal: controller.signal })
      .then((report) => setState(report ? { status: 'ready', report } : { status: 'missing' }))
      .catch((error) => {
        if (!controller.signal.aborted) setState({ status: 'error', error });
      });
    return () => controller.abort();
  }, [id]);

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
        <Report report={state.report} onDeleted={() => setState({ status: 'deleted' })} />
      )}
    </main>
  );
};

export default ReportPage;
