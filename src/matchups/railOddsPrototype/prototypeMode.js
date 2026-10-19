/*
 * PROTOTYPE — throwaway (branch prototype/rail-odds). Sportsbook Over/Under
 * prices in the Matchup player rail, four layouts switchable with `?odds=`.
 * Production builds without REACT_APP_PROTOTYPE=rail-odds never render it.
 */
import { useSearchParams } from 'react-router-dom';

export const PROTO_STANDALONE = process.env.REACT_APP_PROTOTYPE === 'rail-odds';
export const PROTO_ENABLED = process.env.NODE_ENV !== 'production' || PROTO_STANDALONE;

export const VARIANTS = ['A', 'B', 'C', 'D'];
export const VARIANT_NAMES = {
  A: 'Prices under the line',
  B: 'Over / Under buttons',
  C: 'Every book in the row',
  D: 'What the books imply',
};

export const useOddsVariant = () => {
  const [params] = useSearchParams();
  if (!PROTO_ENABLED) return null;
  const v = params.get('odds');
  return VARIANTS.includes(v) ? v : 'A';
};
