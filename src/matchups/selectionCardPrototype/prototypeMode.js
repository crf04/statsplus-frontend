/*
 * PROTOTYPE — throwaway. See ./README.md.
 *
 * Variant rides the matchup page's query string (`?proto=card&v=B`). This
 * route only reads `player` from the query and copies the rest through when
 * the selection changes, so the prototype survives opening a card.
 */
import { useSearchParams } from 'react-router-dom';

/* Dev servers always allow the prototype; a production build only with
   REACT_APP_PROTOTYPE=card. A stray merge cannot ship it. */
export const PROTO_ENABLED =
  process.env.NODE_ENV !== 'production' || process.env.REACT_APP_PROTOTYPE === 'card';
/* The standalone build is the prototype and nothing else: captured data, no
   sign-in, the matchup page is the whole app. */
export const PROTO_STANDALONE = process.env.REACT_APP_PROTOTYPE === 'card';

export const VARIANT_KEYS = ['A', 'B', 'C'];

export const VARIANT_NAMES = {
  A: 'Matrix beside the opponent log',
  B: 'Active stat strip, matrix folded',
  C: 'Opponent log as one line',
};

export const useVariant = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const active = PROTO_ENABLED && (PROTO_STANDALONE || searchParams.get('proto') === 'card');
  const key = (searchParams.get('v') || 'A').toUpperCase();
  const variant = VARIANT_KEYS.includes(key) ? key : 'A';
  const step = (delta) => {
    const index = VARIANT_KEYS.indexOf(variant);
    const next = new URLSearchParams(searchParams);
    next.set('proto', 'card');
    next.set('v', VARIANT_KEYS[(index + delta + VARIANT_KEYS.length) % VARIANT_KEYS.length]);
    setSearchParams(next, { replace: true });
  };
  return { active, variant, step };
};
