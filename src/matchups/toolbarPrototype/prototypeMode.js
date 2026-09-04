/*
 * PROTOTYPE — throwaway. See ./README.md.
 *
 * Variant rides the matchup page's query string (`?proto=toolbar&v=B`). This
 * route only reads `player` from the query and copies the rest through when
 * the selection changes, so the prototype survives a selection.
 */
import { useSearchParams } from 'react-router-dom';

export const VARIANT_KEYS = ['A', 'B', 'C', 'D'];

export const VARIANT_NAMES = {
  A: 'Side tabs',
  B: 'Header switch',
  C: 'Sidebar control panel',
  D: 'Side tabs + tab strip',
};

export const useVariant = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const active = process.env.NODE_ENV !== 'production' && searchParams.get('proto') === 'toolbar';
  const key = (searchParams.get('v') || 'A').toUpperCase();
  const variant = VARIANT_KEYS.includes(key) ? key : 'A';
  const step = (delta) => {
    const index = VARIANT_KEYS.indexOf(variant);
    const next = new URLSearchParams(searchParams);
    next.set('proto', 'toolbar');
    next.set('v', VARIANT_KEYS[(index + delta + VARIANT_KEYS.length) % VARIANT_KEYS.length]);
    setSearchParams(next, { replace: true });
  };
  return { active, variant, step };
};
