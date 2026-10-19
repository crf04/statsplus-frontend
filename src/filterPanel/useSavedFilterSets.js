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

const canonical = (search) => {
  const params = new URLSearchParams(search);
  params.sort();
  return params.toString();
};

/** The saved set whose parameters are the applied Filter Set's, in any order. */
export const findSavedFilterSet = (sets, search) => {
  const applied = canonical(search);
  return (sets || []).find((set) => canonical(set.queryString) === applied) || null;
};

export default useSavedFilterSets;
