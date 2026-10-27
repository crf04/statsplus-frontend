/*
 * PROTOTYPE — throwaway. See ./README.md.
 *
 * The variant rides the URL *hash*: on `/` the query string IS the Filter Set,
 * and a parameter the app cannot decode turns the page into a refusal.
 */
import { useEffect, useState } from 'react';

export const VARIANTS = {
  O: 'Today',
  A: 'Compact: small controls, one stat strip, shorter chart',
  B: 'Sentence: "Player PTS over 28.7", hit rate headline',
  C: 'Chart-first: one toolbar, numbers on the chart',
  D: "A top + today's cards, a bit smaller; filters centred",
};
export const VARIANT_KEYS = Object.keys(VARIANTS);

const readHash = () =>
  new URLSearchParams(typeof window === 'undefined' ? '' : window.location.hash.replace(/^#/, ''));

// The public no-login build: captured data, a fake signed-in user, always on.
export const PROTO_STANDALONE = process.env.REACT_APP_PROTOTYPE === 'log-shrink';

export const isPrototypeActive = () =>
  PROTO_STANDALONE ||
  (process.env.NODE_ENV !== 'production' && readHash().get('proto') === 'shrink');

const readVariant = () => {
  if (!isPrototypeActive()) return 'O';
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
    hash.set('proto', 'shrink');
    hash.set('v', key);
    window.location.hash = hash.toString();
  };
  const step = (delta) => {
    const index = VARIANT_KEYS.indexOf(variant);
    goTo(VARIANT_KEYS[(index + delta + VARIANT_KEYS.length) % VARIANT_KEYS.length]);
  };
  return { variant, goTo, step };
};
