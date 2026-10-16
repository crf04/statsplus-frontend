import { useCallback, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';

/*
 * A gated action that doubles as sign-up (crf04/statsplus#211): Google sign-in
 * creates the account, so a signed-out visitor who runs a query or browses is
 * asked to sign in and then gets exactly what they asked for. The returned
 * function must be called from the click or submit itself, so the popup is not
 * blocked. The action runs from an effect once the account exists, so it sees
 * the signed-in render rather than the one that asked. A cancelled or failed
 * attempt forgets the action and says nothing: the page and what the visitor
 * typed stay as they were.
 */
export const useSignUpThen = (action) => {
  const { isAuthenticated, signInWithGoogle } = useAuth();
  const pending = useRef(null);
  const latest = useRef(action);
  useEffect(() => {
    latest.current = action;
  });
  useEffect(() => {
    if (!isAuthenticated || !pending.current) return;
    const { args } = pending.current;
    pending.current = null;
    latest.current(...args);
  }, [isAuthenticated]);
  return useCallback(
    async (...args) => {
      if (isAuthenticated) return latest.current(...args);
      pending.current = { args };
      try {
        await signInWithGoogle({ silent: true });
      } catch {
        pending.current = null;
      }
      return undefined;
    },
    [isAuthenticated, signInWithGoogle],
  );
};
