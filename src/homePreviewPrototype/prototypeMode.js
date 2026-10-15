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

export const VARIANT_KEYS = [
  'W',
  'X',
  'T',
  'U',
  'V',
  'R',
  'S',
  'N',
  'O',
  'P',
  'Q',
  'M',
  'K',
  'L',
  'I',
  'J',
  'H',
  'F',
  'G',
  'E',
  'A',
  'B',
  'C',
  'D',
  'Now',
];

export const VARIANT_NAMES = {
  W: 'Split: Tonight home at /, search at /search (T layout)',
  X: 'Split: Tonight home at /, search at /search (V layout)',
  T: 'Tonight board: games grid + Targets, compact search',
  U: 'Court hero about edges; Targets; search at the bottom',
  V: 'Two doors: Matchups | Targets',
  R: 'Saved sets left | hero | Tonight right',
  S: 'Left sidebar: saved sets + Targets',
  N: 'Tabs: Tonight | Try a question',
  O: 'Two columns: questions | tonight',
  P: 'Tonight band first, then hero',
  Q: 'Ladder as a path; Best | Targets | Toughest',
  M: 'Hero alone; matchups + Targets at the bottom',
  K: 'I, calmer: slim matchups, one-line Targets',
  L: 'K without Targets',
  I: 'Matchups flank the headline, Targets row below',
  J: 'Mirrored sides: matchup + Target each',
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

/* Navigating to /search drops the hash, so the choice is also kept for the
   tab's session: the split variants need it on both pages. */
const STORE = 'proto:home';
const readHash = () => {
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  if (hash.get('proto')) {
    window.sessionStorage.setItem(STORE, String(hash));
    return hash;
  }
  return new URLSearchParams(window.sessionStorage.getItem(STORE) || '');
};

/* W/X move search to its own page: `/` is the Tonight home, `/search` the
   current Query Prompt and Log Workspace. */
export const SPLIT_VARIANTS = ['W', 'X'];

export const useVariant = () => {
  const [hash, setHash] = useState(readHash);
  useEffect(() => {
    const onHashChange = () => setHash(readHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);
  const active = PROTO_ENABLED && (PROTO_STANDALONE || hash.get('proto') === 'home');
  const key = hash.get('v') || 'W';
  const variant = VARIANT_KEYS.includes(key) ? key : 'W';
  const step = useCallback(
    (delta) => {
      const index = VARIANT_KEYS.indexOf(variant);
      const next = readHash();
      next.set('proto', 'home');
      next.set('v', VARIANT_KEYS[(index + delta + VARIANT_KEYS.length) % VARIANT_KEYS.length]);
      window.history.replaceState(window.history.state, '', `#${next}`);
      window.sessionStorage.setItem(STORE, String(next));
      setHash(next);
      window.dispatchEvent(new Event('hashchange'));
    },
    [variant],
  );
  const split = active && SPLIT_VARIANTS.includes(variant);
  return { active, variant, step, split };
};
