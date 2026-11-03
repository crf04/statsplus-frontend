/*
 * PROTOTYPE (throwaway, branch prototype/profile-matchup-tabs).
 * Question: which layout should the Player Profile's Playtypes, Assists and
 * Shooting Type tabs use once they read the Matchup engine (the source MCP
 * get_matchup and Zone Shooting read)?
 *
 * State rides the URL hash (`#proto=profile&v=B`), never the query string: on
 * `/` the query string is the Filter Set.
 */
import { useCallback, useEffect, useState } from 'react';

export const PROTO_STANDALONE = process.env.REACT_APP_PROTOTYPE === 'profile';
export const PROTO_ENABLED = process.env.NODE_ENV !== 'production' || PROTO_STANDALONE;

export const VARIANT_KEYS = ['A', 'B', 'C', 'D'];
export const VARIANT_NAMES = {
  A: 'Table',
  B: 'Bars + rank pill',
  C: 'Combo chart (fixed data)',
  D: 'MCP sentence list',
};

/* Each sample player is read against one opponent, as the page's opponent. */
export const SAMPLES = [
  { name: 'Toumani Camara', opponent: 'DEN' },
  { name: 'Shai Gilgeous-Alexander', opponent: 'HOU' },
  { name: 'Victor Wembanyama', opponent: 'LAL' },
  { name: 'Nikola Jokic', opponent: 'MIN' },
];
export const sampleFor = (playerName) => SAMPLES.find((s) => s.name === playerName) || null;

const STORE = 'proto:profile';
const readHash = () => {
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  if (hash.get('proto')) return hash;
  try {
    return new URLSearchParams(window.sessionStorage.getItem(STORE) || '');
  } catch {
    return new URLSearchParams();
  }
};
const remember = (hash) => {
  try {
    window.sessionStorage.setItem(STORE, String(hash));
  } catch {
    /* private mode */
  }
};

export const useProto = () => {
  const [hash, setHash] = useState(() => readHash());
  useEffect(() => {
    if (hash.get('proto')) remember(hash);
  }, [hash]);
  useEffect(() => {
    const onHashChange = () => setHash(readHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);
  const active = PROTO_ENABLED && (PROTO_STANDALONE || hash.get('proto') === 'profile');
  const variant = VARIANT_KEYS.includes(hash.get('v')) ? hash.get('v') : 'A';
  const tab = hash.get('tab');

  const write = useCallback((key, value) => {
    const next = readHash();
    next.set('proto', 'profile');
    next.set(key, value);
    window.history.replaceState(window.history.state, '', `#${next}`);
    remember(next);
    setHash(next);
  }, []);
  const step = useCallback(
    (delta) => {
      const i = VARIANT_KEYS.indexOf(variant);
      write('v', VARIANT_KEYS[(i + delta + VARIANT_KEYS.length) % VARIANT_KEYS.length]);
    },
    [variant, write],
  );
  const setVariant = useCallback((v) => write('v', v), [write]);
  const setTab = useCallback((t) => write('tab', t), [write]);
  return { active, variant, tab, step, setVariant, setTab };
};

/* Changing the sample player reloads the Log Workspace on that player. */
export const goToPlayer = (name) => {
  const hash = readHash();
  hash.set('proto', 'profile');
  window.location.assign(`/?${new URLSearchParams({ player_name: name })}#${hash}`);
};
