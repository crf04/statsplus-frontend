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

export const VARIANT_KEYS = ['A', 'B', 'C', 'D', 'E'];

export const VARIANT_NAMES = {
  A: 'Matrix beside the opponent log',
  B: 'Active stat strip, matrix folded',
  C: 'Opponent log as one line',
  D: 'A, ledger: signed ink, hero average',
  E: 'A, panels: heat cells, two surfaces',
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

/* Box-score order instead of the API's alphabetical one. Anything the list
   does not name keeps its API position after the named ones. */
export const CATEGORY_ORDER = [
  'PTS',
  'REB',
  'AST',
  '3PM',
  'STL',
  'BLK',
  'TOV',
  'FGA',
  'FG2A',
  'FG3A',
  'PR',
  'PA',
  'RA',
  'PRA',
  'STKS',
];
export const orderCategories = (categories) =>
  [...categories].sort((a, b) => {
    const ia = CATEGORY_ORDER.indexOf(a);
    const ib = CATEGORY_ORDER.indexOf(b);
    return (ia === -1 ? CATEGORY_ORDER.length : ia) - (ib === -1 ? CATEGORY_ORDER.length : ib);
  });
