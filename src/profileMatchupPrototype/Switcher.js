/*
 * PROTOTYPE (throwaway). Deliberately not styled like the app.
 */
import { useEffect } from 'react';
import { SAMPLES, VARIANT_KEYS, VARIANT_NAMES, goToPlayer } from './mode';

const typing = () => {
  const el = document.activeElement;
  return el && (['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) || el.isContentEditable);
};

const Switcher = ({ proto, playerName }) => {
  const { variant, step, setVariant } = proto;
  useEffect(() => {
    const onKey = (e) => {
      if (typing()) return;
      if (e.key === 'ArrowLeft') step(-1);
      if (e.key === 'ArrowRight') step(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [step]);
  return (
    <div className="pmp-switcher" role="group" aria-label="Prototype variant switcher">
      {VARIANT_KEYS.map((v) => (
        <button
          key={v}
          type="button"
          aria-pressed={v === variant}
          onClick={() => setVariant(v)}
          title={VARIANT_NAMES[v]}
        >
          {v}
        </button>
      ))}
      <span>{VARIANT_NAMES[variant]}</span>
      <select
        value={playerName}
        onChange={(e) => goToPlayer(e.target.value)}
        aria-label="Sample player"
      >
        {!SAMPLES.some((s) => s.name === playerName) && (
          <option value={playerName}>{playerName}</option>
        )}
        {SAMPLES.map((s) => (
          <option key={s.name} value={s.name}>
            {s.name} vs {s.opponent}
          </option>
        ))}
      </select>
    </div>
  );
};

export default Switcher;
