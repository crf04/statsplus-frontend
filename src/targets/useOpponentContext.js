import { useEffect, useRef, useState } from 'react';
import { fetchOpponentProfile, OPPONENT_CATEGORIES } from './opponentContextApi';

// A form owns its reads. Threshold changes and duplicate slices share a profile;
// changing opponents cancels old reads and cannot display the old defense.
export default function useOpponentContext(opponent, qualifiers) {
  const bases = [...new Set(qualifiers.map(({ base }) => base))]
    .filter((base) => OPPONENT_CATEGORIES[base])
    .sort()
    .join(',');
  const cache = useRef({ opponent: null, profiles: {} });
  const [state, setState] = useState({ opponent: null, profiles: {}, errors: {} });
  const [retryCount, setRetryCount] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    if (cache.current.opponent !== opponent) cache.current = { opponent, profiles: {} };
    setState({ opponent, profiles: { ...cache.current.profiles }, errors: {} });
    for (const base of bases.split(',').filter(Boolean)) {
      if (cache.current.profiles[base]) continue;
      fetchOpponentProfile({ opponent, base, signal: controller.signal })
        .then((profile) => {
          if (cancelled) return;
          cache.current.profiles[base] = profile;
          setState((current) => ({
            ...current,
            profiles: { ...current.profiles, [base]: profile },
          }));
        })
        .catch(() => {
          if (!cancelled)
            setState((current) => ({ ...current, errors: { ...current.errors, [base]: true } }));
        });
    }
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [opponent, bases, retryCount]);

  return {
    forQualifier: ({ base, sliceKey }) => {
      if (!OPPONENT_CATEGORIES[base]) return { status: 'unavailable', row: null };
      if (state.opponent !== opponent) return { status: 'loading', row: null };
      if (state.errors[base]) return { status: 'error', row: null };
      const profile = state.profiles[base];
      return { status: profile ? 'ready' : 'loading', row: profile?.[sliceKey] ?? null };
    },
    retry: () => setRetryCount((count) => count + 1),
  };
}
