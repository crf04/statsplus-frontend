/*
 * PROTOTYPE — throwaway. See ./README.md.
 *
 * The variant rides the URL hash (`#proto=header&v=B`), never the query
 * string: on `/` the query string is the Filter Set, and an unknown parameter
 * there turns the page into a refused-link screen.
 */
import { useCallback, useEffect, useState } from 'react';

/* Dev servers always allow the prototype; a production build only with
   REACT_APP_PROTOTYPE=header. A stray merge cannot ship it. */
export const PROTO_STANDALONE = process.env.REACT_APP_PROTOTYPE === 'header';
export const PROTO_ENABLED = process.env.NODE_ENV !== 'production' || PROTO_STANDALONE;

export const VARIANT_KEYS = ['A', 'B', 'C', 'D', 'Now'];

export const VARIANT_NAMES = {
  A: 'Pill track',
  B: 'Tab rail + search trigger',
  C: 'Broadcast: slate strip over a scoreboard bar',
  D: 'Floating dock (bottom tabs on phone)',
  Now: 'Current header (for comparison)',
};

const readHash = () => new URLSearchParams(window.location.hash.replace(/^#/, ''));

export const useVariant = () => {
  const [hash, setHash] = useState(readHash);
  useEffect(() => {
    const onHashChange = () => setHash(readHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);
  const active = PROTO_ENABLED && (PROTO_STANDALONE || hash.get('proto') === 'header');
  const key = hash.get('v') || 'A';
  const variant = VARIANT_KEYS.includes(key) ? key : 'A';
  const step = useCallback(
    (delta) => {
      const index = VARIANT_KEYS.indexOf(variant);
      const next = readHash();
      next.set('proto', 'header');
      next.set('v', VARIANT_KEYS[(index + delta + VARIANT_KEYS.length) % VARIANT_KEYS.length]);
      window.history.replaceState(window.history.state, '', `#${next}`);
      setHash(next);
    },
    [variant],
  );
  return { active, variant, step };
};
