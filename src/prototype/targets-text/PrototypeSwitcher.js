/*
 * PROTOTYPE — throwaway. Deliberately not styled like the app: it must never
 * read as part of the design under evaluation.
 */
import { useEffect } from 'react';
import { PROTO_ENABLED, VARIANT_NAMES, useVariant } from './prototypeMode';
import './variants.css';
import './prototype.css';

const isTyping = () => {
  const el = document.activeElement;
  if (!el) return false;
  return (
    el.tagName === 'INPUT' ||
    el.tagName === 'TEXTAREA' ||
    el.tagName === 'SELECT' ||
    el.isContentEditable ||
    el.getAttribute?.('role') === 'slider'
  );
};

const Switcher = () => {
  const [variant, step] = useVariant();

  useEffect(() => {
    const onKeyDown = (event) => {
      if (isTyping()) return;
      if (event.key === 'ArrowLeft') step(-1);
      if (event.key === 'ArrowRight') step(1);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [step]);

  return (
    <div className="proto-switcher" role="group" aria-label="Prototype variant switcher">
      <button type="button" onClick={() => step(-1)} aria-label="Previous variant">
        ←
      </button>
      <span className="proto-switcher-label">
        {variant} — {VARIANT_NAMES[variant]}
      </span>
      <button type="button" onClick={() => step(1)} aria-label="Next variant">
        →
      </button>
    </div>
  );
};

const PrototypeSwitcher = () => (PROTO_ENABLED ? <Switcher /> : null);

export default PrototypeSwitcher;
