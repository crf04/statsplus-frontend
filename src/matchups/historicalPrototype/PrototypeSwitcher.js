/*
 * PROTOTYPE — throwaway. Deliberately not styled like the app.
 */
import { useEffect } from 'react';
import { VARIANT_NAMES } from './prototypeMode';
import { DEMOS, demoMode } from './demo';

const isTyping = () => {
  const el = document.activeElement;
  return Boolean(
    el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable),
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
  return (
    <div className="proto-switcher" role="group" aria-label="Prototype variant switcher">
      <button type="button" onClick={() => onStep(-1)} aria-label="Previous variant">
        ←
      </button>
      <span>
        {variant} — {VARIANT_NAMES[variant]}
      </span>
      <button type="button" onClick={() => onStep(1)} aria-label="Next variant">
        →
      </button>
      {/* A full navigation, so the page refetches the other captured game. */}
      <select
        aria-label="Game state"
        value={demoMode()}
        onChange={(event) => {
          const next = new URLSearchParams(window.location.search);
          next.delete('player');
          if (event.target.value) next.set('demo', event.target.value);
          else next.delete('demo');
          window.location.search = next.toString();
        }}
      >
        {DEMOS.map(([key, label]) => (
          <option key={key} value={key}>
            {label}
          </option>
        ))}
      </select>
    </div>
  );
}
