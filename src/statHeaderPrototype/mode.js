/*
 * PROTOTYPE — throwaway. See ./README.md.
 *
 * The variant rides the URL *hash*: on `/` the query string IS the Filter Set,
 * and a parameter the app cannot decode turns the page into a refusal.
 */
import { useEffect, useState } from 'react';

export const VARIANTS = {
  O: 'Today: avatar + 2×4 big tiles',
  A: 'Compact tiles: one row of 8',
  B: 'Ribbon: one line of stats',
  C: 'Box-score line',
  D: 'Lead four + chips',
};
export const VARIANT_KEYS = Object.keys(VARIANTS);

const readHash = () =>
  new URLSearchParams(typeof window === 'undefined' ? '' : window.location.hash.replace(/^#/, ''));

// The public no-login build: captured data, a fake signed-in user, always on.
export const PROTO_STANDALONE = process.env.REACT_APP_PROTOTYPE === 'stat-header';

export const isPrototypeActive = () =>
  PROTO_STANDALONE ||
  (process.env.NODE_ENV !== 'production' && readHash().get('proto') === 'stats');

const readVariant = () => {
  const key = (readHash().get('v') || 'O').toUpperCase();
  return VARIANT_KEYS.includes(key) ? key : 'O';
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
    hash.set('proto', 'stats');
    hash.set('v', key);
    window.location.hash = hash.toString();
  };
  const step = (delta) => {
    const index = VARIANT_KEYS.indexOf(variant);
    goTo(VARIANT_KEYS[(index + delta + VARIANT_KEYS.length) % VARIANT_KEYS.length]);
  };
  return { variant, goTo, step };
};
