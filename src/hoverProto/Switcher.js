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
    <div className="hv-proto-switcher" role="toolbar" aria-label="Hover card variants">
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
      <span>{VARIANTS[variant]}</span>
    </div>
  );
};

export default Switcher;
