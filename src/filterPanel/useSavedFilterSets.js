import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { fetchSavedFilterSets, subscribeSavedFilterSets } from '../savedFilterSetsApi';

/*
 * The account's Saved Filter Sets for the panel: its Saved tab, the count on
 * that tab, and the name shown when the applied Filter Set is one of them.
 * Every save, rename and delete notifies, so all three follow without a reload.
 */
const useSavedFilterSets = () => {
  const { isAuthenticated, currentUser } = useAuth();
  const [sets, setSets] = useState(null);
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => subscribeSavedFilterSets(() => setRevision((value) => value + 1)), []);
  useEffect(() => {
    if (!isAuthenticated) {
      setSets(null);
      return undefined;
    }
    const controller = new AbortController();
    setError(false);
    fetchSavedFilterSets({ signal: controller.signal })
      .then((sets) => {
        if (!controller.signal.aborted) setSets(sets);
      })
      .catch((error) => {
        if (!controller.signal.aborted) setError(error || true);
      });
    return () => controller.abort();
  }, [isAuthenticated, currentUser?.uid, revision]);
  return { sets, error, retry: () => setRevision((value) => value + 1) };
};

/*
 * Two links are the same Filter Set when they carry the same parameters in any
 * order, including the order of repeated values. A defensive category and its
 * rank travel as a pair in matching positions, so they are compared as pairs.
 */
const canonical = (search) => {
  const params = new URLSearchParams(search);
  const teams = params.getAll('teams_against[]');
  const ranks = params.getAll('rank_filter[]');
  const entries = [...params]
    .filter(([key]) => key !== 'teams_against[]' && key !== 'rank_filter[]')
    .map(([key, value]) => `${key}=${value}`);
  teams.forEach((team, index) => entries.push(`teams_against[]=${team}|${ranks[index] ?? ''}`));
  return entries.sort().join('&');
};

/** The saved set whose parameters are the applied Filter Set's, in any order. */
export const findSavedFilterSet = (sets, search) => {
  const applied = canonical(search);
  return (sets || []).find((set) => canonical(set.queryString) === applied) || null;
};

export default useSavedFilterSets;
