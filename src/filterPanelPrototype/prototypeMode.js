/*
 * PROTOTYPE — throwaway. See ./README.md.
 *
 * The variant rides the URL hash (`#proto=filters&v=B`), never the query
 * string: on `/` the query string is the Filter Set, and an unknown parameter
 * there turns the page into a refused-link screen.
 */
import { useCallback, useEffect, useState } from 'react';

/* Dev servers always allow the prototype; a production build only with
   REACT_APP_PROTOTYPE=filters. A stray merge cannot ship it. */
export const PROTO_STANDALONE = process.env.REACT_APP_PROTOTYPE === 'filters';
export const PROTO_ENABLED = process.env.NODE_ENV !== 'production' || PROTO_STANDALONE;

export const VARIANT_KEYS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'Now'];

export const VARIANT_NAMES = {
  A: 'Grouped sheet, everything visible',
  B: 'Filter Set as sentence + add menu',
  C: 'Summary rows that open in place',
  D: 'B, filling the chart card height',
  E: 'C, filling the chart card height',
  F: 'Filter bar above a full-width chart',
  G: 'D + match strip + saved Filter Sets',
  H: 'E + match strip + next opponent',
  Now: 'Current panel (for comparison)',
};

/* Applying filters navigates to a new query string and drops the hash, so
   the choice is also kept for the tab's session. */
const STORE = 'proto:filters';
const readHash = () => {
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  if (hash.get('proto')) return hash;
  return new URLSearchParams(window.sessionStorage.getItem(STORE) || '');
};

export const useVariant = () => {
  const [hash, setHash] = useState(() => readHash());
  useEffect(() => {
    if (hash.get('proto')) window.sessionStorage.setItem(STORE, String(hash));
  }, [hash]);
  useEffect(() => {
    const onHashChange = () => setHash(readHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);
  const active = PROTO_ENABLED && (PROTO_STANDALONE || hash.get('proto') === 'filters');
  const key = hash.get('v') || 'A';
  const variant = VARIANT_KEYS.includes(key) ? key : 'A';
  const step = useCallback(
    (delta) => {
      const index = VARIANT_KEYS.indexOf(variant);
      const next = readHash();
      next.set('proto', 'filters');
      next.set('v', VARIANT_KEYS[(index + delta + VARIANT_KEYS.length) % VARIANT_KEYS.length]);
      window.history.replaceState(window.history.state, '', `#${next}`);
      window.sessionStorage.setItem(STORE, String(next));
      setHash(next);
      // Other hook instances (the page layout reads it for F) follow along.
      window.dispatchEvent(new Event('hashchange'));
    },
    [variant],
  );
  return { active, variant, step };
};
