import { useCallback, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';

/*
 * A gated action that doubles as sign-up (crf04/statsplus#211): Google sign-in
 * creates the account, so a signed-out visitor who runs a query or browses is
 * asked to sign in and then gets exactly what they asked for.
 *
 * Sign-in leaves the page for Google (a redirect, never a popup), so the action
 * cannot wait in memory. The returned function stores `{ key, args }` in
 * sessionStorage, then starts the redirect. `key` names the action and must be
 * stable across page loads; `args` must be JSON-serializable. When the page
 * loads again and auth has settled, a hook whose key matches the stored entry
 * removes it and runs the action once with the stored args if the visitor is
 * signed in; if they are signed out (cancelled or failed redirect) it just
 * removes it. The action runs from an effect, so it sees the signed-in render.
 * A newer trigger replaces the stored entry, and an entry older than ten
 * minutes is ignored so it cannot fire on a later, unrelated visit.
 */
export const SIGN_UP_THEN_STORAGE_KEY = 'courtai:sign-up-then';
const MAX_AGE_MS = 10 * 60 * 1000;

const readEntry = () => {
  try {
    const entry = JSON.parse(window.sessionStorage.getItem(SIGN_UP_THEN_STORAGE_KEY));
    return entry && typeof entry.key === 'string' && Array.isArray(entry.args) ? entry : null;
  } catch {
    return null;
  }
};

const clearEntry = () => {
  try {
    window.sessionStorage.removeItem(SIGN_UP_THEN_STORAGE_KEY);
  } catch {
    // Storage unavailable: nothing was stored.
  }
};

export const useSignUpThen = (key, action) => {
  const { isAuthenticated, currentUser, loading, signInWithGoogle } = useAuth();
  const latest = useRef(action);
  useEffect(() => {
    latest.current = action;
  });
  const uid = currentUser?.uid ?? null;
  useEffect(() => {
    if (loading) return;
    const entry = readEntry();
    if (!entry || entry.key !== key) return;
    clearEntry();
    if (uid && Date.now() - entry.at < MAX_AGE_MS) latest.current(...entry.args);
  }, [key, loading, uid]);
  return useCallback(
    async (...args) => {
      if (isAuthenticated) return latest.current(...args);
      try {
        window.sessionStorage.setItem(
          SIGN_UP_THEN_STORAGE_KEY,
          JSON.stringify({ key, args, at: Date.now() }),
        );
      } catch {
        // Without storage the visitor still signs in; the action is not resumed.
      }
      try {
        await signInWithGoogle({ silent: true });
      } catch {
        clearEntry();
      }
      return undefined;
    },
    [key, isAuthenticated, signInWithGoogle],
  );
};
