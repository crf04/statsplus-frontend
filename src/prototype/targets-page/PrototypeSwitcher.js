/*
 * PROTOTYPE — throwaway. Deliberately foreign to the house style: it must never
 * read as part of the design under evaluation. Never rendered in production.
 */
import { useEffect } from 'react';
import { PROTO_ENABLED, VARIANT_NAMES } from './prototypeMode';
import { CRITERIA_STYLES, useCriteriaStyle } from './shared';

const isTyping = () => {
  const el = document.activeElement;
  if (!el) return false;
  return (
    el.tagName === 'INPUT' ||
    el.tagName === 'TEXTAREA' ||
    el.tagName === 'SELECT' ||
    el.isContentEditable ||
    el.getAttribute?.('role') === 'textbox'
  );
};

export default function PrototypeSwitcher({
  variant,
  names = VARIANT_NAMES,
  date,
  onStep,
  onDate,
}) {
  useEffect(() => {
    const onKeyDown = (event) => {
      if (isTyping()) return;
      if (event.key === 'ArrowLeft') onStep(-1);
      if (event.key === 'ArrowRight') onStep(1);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onStep]);
  const criteria = useCriteriaStyle();
  if (!PROTO_ENABLED) return null;
  return (
    <div className="proto-switcher" role="group" aria-label="Prototype variant switcher">
      <button type="button" onClick={() => onStep(-1)} aria-label="Previous variant">
        ←
      </button>
      <span className="proto-switcher-label">
        {variant} — {names[variant]}
      </span>
      <button type="button" onClick={() => onStep(1)} aria-label="Next variant">
        →
      </button>
      <span className="proto-switcher-q" role="group" aria-label="Criteria drawing">
        {Object.entries(CRITERIA_STYLES).map(([key, name]) => (
          <button
            type="button"
            key={key}
            className={criteria.style === key ? 'is-on' : ''}
            aria-pressed={criteria.style === key}
            onClick={() => criteria.setStyle(key)}
            title={`Criteria: ${name}`}
          >
            {key}
          </button>
        ))}
      </span>
      {onDate && (
        <input
          type="date"
          aria-label="Slate date to resolve against"
          value={date || ''}
          onChange={(event) => onDate(event.target.value)}
        />
      )}
    </div>
  );
}
