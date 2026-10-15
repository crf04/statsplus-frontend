/*
 * PROTOTYPE — throwaway (branch prototype/targets-text-size). See ./README.md.
 *
 * Question: how much bigger should the Targets page's text be?
 * The variant rides the URL hash (`#v=B`) so reloads and shared links keep it.
 */
import { useCallback, useEffect, useState } from 'react';

/* Dev servers always allow the prototype; a production build only with
   REACT_APP_PROTOTYPE=targets-text. A stray merge cannot ship it. */
export const PROTO_STANDALONE = process.env.REACT_APP_PROTOTYPE === 'targets-text';
export const PROTO_ENABLED = process.env.NODE_ENV !== 'production' || PROTO_STANDALONE;

export const VARIANT_KEYS = ['Now', 'A', 'B', 'C'];

export const VARIANT_NAMES = {
  Now: 'Current sizes (for comparison)',
  A: 'Every size +15%',
  B: 'Small print raised to 12.5–14.5px',
  C: 'Whole page zoomed 115%',
};

const readVariant = () => {
  const match = window.location.hash.match(/v=([A-Za-z]+)/);
  return match && VARIANT_KEYS.includes(match[1]) ? match[1] : 'A';
};

export const useVariant = () => {
  const [variant, setVariant] = useState(readVariant);

  useEffect(() => {
    const onHash = () => setVariant(readVariant());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // The class lives on <body> so the New Target modal (a portal) follows it.
  useEffect(() => {
    const cls = `proto-text-${variant}`;
    document.body.classList.add(cls);
    return () => document.body.classList.remove(cls);
  }, [variant]);

  const step = useCallback((delta) => {
    const index = VARIANT_KEYS.indexOf(readVariant());
    const next = VARIANT_KEYS[(index + delta + VARIANT_KEYS.length) % VARIANT_KEYS.length];
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#v=${next}`);
    setVariant(next);
  }, []);

  return [variant, step];
};
