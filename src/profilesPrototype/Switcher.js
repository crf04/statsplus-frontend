/* PROTOTYPE — throwaway floating variant switcher. */
import { useEffect } from 'react';
import { VARIANTS, VARIANT_NAMES, setVariant } from './mode';

const Switcher = ({ current }) => {
  const step = (d) => {
    const i = VARIANTS.indexOf(current);
    setVariant(VARIANTS[(i + d + VARIANTS.length) % VARIANTS.length]);
  };
  useEffect(() => {
    const onKey = (e) => {
      const t = e.target;
      if (t.closest?.('input, textarea, select, [contenteditable]')) return;
      if (e.key === 'ArrowLeft') step(-1);
      if (e.key === 'ArrowRight') step(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  return (
    <div className="pp-switcher" role="toolbar" aria-label="Prototype variants">
      <button type="button" onClick={() => step(-1)} aria-label="Previous variant">
        ←
      </button>
      <span>
        {current === '0' ? 'Current' : current} ·{' '}
        {current === '0' ? 'today' : VARIANT_NAMES[current]}
      </span>
      <button type="button" onClick={() => step(1)} aria-label="Next variant">
        →
      </button>
    </div>
  );
};

export default Switcher;
