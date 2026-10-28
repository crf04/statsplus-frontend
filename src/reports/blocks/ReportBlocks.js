import { Fragment, useRef, useState } from 'react';
import ReportCard from '../ReportCard';
import { Deck, Sources, Tab, Tag } from '../ReportPage';
import { cardLabel } from '../reportText';
import './ReportBlocks.css';

/*
 * A block document (crf04/statsplus#380): headings, paragraphs, cards inline
 * or in a row, spots, callouts, tables, today's item layouts, sources and a
 * tab group, in the order the writer chose.
 */

/* Light formatting inside a line: **bold** and *italic*. Nothing else is parsed, links included. */
const Inline = ({ text }) =>
  text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/).map((part, i) => {
    if (part.length > 4 && part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    if (part.length > 2 && part.startsWith('*') && part.endsWith('*')) {
      return <em key={i}>{part.slice(1, -1)}</em>;
    }
    return <Fragment key={i}>{part}</Fragment>;
  });

/* Each line is a paragraph, and a run of lines starting "- " is a bulleted list. */
export const RichText = ({ text, className }) => {
  const groups = [];
  text.split('\n').forEach((line) => {
    if (!line.trim()) return;
    const last = groups[groups.length - 1];
    if (line.startsWith('- ')) {
      if (last?.list) last.lines.push(line.slice(2));
      else groups.push({ list: true, lines: [line.slice(2)] });
    } else {
      groups.push({ list: false, lines: [line] });
    }
  });
  return groups.map((group, i) =>
    group.list ? (
      <ul key={i} className="report-block-bullets">
        {group.lines.map((line, j) => (
          <li key={j}>
            <Inline text={line} />
          </li>
        ))}
      </ul>
    ) : (
      <p key={i} className={className}>
        <Inline text={group.lines[0]} />
      </p>
    ),
  );
};

const Card = ({ id, report }) => {
  const call = report.calls[id];
  return (
    <figure className="report-block-card">
      <ReportCard html={report.cards[call.card]} call={call} label={cardLabel(call)} />
    </figure>
  );
};

const Spot = ({ block, report }) => (
  <section className="report-block-spot" aria-label={block.title}>
    <div className={`report-block-spot-line ${block.tag || ''}`}>
      <span className="report-row-tag">
        <Tag tag={block.tag} />
      </span>
      <span className="report-row-title">
        {block.title}
        {block.subtitle && <span className="report-subtitle">{block.subtitle}</span>}
      </span>
      {block.key && <span className="report-key">{block.key}</span>}
    </div>
    <Deck ids={block.cards} report={report} />
  </section>
);

const Table = ({ block }) => (
  <div className="report-block-table">
    <table>
      <thead>
        <tr>
          {block.columns.map((column, i) => (
            <th key={i} scope="col">
              {column}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {block.rows.map((row, r) => (
          <tr key={r}>
            {row.map((cell, i) =>
              i ? (
                <td key={i}>{cell}</td>
              ) : (
                <th key={i} scope="row">
                  {cell}
                </th>
              ),
            )}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

/* Today's tab bar over groups of blocks; a tab whose every block its author hid is left out. */
const TabGroup = ({ block, report }) => {
  const [active, setActive] = useState(0);
  const tabRefs = useRef([]);
  const tabs = block.tabs.filter((tab) => tab.blocks.length);
  if (!tabs.length) return null;
  const shown = Math.min(active, tabs.length - 1);
  const onKeyDown = (event) => {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
    if (!step) return;
    event.preventDefault();
    const next = (shown + step + tabs.length) % tabs.length;
    setActive(next);
    tabRefs.current[next]?.focus();
  };
  const tabId = (index) => `report-tab-${block.id}-${index}`;
  const panelId = (index) => `report-panel-${block.id}-${index}`;
  return (
    <div className="report-block-tabs">
      <div className="report-tablist" role="tablist" aria-label="Report sections">
        {tabs.map((tab, index) => (
          <button
            key={index}
            ref={(node) => {
              tabRefs.current[index] = node;
            }}
            type="button"
            role="tab"
            id={tabId(index)}
            aria-selected={index === shown}
            aria-controls={panelId(index)}
            tabIndex={index === shown ? 0 : -1}
            onClick={() => setActive(index)}
            onKeyDown={onKeyDown}
          >
            {tab.title}
          </button>
        ))}
      </div>
      {tabs.map((tab, index) => (
        <div
          key={index}
          role="tabpanel"
          id={panelId(index)}
          aria-labelledby={tabId(index)}
          hidden={index !== shown}
        >
          {index === shown && <Blocks blocks={tab.blocks} report={report} />}
        </div>
      ))}
    </div>
  );
};

const Block = ({ block, report }) => {
  switch (block.type) {
    case 'heading':
      return <h2 className="report-block-heading">{block.text}</h2>;
    case 'paragraph':
      return (
        <RichText
          text={block.text}
          className={block.lede ? 'report-lede' : 'report-block-paragraph'}
        />
      );
    case 'list': {
      const List = block.ordered ? 'ol' : 'ul';
      return (
        <List className="report-block-list">
          {block.items.map((text, i) => (
            <li key={i}>{text}</li>
          ))}
        </List>
      );
    }
    case 'callout':
      return (
        <aside className={`report-block-callout ${block.tone || ''}`}>
          {block.title && <p className="report-block-callout-title">{block.title}</p>}
          <RichText text={block.text} />
        </aside>
      );
    case 'card':
      return block.card ? <Card id={block.card} report={report} /> : null;
    case 'cards':
      return block.cards.length ? (
        <div className="report-block-card-row">
          {block.cards.map((id) => (
            <Card key={id} id={id} report={report} />
          ))}
        </div>
      ) : null;
    case 'spot':
      return <Spot block={block} report={report} />;
    case 'table':
      return <Table block={block} />;
    case 'items':
      return block.items.length ? <Tab tab={block} report={report} index={block.id} /> : null;
    case 'sources':
      return <Sources sources={block.sources} />;
    case 'tabs':
      return <TabGroup block={block} report={report} />;
    default:
      return null;
  }
};

const Blocks = ({ blocks, report }) =>
  blocks.map((block) => <Block key={block.id} block={block} report={report} />);

const ReportBlocks = ({ blocks, report }) => (
  <article className="report-blocks">
    <Blocks blocks={blocks} report={report} />
  </article>
);

export default ReportBlocks;
