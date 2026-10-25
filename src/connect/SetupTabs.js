import { useRef, useState } from 'react';

// One tab per chat app, each panel a note and numbered steps (WAI-ARIA tabs pattern).
const SetupTabs = ({ clients, label, idPrefix }) => {
  const [active, setActive] = useState(0);
  const tabRefs = useRef([]);

  // Arrow keys move between tabs and select, as in the WAI-ARIA tabs pattern.
  const onKeyDown = (event) => {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
    if (!step) return;
    event.preventDefault();
    const next = (active + step + clients.length) % clients.length;
    setActive(next);
    tabRefs.current[next]?.focus();
  };

  return (
    <>
      <div className="connect-tablist" role="tablist" aria-label={label}>
        {clients.map((c, index) => (
          <button
            key={c.id}
            ref={(node) => {
              tabRefs.current[index] = node;
            }}
            type="button"
            role="tab"
            id={`${idPrefix}-tab-${c.id}`}
            aria-selected={index === active}
            aria-controls={`${idPrefix}-panel-${c.id}`}
            tabIndex={index === active ? 0 : -1}
            className="connect-tab"
            onClick={() => setActive(index)}
            onKeyDown={onKeyDown}
          >
            {c.name}
          </button>
        ))}
      </div>
      {clients.map((c, index) => (
        <div
          key={c.id}
          className="connect-tabpanel"
          role="tabpanel"
          id={`${idPrefix}-panel-${c.id}`}
          aria-labelledby={`${idPrefix}-tab-${c.id}`}
          hidden={index !== active}
        >
          <p className="connect-note">{c.note}</p>
          <ol className="connect-steps">
            {c.steps.map((step, stepIndex) => (
              <li key={stepIndex}>{step}</li>
            ))}
          </ol>
        </div>
      ))}
    </>
  );
};

export default SetupTabs;
