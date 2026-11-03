/*
 * PROTOTYPE (throwaway, branch prototype/profile-matchup-tabs).
 * Question: which layout should the Player Profile's Playtypes, Assists and
 * Shooting Type tabs use once they read the Matchup engine (the source MCP
 * get_matchup and Zone Shooting read)?
 *
 * State rides the URL hash (`#proto=profile&v=S4`), never the query string: on
 * `/` the query string is the Filter Set.
 */
import { useCallback, useEffect, useState } from 'react';

export const PROTO_STANDALONE = process.env.REACT_APP_PROTOTYPE === 'profile';
export const PROTO_ENABLED = process.env.NODE_ENV !== 'production' || PROTO_STANDALONE;

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
  const tab = hash.get('tab');
  const combo = ['C1', 'C2', 'C3'].includes(hash.get('combo')) ? hash.get('combo') : 'C1';
  const variant = ['F', 'G', 'H1', 'H2', 'H3', 'S1', 'S2', 'S3', 'S4'].includes(hash.get('v'))
    ? hash.get('v')
    : 'S4';

  const write = useCallback((key, value) => {
    const next = readHash();
    next.set('proto', 'profile');
    next.set(key, value);
    window.history.replaceState(window.history.state, '', `#${next}`);
    remember(next);
    setHash(next);
  }, []);
  const setTab = useCallback((t) => write('tab', t), [write]);
  const setVariant = useCallback((v) => write('v', v), [write]);
  const setCombo = useCallback((c) => write('combo', c), [write]);
  return { active, tab, setTab, variant, setVariant, combo, setCombo };
};

/* Changing the sample player reloads the Log Workspace on that player. */
export const goToPlayer = (name) => {
  const hash = readHash();
  hash.set('proto', 'profile');
  window.location.assign(`/?${new URLSearchParams({ player_name: name })}#${hash}`);
};
