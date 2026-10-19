/*
 * PROTOTYPE — throwaway. See ./README.md.
 *
 * The variant rides the URL *hash*: on `/` the query string IS the Filter Set,
 * and a parameter the app cannot decode turns the page into a refusal.
 */
import { useEffect, useState } from 'react';

export const VARIANT_KEYS = ['O', 'A', 'B', 'C'];

export const VARIANT_NAMES = {
  O: 'Today (toolbar buttons + panel footer list)',
  A: 'Panel header menu + Save beside Apply',
  B: 'Filters / Saved tabs in the panel',
  C: 'Saved-set rail above the Workspace',
};

const readHash = () =>
  new URLSearchParams(typeof window === 'undefined' ? '' : window.location.hash.replace(/^#/, ''));

// The public no-login build: captured data, a fake signed-in user, always on.
export const PROTO_STANDALONE = process.env.REACT_APP_PROTOTYPE === 'saved-place';

export const isPrototypeActive = () =>
  PROTO_STANDALONE ||
  (process.env.NODE_ENV !== 'production' && readHash().get('proto') === 'place');

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
    hash.set('proto', 'place');
    hash.set('v', key);
    window.location.hash = hash.toString();
  };
  const step = (delta) => {
    const index = VARIANT_KEYS.indexOf(variant);
    goTo(VARIANT_KEYS[(index + delta + VARIANT_KEYS.length) % VARIANT_KEYS.length]);
  };
  return { variant, goTo, step };
};

/** The prototype's variant, or null when the prototype is off. */
export const usePlacement = () => {
  const { variant } = useVariant();
  return isPrototypeActive() ? variant : null;
};
