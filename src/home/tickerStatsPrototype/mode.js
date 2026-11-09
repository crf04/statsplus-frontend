/*
 * PROTOTYPE — throwaway (branch prototype/ticker-all-stats). See ./README.md.
 *
 * The variant rides the URL hash (#proto=ticker&v=A): on `/` the query string
 * is the Filter Set, and a parameter it cannot decode refuses the page.
 */
import { useEffect, useState } from 'react';

export const VARIANTS = {
  A: 'Stat switch · top 5 for the picked stat',
  B: 'Top 5 across every stat',
  C: 'One row per stat · biggest mover',
};
export const VARIANT_KEYS = Object.keys(VARIANTS);

const readHash = () =>
  new URLSearchParams(typeof window === 'undefined' ? '' : window.location.hash.replace(/^#/, ''));

// The public no-login build: captured data, always on.
export const PROTO_STANDALONE = process.env.REACT_APP_PROTOTYPE === 'ticker';

export const isPrototypeActive = () =>
  PROTO_STANDALONE ||
  (process.env.NODE_ENV !== 'production' && readHash().get('proto') === 'ticker');

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
    hash.set('proto', 'ticker');
    hash.set('v', key);
    window.location.hash = hash.toString();
  };
  const step = (delta) => {
    const index = VARIANT_KEYS.indexOf(variant);
    goTo(VARIANT_KEYS[(index + delta + VARIANT_KEYS.length) % VARIANT_KEYS.length]);
  };
  return { variant, goTo, step };
};
