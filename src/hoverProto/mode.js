/*
 * PROTOTYPE — throwaway. See ./README.md.
 *
 * Prototype state rides the URL *hash* (`#proto=hover&v=A`): on `/` the query
 * string IS the Filter Set, and a parameter the app cannot decode turns the
 * page into a refusal. React Router drops the hash when it rewrites the query,
 * so the state lives in a module store and is written back to the hash.
 */
import { useEffect, useSyncExternalStore } from 'react';

export const VARIANTS = {
  O: 'O · today',
  A: 'A · sectioned text tooltip',
  B: 'B · mini card',
  C: 'C · this game vs his average',
  D: 'D · game strip under the chart',
};
export const VARIANT_KEYS = Object.keys(VARIANTS);
const DEFAULT = 'A';

// The public no-login build: captured data, a fake signed-in user, always on.
export const PROTO_STANDALONE = process.env.REACT_APP_PROTOTYPE === 'hover';

const readHash = () =>
  new URLSearchParams(typeof window === 'undefined' ? '' : window.location.hash.replace(/^#/, ''));

export const isPrototypeActive = () =>
  PROTO_STANDALONE ||
  (process.env.NODE_ENV !== 'production' && readHash().get('proto') === 'hover');

const fromHash = () => {
  const v = (readHash().get('v') || DEFAULT).toUpperCase();
  return { variant: VARIANT_KEYS.includes(v) ? v : DEFAULT };
};

let state = fromHash();
const listeners = new Set();
const writeHash = () => {
  const hash = readHash();
  hash.set('proto', 'hover');
  hash.set('v', state.variant);
  const next = `#${hash}`;
  if (window.location.hash !== next)
    window.history.replaceState(
      window.history.state,
      '',
      `${window.location.pathname}${window.location.search}${next}`,
    );
};
const set = (patch) => {
  state = { ...state, ...patch };
  writeHash();
  listeners.forEach((listener) => listener());
};
if (typeof window !== 'undefined')
  window.addEventListener('hashchange', () => {
    state = fromHash();
    listeners.forEach((listener) => listener());
  });

const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** `search` is the current query string, so the hash is restored after each navigation. */
export const useHoverProto = (search) => {
  const active = isPrototypeActive();
  const current = useSyncExternalStore(subscribe, () => state);
  useEffect(() => {
    if (active) writeHash();
  }, [active, search]);
  const step = (delta) => {
    const index = VARIANT_KEYS.indexOf(current.variant);
    set({ variant: VARIANT_KEYS[(index + delta + VARIANT_KEYS.length) % VARIANT_KEYS.length] });
  };
  return {
    active,
    variant: active ? current.variant : null,
    goTo: (variant) => set({ variant }),
    step,
  };
};
