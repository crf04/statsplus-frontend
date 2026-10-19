/* PROTOTYPE — throwaway. The account's Saved Filter Sets, padded with samples. */
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { fetchSavedFilterSets, subscribeSavedFilterSets } from '../savedFilterSetsApi';
import { describeSavedFilterSet } from '../savedFilterSetDescription';

// Real sets come first. When an account has only a couple, these stand in so
// density can be judged; each is marked as a sample wherever it renders.
const SAMPLES = [
  ['JJ without Trae', 'player_name=Jalen+Johnson&players_off%5B%5D=Trae+Young&game_filter=15'],
  [
    'JJ vs soft boards',
    'player_name=Jalen+Johnson&teams_against%5B%5D=OPP_REB&rank_filter%5B%5D=-8',
  ],
  ['JJ home, 30+ min', 'player_name=Jalen+Johnson&location_filter=Home&minutes_filter=30%2C48'],
  ['Reaves last 10 away', 'player_name=Austin+Reaves&game_filter=10&location_filter=Away'],
  [
    'LeBron vs top-5 assists D',
    'player_name=LeBron+James&teams_against%5B%5D=OPP_AST&rank_filter%5B%5D=5',
  ],
  ['Brunson 25+ pts nights', 'player_name=Jalen+Brunson&self_filters%5BPTS%5D=25%2C999'],
].map(([name, queryString], index) => ({ id: `sample-${index}`, name, queryString, sample: true }));

const canonical = (search) => {
  const params = new URLSearchParams(search);
  params.sort();
  return params.toString();
};

const same = (name) => (name || '').trim().toLowerCase().replace(/\s+/g, ' ');

export const useSets = (player) => {
  const { isAuthenticated, currentUser } = useAuth();
  const location = useLocation();
  const [real, setReal] = useState(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => subscribeSavedFilterSets(() => setRevision((value) => value + 1)), []);
  useEffect(() => {
    if (!isAuthenticated) return undefined;
    const controller = new AbortController();
    fetchSavedFilterSets({ signal: controller.signal })
      .then((sets) => !controller.signal.aborted && setReal(sets))
      .catch(() => !controller.signal.aborted && setReal([]));
    return () => controller.abort();
  }, [isAuthenticated, currentUser?.uid, revision]);
  if (!real) return { loaded: false, all: [], mine: [], others: [], current: null };
  const all = (real.length < 4 ? [...real, ...SAMPLES] : real).map((set) => ({
    ...set,
    described: describeSavedFilterSet(set.queryString),
  }));
  const here = canonical(location.search);
  const current = all.find((set) => canonical(set.queryString) === here) || null;
  const mine = all.filter((set) => same(set.described.player) === same(player));
  const others = all.filter((set) => same(set.described.player) !== same(player));
  return { loaded: true, all, mine, others, current };
};
