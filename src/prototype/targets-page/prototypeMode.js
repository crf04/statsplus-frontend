/*
 * PROTOTYPE — throwaway. See ./README.md.
 *
 * Three looks for the Targets page, on the real `/targets` route. The variant
 * rides the query string (`?proto=targets&v=A&date=2026-04-10`): this route
 * reads nothing from its query, so it is free to carry the prototype. (The `/`
 * route is the one whose query string is a Filter Set.)
 */
import { useSearchParams } from 'react-router-dom';

/* Dev builds always; a deployed preview only when built with
   REACT_APP_PROTOTYPE=targets-page. A stray merge cannot ship it. */
export const PROTO_ENABLED =
  process.env.NODE_ENV !== 'production' || process.env.REACT_APP_PROTOTYPE === 'targets-page';

/* A deployed prototype build is the Targets page and nothing else: no
   sign-in, captured production payloads, links inert. */
export const PROTO_STANDALONE = process.env.REACT_APP_PROTOTYPE === 'targets-page';

/* The captured day: MIA, NOP and BOS all played, so every seed Target is live. */
export const DEMO_DATE = '2026-04-10';

export const VARIANT_KEYS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

export const VARIANT_NAMES = {
  A: 'Ledger — rows that open in place, compose row at the foot',
  B: 'Desk — rail of Targets, one read in full',
  C: 'Board — today first, a Target written as a sentence',
  D: 'Record — hit rate and every game, a ledger of the season',
  E: 'Season — one timeline, a lane per Target, receipts under it',
  F: 'Report — a verdict, a margin distribution, who cashed',
  G: 'Sheet — criteria as sections, the Lab beneath each',
  H: 'Bench — criteria as a sentence, one on the bench at a time',
};

/* One Target's own page: the edit screen. Keyed by `dv` so the list's `v`
   survives the round trip. */
export const DETAIL_KEYS = ['I', 'J', 'K'];

export const DETAIL_NAMES = {
  I: 'Worksheet — criteria, actions, then the Lab in full, one column',
  J: 'Workbench — sentence and grid pinned left, games on the right',
  K: 'Players — criteria on top, evidence grouped by player',
};

export const useDetailPrototype = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const active = PROTO_ENABLED && (PROTO_STANDALONE || searchParams.get('proto') === 'targets');
  const key = (searchParams.get('dv') || 'I').toUpperCase();
  const variant = DETAIL_KEYS.includes(key) ? key : 'I';
  const date = PROTO_STANDALONE ? DEMO_DATE : searchParams.get('date') || undefined;
  const update = (patch) => {
    const next = new URLSearchParams(searchParams);
    next.set('proto', 'targets');
    Object.entries(patch).forEach(([name, value]) => {
      if (value) next.set(name, value);
      else next.delete(name);
    });
    setSearchParams(next, { replace: true });
  };
  const step = (delta) => {
    const index = DETAIL_KEYS.indexOf(variant);
    update({ dv: DETAIL_KEYS[(index + delta + DETAIL_KEYS.length) % DETAIL_KEYS.length] });
  };
  const setDate = (value) => update({ date: value });
  const back = new URLSearchParams();
  back.set('proto', 'targets');
  if (searchParams.get('v')) back.set('v', searchParams.get('v'));
  if (searchParams.get('date')) back.set('date', searchParams.get('date'));
  return { active, variant, date, step, setDate, listPath: `/targets?${back.toString()}` };
};

export const useTargetsPrototype = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const active = PROTO_ENABLED && (PROTO_STANDALONE || searchParams.get('proto') === 'targets');
  const key = (searchParams.get('v') || 'A').toUpperCase();
  const variant = VARIANT_KEYS.includes(key) ? key : 'A';
  const date = PROTO_STANDALONE ? DEMO_DATE : searchParams.get('date') || undefined;
  const update = (patch) => {
    const next = new URLSearchParams(searchParams);
    next.set('proto', 'targets');
    Object.entries(patch).forEach(([name, value]) => {
      if (value) next.set(name, value);
      else next.delete(name);
    });
    setSearchParams(next, { replace: true });
  };
  const step = (delta) => {
    const index = VARIANT_KEYS.indexOf(variant);
    update({ v: VARIANT_KEYS[(index + delta + VARIANT_KEYS.length) % VARIANT_KEYS.length] });
  };
  const setDate = (value) => update({ date: value });
  return { active, variant, date, step, setDate };
};
