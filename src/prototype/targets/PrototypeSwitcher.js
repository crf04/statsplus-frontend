/*
 * PROTOTYPE — throwaway. Deliberately ugly: it must never read as part of the
 * design under evaluation. Never rendered in a production build.
 */
import { useEffect } from 'react';
import { PROTO_ENABLED, VARIANT_NAMES } from './prototypeMode';

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

export default function PrototypeSwitcher({ variant, onStep }) {
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
    </div>
  );
}
