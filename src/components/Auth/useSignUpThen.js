import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';

/*
 * A gated action that doubles as sign-up (crf04/statsplus#211): Google sign-in
 * creates the account, so a signed-out visitor who runs a query or browses is
 * asked to sign in and then gets exactly what they asked for. The returned
 * function must be called from the click or submit itself, so the popup is not
 * blocked. The action runs from an effect once the account exists, so it sees
 * the signed-in render rather than the one that asked. A cancelled or failed
 * attempt forgets the action and says nothing: the page and what the visitor
 * typed stay as they were. A trigger while a popup is still pending replaces
 * that attempt (Firebase reports a closed popup only seconds later, and the
 * visitor should not have to wait it out), so only the newest action can run.
 * It runs only for the account its popup returned, so an unrelated sign-in
 * elsewhere runs nothing.
 */
export const useSignUpThen = (action) => {
  const { isAuthenticated, currentUser, signInWithGoogle } = useAuth();
  const attempt = useRef(null);
  const latest = useRef(action);
  // Bumped each time a popup settles, so the effect below re-checks even when
  // the returned account is the same one as last time.
  const [settled, setSettled] = useState(0);
  useEffect(() => {
    latest.current = action;
  });
  const uid = currentUser?.uid ?? null;
  useEffect(() => {
    const current = attempt.current;
    if (!current || !current.uid || current.uid !== uid) return;
    attempt.current = null;
    latest.current(...current.args);
  }, [uid, settled]);
  return useCallback(
    async (...args) => {
      if (isAuthenticated) return latest.current(...args);
      const mine = { args, uid: null };
      attempt.current = mine;
      try {
        const user = await signInWithGoogle({ silent: true });
        if (attempt.current === mine) {
          mine.uid = user?.uid ?? null;
          if (!mine.uid) attempt.current = null;
          setSettled((count) => count + 1);
        }
      } catch {
        if (attempt.current === mine) attempt.current = null;
      }
      return undefined;
    },
    [isAuthenticated, signInWithGoogle],
  );
};
