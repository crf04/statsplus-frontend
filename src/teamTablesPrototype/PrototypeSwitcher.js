/*
 * PROTOTYPE — throwaway. Deliberately not styled like the app: it must never
 * read as part of the design under evaluation.
 */
import { useEffect } from 'react';
import { VARIANT_NAMES } from './prototypeMode';
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

const PrototypeSwitcher = ({ proto }) => {
  const { variant, step } = proto;
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
    <div className="ttp-switcher" role="group" aria-label="Prototype variant switcher">
      <button type="button" onClick={() => step(-1)} aria-label="Previous variant">
        ←
      </button>
      <span className="ttp-switcher-label">
        {variant} — {VARIANT_NAMES[variant]}
      </span>
      <button type="button" onClick={() => step(1)} aria-label="Next variant">
        →
      </button>
    </div>
  );
};

export default PrototypeSwitcher;
