/*
 * PROTOTYPE — throwaway. Deliberately not styled like the app.
 */
import { useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PROTO_ENABLED, VARIANTS, VARIANT_NAMES, useOddsVariant } from './prototypeMode';
import { DEMO_GAMES } from './mock/install';

const isTyping = () => {
  const el = document.activeElement;
  return Boolean(
    el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable),
  );
};

export default function PrototypeSwitcher({ gameId }) {
  const variant = useOddsVariant();
  const [params, setParams] = useSearchParams();
  const step = useCallback(
    (delta) => {
      const i = VARIANTS.indexOf(variant);
      const next = new URLSearchParams(params);
      next.set('odds', VARIANTS[(i + delta + VARIANTS.length) % VARIANTS.length]);
      setParams(next, { replace: true });
    },
    [variant, params, setParams],
  );
  useEffect(() => {
    const onKeyDown = (event) => {
      if (isTyping()) return;
      if (event.key === 'ArrowLeft') step(-1);
      if (event.key === 'ArrowRight') step(1);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [step]);
  if (!PROTO_ENABLED) return null;
  return (
    <div className="ro-switcher" role="group" aria-label="Prototype variant switcher">
      <button type="button" onClick={() => step(-1)} aria-label="Previous variant">
        ←
      </button>
      <span>
        {variant} — {VARIANT_NAMES[variant]}
      </span>
      <button type="button" onClick={() => step(1)} aria-label="Next variant">
        →
      </button>
      <select
        aria-label="Game"
        value={gameId}
        onChange={(event) => {
          window.location.href = `/matchups/${event.target.value}?odds=${variant}`;
        }}
      >
        {DEMO_GAMES.map(([id, label]) => (
          <option key={id} value={id}>
            {label}
          </option>
        ))}
      </select>
    </div>
  );
}
