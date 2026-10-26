/* PROTOTYPE — throwaway. Floating variant bar; ← / → step through variants. */
import { useEffect } from 'react';
import { VARIANTS, VARIANT_KEYS } from './mode';
import './proto.css';

const Switcher = ({ variant, goTo, step }) => {
  useEffect(() => {
    const onKey = (event) => {
      if (event.target.closest?.('input, textarea, select, [contenteditable]')) return;
      if (event.key === 'ArrowLeft') step(-1);
      if (event.key === 'ArrowRight') step(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [step]);
  return (
    <div className="sh-proto-switcher" role="toolbar" aria-label="Stat header variants">
      <button type="button" aria-label="Previous variant" onClick={() => step(-1)}>
        ‹
      </button>
      {VARIANT_KEYS.map((key) => (
        <button
          key={key}
          type="button"
          aria-pressed={key === variant}
          className={key === variant ? 'is-on' : ''}
          onClick={() => goTo(key)}
        >
          {key}
        </button>
      ))}
      <button type="button" aria-label="Next variant" onClick={() => step(1)}>
        ›
      </button>
      <span>{VARIANTS[variant]}</span>
    </div>
  );
};

export default Switcher;
