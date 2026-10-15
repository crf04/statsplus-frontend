/*
 * PROTOTYPE — throwaway (branch prototype/historical-matchup-declutter).
 *
 * Variant rides the matchup page's query string (`?v=B`). The route only reads
 * `player` and copies the rest through when the selection changes, so the
 * variant survives opening a selection card.
 */
import { useSearchParams } from 'react-router-dom';

/* Dev servers always allow it; a production build only with
   REACT_APP_PROTOTYPE=historical. A stray merge cannot ship it. */
export const PROTO_STANDALONE = process.env.REACT_APP_PROTOTYPE === 'historical';
export const PROTO_ENABLED = process.env.NODE_ENV !== 'production' || PROTO_STANDALONE;

export const VARIANT_KEYS = ['O', 'A', 'B', 'C', 'C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8'];
export const VARIANT_NAMES = {
  O: 'Current page (baseline)',
  A: 'Stat grid cards · status chips',
  B: 'Box-score table · "About this data"',
  C: 'One stat, vs his average · one-line note',
  C1: 'C + sheet: plain rows',
  C2: 'C + sheet: merged slices',
  C3: 'C + sheet: bars around league average',
  C4: 'C + sheet: cards, readable',
  C5: 'C + sheet: cards, one per slice',
  C6: 'C + sheet: slices, no possessions',
  C7: 'C + sheet: slice rows, number tiles',
  C8: 'C + sheet: refined, softest first',
};

export const useVariant = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const raw = searchParams.get('v');
  const key = (raw || '').toUpperCase();
  const variant = VARIANT_KEYS.includes(key) ? key : 'O';
  const active = PROTO_ENABLED && (PROTO_STANDALONE || raw !== null) && variant !== 'O';
  const step = (delta) => {
    const index = VARIANT_KEYS.indexOf(variant);
    const next = new URLSearchParams(searchParams);
    next.set('v', VARIANT_KEYS[(index + delta + VARIANT_KEYS.length) % VARIANT_KEYS.length]);
    setSearchParams(next, { replace: true });
  };
  return { active, variant, step, show: PROTO_ENABLED && (PROTO_STANDALONE || raw !== null) };
};
