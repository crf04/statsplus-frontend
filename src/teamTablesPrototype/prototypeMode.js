/*
 * PROTOTYPE — throwaway (branch prototype/team-profile-tables).
 * Question: how should the Opposing Team Profile's stat tables look in the
 * half-width card, across all five categories?
 *
 * State rides the URL hash (`#proto=team&v=B`), never the query string: on
 * `/` the query string is the Filter Set.
 */
import { useCallback, useEffect, useState } from 'react';

export const PROTO_STANDALONE = process.env.REACT_APP_PROTOTYPE === 'team';
export const PROTO_ENABLED = process.env.NODE_ENV !== 'production' || PROTO_STANDALONE;

export const VARIANT_KEYS = ['A', 'B', 'C', 'Now'];
export const VARIANT_NAMES = {
  A: 'Ledger',
  B: 'Bars vs league',
  C: 'Rank tiles',
  Now: 'Current tables',
};

/* Applying filters rewrites the URL and drops the hash, so the choice is also
   kept for the tab's session. */
const STORE = 'proto:team';
const readHash = () => {
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  if (hash.get('proto')) return hash;
  return new URLSearchParams(window.sessionStorage.getItem(STORE) || '');
};

export const useProto = () => {
  const [hash, setHash] = useState(() => readHash());
  useEffect(() => {
    if (hash.get('proto')) window.sessionStorage.setItem(STORE, String(hash));
  }, [hash]);
  useEffect(() => {
    const onHashChange = () => setHash(readHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);
  const active = PROTO_ENABLED && (PROTO_STANDALONE || hash.get('proto') === 'team');
  const variant = VARIANT_KEYS.includes(hash.get('v')) ? hash.get('v') : 'A';

  const step = useCallback(
    (delta) => {
      const i = VARIANT_KEYS.indexOf(variant);
      const next = readHash();
      next.set('proto', 'team');
      next.set('v', VARIANT_KEYS[(i + delta + VARIANT_KEYS.length) % VARIANT_KEYS.length]);
      window.history.replaceState(window.history.state, '', `#${next}`);
      window.sessionStorage.setItem(STORE, String(next));
      setHash(next);
    },
    [variant],
  );
  return { active, variant, step };
};
