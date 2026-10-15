/*
 * PROTOTYPE — throwaway (branch prototype/profile-shooting-tables).
 * Question: how should the Player Profile's Shooting Type and Zone Shooting
 * tables look, and how do they always fit the half-width card?
 *
 * State rides the URL hash (`#proto=shooting&v=B&p=stephen-curry`), never the
 * query string: on `/` the query string is the Filter Set.
 */
import { useCallback, useEffect, useState } from 'react';

import jjType from './mock/jalen-johnson-shooting-type.json';
import jjZone from './mock/jalen-johnson-zone-shooting.json';
import scType from './mock/stephen-curry-shooting-type.json';
import scZone from './mock/stephen-curry-zone-shooting.json';
import vwType from './mock/victor-wembanyama-shooting-type.json';
import vwZone from './mock/victor-wembanyama-zone-shooting.json';
import sgaType from './mock/shai-gilgeous-alexander-shooting-type.json';
import sgaZone from './mock/shai-gilgeous-alexander-zone-shooting.json';
import jjMatch from './mock/jalen-johnson-matchups.json';
import scMatch from './mock/stephen-curry-matchups.json';
import vwMatch from './mock/victor-wembanyama-matchups.json';
import sgaMatch from './mock/shai-gilgeous-alexander-matchups.json';

export const PROTO_STANDALONE = process.env.REACT_APP_PROTOTYPE === 'shooting';
export const PROTO_ENABLED = process.env.NODE_ENV !== 'production' || PROTO_STANDALONE;

/* Round 2 (2026-10-15): A won for Shooting Type; Zone Shooting becomes the
   MCP get_matchup court. B/C/D are in this branch's first commit. */
export const VARIANT_KEYS = ['E', 'F', 'A', 'Now'];
export const VARIANT_NAMES = {
  E: 'A + league tick · MCP court',
  F: 'A + vs-league delta · MCP court + zone list',
  A: 'Round 1 pick (no league)',
  Now: 'Current tables (for comparison)',
};

export const SAMPLE_PLAYERS = {
  'jalen-johnson': { name: 'Jalen Johnson', type: jjType, zone: jjZone, matchups: jjMatch },
  'stephen-curry': { name: 'Stephen Curry', type: scType, zone: scZone, matchups: scMatch },
  'victor-wembanyama': { name: 'Victor Wembanyama', type: vwType, zone: vwZone, matchups: vwMatch },
  'shai-gilgeous-alexander': { name: 'Shai Gilgeous-Alexander', type: sgaType, zone: sgaZone, matchups: sgaMatch },
};
const PLAYER_KEYS = Object.keys(SAMPLE_PLAYERS);

/* Applying filters rewrites the URL and drops the hash, so the choice is also
   kept for the tab's session. */
const STORE = 'proto:shooting';
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
  const active = PROTO_ENABLED && (PROTO_STANDALONE || hash.get('proto') === 'shooting');
  const variant = VARIANT_KEYS.includes(hash.get('v')) ? hash.get('v') : 'E';
  const player = PLAYER_KEYS.includes(hash.get('p')) ? hash.get('p') : PLAYER_KEYS[0];

  const write = useCallback((key, value) => {
    const next = readHash();
    next.set('proto', 'shooting');
    next.set(key, value);
    window.history.replaceState(window.history.state, '', `#${next}`);
    window.sessionStorage.setItem(STORE, String(next));
    setHash(next);
  }, []);
  const step = useCallback(
    (delta) => {
      const i = VARIANT_KEYS.indexOf(variant);
      write('v', VARIANT_KEYS[(i + delta + VARIANT_KEYS.length) % VARIANT_KEYS.length]);
    },
    [variant, write],
  );
  const setPlayer = useCallback((key) => write('p', key), [write]);
  return { active, variant, player, step, setPlayer };
};

/* The switcher's sample player replaces the fetched profile payload, so every
   variant can be judged against a 3PT-heavy, a rim-heavy and a pull-up player. */
export const sampleData = (category, playerKey) =>
  category === 'Shooting Type' ? SAMPLE_PLAYERS[playerKey].type : SAMPLE_PLAYERS[playerKey].zone;
