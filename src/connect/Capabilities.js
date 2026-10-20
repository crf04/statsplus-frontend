import { useState } from 'react';
import CopyPrompt from './CopyPrompt';
import { CAPABILITIES, GROUPS } from './capabilityData';
import './Capabilities.css';

const toolCount = new Set(CAPABILITIES.map((c) => c.tool)).size;

const Capabilities = () => {
  const [group, setGroup] = useState('all');
  const [expanded, setExpanded] = useState(false);
  const trimmed = group === 'all' && !expanded;
  const visibleGroups = GROUPS.filter((g) => group === 'all' || g.id === group).slice(
    0,
    trimmed ? 2 : undefined,
  );
  const hiddenCount = trimmed
    ? CAPABILITIES.filter((c) => !visibleGroups.some((g) => g.id === c.group)).length
    : 0;
  const shown = CAPABILITIES.filter((c) => group === 'all' || c.group === group);

  return (
    <div className="cap">
      <p className="cap-count">
        <strong>{CAPABILITIES.length}</strong> things to ask, across <strong>{toolCount}</strong>{' '}
        tools. Every answer below is real.
      </p>
      <div className="cap-filters" role="group" aria-label="Filter by job">
        {[{ id: 'all', label: 'All' }, ...GROUPS].map((g) => (
          <button
            key={g.id}
            type="button"
            className="cap-filter"
            aria-pressed={group === g.id}
            onClick={() => setGroup(g.id)}
          >
            {g.label}
            <span>
              {g.id === 'all'
                ? CAPABILITIES.length
                : CAPABILITIES.filter((c) => c.group === g.id).length}
            </span>
          </button>
        ))}
      </div>

      {visibleGroups.map((g) => (
        <section className="cap-group" key={g.id} aria-label={g.label}>
          <h3 className="cap-group-title">{g.label}</h3>
          <ul className="cap-grid">
            {shown
              .filter((c) => c.group === g.id)
              .map((c) => (
                <li className="cap-card" key={c.title}>
                  <p className="cap-head">
                    <span className="guide-chip">{c.tool}</span>
                    {c.card && <span className="cap-tag">Card</span>}
                    {c.writes && (
                      <span className="cap-tag cap-tag-writes">Saves to your account</span>
                    )}
                  </p>
                  <h4 className="cap-title">{c.title}</h4>
                  <p className="cap-what">{c.what}</p>
                  <div className="cap-try">
                    <p className="cap-prompt">{c.prompt}</p>
                    <CopyPrompt text={c.prompt} label="Copy" />
                  </div>
                  <p className="cap-answer">
                    <span>Real answer</span>
                    {c.answer}
                  </p>
                </li>
              ))}
          </ul>
        </section>
      ))}
      {hiddenCount > 0 && (
        <button type="button" className="cap-more" onClick={() => setExpanded(true)}>
          Show all {CAPABILITIES.length} ({hiddenCount} more)
        </button>
      )}
    </div>
  );
};

export default Capabilities;
