/*
 * PROTOTYPE — throwaway. See ./README.md.
 *
 * Variant rides the query string (`?proto=targets&v=B`). The Targets route is
 * itself a prototype so it only needs `v`; the slate and matchup routes need
 * `proto=targets` too so nothing renders there by default. The `/` route is
 * never touched: its query string is the Filter Set.
 */
import { useLocation, useSearchParams } from 'react-router-dom';

/* Dev builds always; a deployed preview only when built with
   REACT_APP_PROTOTYPE=targets. A stray merge cannot ship it. */
export const PROTO_ENABLED =
  process.env.NODE_ENV !== 'production' || process.env.REACT_APP_PROTOTYPE === 'targets';

/* A deployed prototype build is the Targets page and nothing else: `/` lands
   on it and the nav only offers it. */
export const PROTO_STANDALONE = process.env.REACT_APP_PROTOTYPE === 'targets';

export const VARIANT_KEYS = ['A', 'B', 'C'];

export const VARIANT_NAMES = {
  A: 'Targets: card expands in place',
  B: 'Targets: card opens its own page',
  C: 'Targets: card opens a side drawer',
};

export const SLATE_PATH = '/prototype/matchups';

// Offseason slates are empty; this date has 15 completed games with full
// historical pools, so live Targets have something to resolve against.
export const DEMO_DATE = '2026-04-10';

export const PAGE_PATH = '/prototype/targets';

export const useVariant = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { pathname } = useLocation();
  const onPage = pathname.startsWith(PAGE_PATH);
  const active = PROTO_ENABLED && (onPage || searchParams.get('proto') === 'targets');
  const key = (searchParams.get('v') || 'B').toUpperCase();
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
