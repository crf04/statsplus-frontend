/*
 * PROTOTYPE — throwaway. See ./README.md.
 *
 * The variant rides the URL hash (`#proto=home&v=B`), never the query string:
 * on `/` the query string is the Filter Set, and an unknown parameter there
 * turns the page into a refused-link screen.
 */
import { useCallback, useEffect, useState } from 'react';

/* Dev servers always allow the prototype; a production build only with
   REACT_APP_PROTOTYPE=home. A stray merge cannot ship it. */
export const PROTO_STANDALONE = process.env.REACT_APP_PROTOTYPE === 'home';
export const PROTO_ENABLED = process.env.NODE_ENV !== 'production' || PROTO_STANDALONE;

export const VARIANT_KEYS = ['H', 'F', 'G', 'E', 'A', 'B', 'C', 'D', 'Now'];

export const VARIANT_NAMES = {
  H: 'Ticker + spotlight + answer ladder',
  F: 'Ticker + spotlight',
  G: 'Ticker + answer ladder',
  E: 'Ticker: 3 biggest PTS effects',
  A: 'Targets sidebar + slate strip',
  B: 'Tonight board under the search',
  C: 'Scoreboard ticker + Target pills',
  D: 'Game of the night',
  Now: 'Current home (for comparison)',
};

/* The captured slate. Today (2026-10-14) is preseason with an empty slate. */
export const DEMO_DATE = '2026-04-10';

const readHash = () => new URLSearchParams(window.location.hash.replace(/^#/, ''));

export const useVariant = () => {
  const [hash, setHash] = useState(readHash);
  useEffect(() => {
    const onHashChange = () => setHash(readHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);
  const active = PROTO_ENABLED && (PROTO_STANDALONE || hash.get('proto') === 'home');
  const key = hash.get('v') || 'H';
  const variant = VARIANT_KEYS.includes(key) ? key : 'H';
  const step = useCallback(
    (delta) => {
      const index = VARIANT_KEYS.indexOf(variant);
      const next = readHash();
      next.set('proto', 'home');
      next.set('v', VARIANT_KEYS[(index + delta + VARIANT_KEYS.length) % VARIANT_KEYS.length]);
      window.history.replaceState(window.history.state, '', `#${next}`);
      setHash(next);
    },
    [variant],
  );
  return { active, variant, step };
};
