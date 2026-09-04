/*
 * PROTOTYPE — throwaway. See ./README.md.
 *
 * Variant rides the query string (`?proto=targets&v=B`). The Targets route is
 * itself a prototype so it only needs `v`; the slate and matchup routes need
 * `proto=targets` too so nothing renders there by default. The `/` route is
 * never touched: its query string is the Filter Set.
 */
import { useLocation, useSearchParams } from 'react-router-dom';

export const VARIANT_KEYS = ['A', 'B', 'C'];

export const VARIANT_NAMES = {
  A: 'Ledger · inline strip · inline form',
  B: 'Board · header ribbon · modal',
  C: 'Game-first · row sub-lines · builder drawer',
};

// Offseason slates are empty; this date has 15 completed games with full
// historical pools, so live Targets have something to resolve against.
export const DEMO_DATE = '2026-04-10';

export const PAGE_PATH = '/prototype/targets';

export const useVariant = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { pathname } = useLocation();
  const onPage = pathname.startsWith(PAGE_PATH);
  const active =
    process.env.NODE_ENV !== 'production' && (onPage || searchParams.get('proto') === 'targets');
  const key = (searchParams.get('v') || 'A').toUpperCase();
  const variant = VARIANT_KEYS.includes(key) ? key : 'A';
  const step = (delta) => {
    const index = VARIANT_KEYS.indexOf(variant);
    const next = new URLSearchParams(searchParams);
    if (!onPage) next.set('proto', 'targets');
    next.set('v', VARIANT_KEYS[(index + delta + VARIANT_KEYS.length) % VARIANT_KEYS.length]);
    setSearchParams(next, { replace: true });
  };
  return { active, variant, step, onPage };
};

/* Query string that keeps the prototype alive across a navigation. */
export const protoQuery = (variant, extra = {}, { page = false } = {}) => {
  const params = new URLSearchParams();
  if (!page) params.set('proto', 'targets');
  params.set('v', variant);
  Object.entries(extra).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') params.set(key, value);
  });
  return params.toString();
};
