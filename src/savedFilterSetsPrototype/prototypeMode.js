/*
 * PROTOTYPE — throwaway. See ./README.md.
 *
 * The variant lives in the URL *hash*, not the query string. On `/` the query
 * string IS the Filter Set, and a parameter the app cannot decode is a link it
 * refuses — so `?variant=B` would blank the page underneath the modal. The
 * hash is invisible to filterSetFromSearchParams, so it can carry prototype
 * state over a working page.
 */
import { useEffect, useState } from 'react';

export const VARIANT_KEYS = ['A', 'B', 'C'];

export const VARIANT_NAMES = {
  A: 'Roster rows',
  B: 'Grouped by player',
  C: 'Drawer + preview',
};

const readHash = () =>
  new URLSearchParams(typeof window === 'undefined' ? '' : window.location.hash.replace(/^#/, ''));

/** Prototype mode is on for the whole page load; the switcher only moves `v`. */
export const isPrototypeActive = () =>
  process.env.NODE_ENV !== 'production' && readHash().get('proto') === 'saved';

const readVariant = () => {
  const key = (readHash().get('v') || 'A').toUpperCase();
  return VARIANT_KEYS.includes(key) ? key : 'A';
};

export const useVariant = () => {
  const [variant, setVariant] = useState(readVariant);

  useEffect(() => {
    const onHashChange = () => setVariant(readVariant());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const goTo = (key) => {
    const hash = readHash();
    hash.set('proto', 'saved');
    hash.set('v', key);
    window.location.hash = hash.toString();
  };

  const step = (delta) => {
    const index = VARIANT_KEYS.indexOf(variant);
    goTo(VARIANT_KEYS[(index + delta + VARIANT_KEYS.length) % VARIANT_KEYS.length]);
  };

  return { variant, goTo, step };
};
