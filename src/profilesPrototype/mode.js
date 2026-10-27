/*
 * PROTOTYPE — throwaway (branch prototype/profiles-simplify). Simpler versions
 * of the Player Profile + Opposing Team Profile pair on the Log Workspace.
 * State rides the hash (#proto=profiles&v=A): the query string is the Filter Set.
 */
import { useEffect, useState } from 'react';

export const VARIANTS = ['0', 'A', 'B', 'C'];
export const VARIANT_NAMES = {
  0: 'Current',
  A: 'One table',
  B: 'Two cards, trimmed',
  C: 'Mix strip + movers',
};

export const PROTO_STANDALONE = process.env.REACT_APP_PROTOTYPE === 'profiles';

const readHash = () =>
  new URLSearchParams(typeof window === 'undefined' ? '' : window.location.hash.replace(/^#/, ''));

export const isPrototypeActive = () =>
  PROTO_STANDALONE ||
  (process.env.NODE_ENV !== 'production' && readHash().get('proto') === 'profiles');

const readVariant = () => {
  const key = (readHash().get('v') || 'A').toUpperCase();
  return VARIANTS.includes(key) ? key : 'A';
};

export const setVariant = (v) => {
  window.history.replaceState(
    null,
    '',
    `${window.location.pathname}${window.location.search}#proto=profiles&v=${v}`,
  );
  window.dispatchEvent(new HashChangeEvent('hashchange'));
};

export const useVariant = () => {
  const [variant, set] = useState(readVariant);
  useEffect(() => {
    const on = () => set(readVariant());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return variant;
};
