/*
 * PROTOTYPE — throwaway. Deliberately ugly: it must never read as part of the
 * design under evaluation. Never rendered in a production build.
 */
import { useEffect } from 'react';
import { PROTO_ENABLED, PROTO_STANDALONE, VARIANT_NAMES } from './prototypeMode';

const isTyping = () => {
  const el = document.activeElement;
  if (!el) return false;
  return (
    el.tagName === 'INPUT' ||
    el.tagName === 'TEXTAREA' ||
    el.isContentEditable ||
    el.getAttribute?.('role') === 'textbox'
  );
};

/* Standalone only: swap the captured completed game for its synthetic
   upcoming-game twin. A full navigation, so the page refetches. */
const DemoToggle = () => {
  const params = new URLSearchParams(window.location.search);
  const pregame = params.get('demo') === 'pregame';
  const href = (on) => {
    const next = new URLSearchParams(params);
    if (on) next.set('demo', 'pregame');
    else next.delete('demo');
    return `${window.location.pathname}?${next}`;
  };
  return (
    <span className="proto-demo-toggle">
      <a href={href(false)} aria-current={!pregame ? 'true' : undefined}>
        completed
      </a>
      <a href={href(true)} aria-current={pregame ? 'true' : undefined}>
        upcoming
      </a>
    </span>
  );
};

const PrototypeSwitcher = ({ variant, onStep }) => {
  useEffect(() => {
    const onKeyDown = (event) => {
      if (isTyping()) return;
      if (event.key === 'ArrowLeft') onStep(-1);
      if (event.key === 'ArrowRight') onStep(1);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onStep]);

  if (!PROTO_ENABLED) return null;

  return (
    <div className="proto-switcher" role="group" aria-label="Prototype variant switcher">
      <button type="button" onClick={() => onStep(-1)} aria-label="Previous variant">
        ←
      </button>
      <span className="proto-switcher-label">
        {variant} — {VARIANT_NAMES[variant]}
      </span>
      <button type="button" onClick={() => onStep(1)} aria-label="Next variant">
        →
      </button>
      {PROTO_STANDALONE && <DemoToggle />}
    </div>
  );
};

export default PrototypeSwitcher;
