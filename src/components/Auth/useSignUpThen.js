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
 * typed stay as they were. While a popup is open, further triggers are ignored,
 * and the action runs only for the account that popup returned, so an
 * unrelated sign-in elsewhere runs nothing.
 */
export const useSignUpThen = (action) => {
  const { isAuthenticated, currentUser, signInWithGoogle } = useAuth();
  const attempt = useRef(null);
  const latest = useRef(action);
  const [returnedUid, setReturnedUid] = useState(null);
  useEffect(() => {
    latest.current = action;
  });
  const uid = currentUser?.uid ?? null;
  useEffect(() => {
    const current = attempt.current;
    if (!current || !current.uid || current.uid !== uid) return;
    attempt.current = null;
    latest.current(...current.args);
  }, [uid, returnedUid]);
  return useCallback(
    async (...args) => {
      if (isAuthenticated) return latest.current(...args);
      if (attempt.current) return undefined;
      const mine = { args, uid: null };
      attempt.current = mine;
      try {
        const user = await signInWithGoogle({ silent: true });
        if (attempt.current === mine) {
          mine.uid = user?.uid ?? null;
          setReturnedUid(mine.uid);
        }
      } catch {
        if (attempt.current === mine) attempt.current = null;
      }
      return undefined;
    },
    [isAuthenticated, signInWithGoogle],
  );
};
