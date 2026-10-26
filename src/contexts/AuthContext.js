import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import {
  signInWithRedirect,
  getRedirectResult,
  signOut,
  onAuthStateChanged,
  onIdTokenChanged,
  getIdToken,
  getIdTokenResult,
} from 'firebase/auth';
import { clearRevisitCaches } from '../revisitCache';
import { auth, googleProvider } from '../firebase/config';
import { subscribeWaitlisted } from '../utils/waitlistSignal';

// Create the Auth Context
const AuthContext = createContext();

const E2E_AUTH_STORAGE_KEY = 'courtai:e2e-authenticated';
export const E2E_ADMIN_STORAGE_KEY = 'courtai:e2e-admin';
// PROTOTYPE (throwaway): the standalone stat-header build signs in a fake user
// the way E2E mode does, so the public link needs no Firebase login.
const isProtoStandalone = process.env.REACT_APP_PROTOTYPE === 'stat-header';
const isE2EMode =
  (process.env.NODE_ENV !== 'production' && process.env.REACT_APP_E2E_MODE === 'true') ||
  isProtoStandalone;
const e2eUser = {
  uid: 'courtai-e2e-user',
  displayName: 'CourtAI Test User',
  email: 'e2e@courtai.test',
};

const getInitialUser = () => {
  if (!isE2EMode || typeof window === 'undefined') return null;
  if (isProtoStandalone) return e2eUser;
  return window.localStorage.getItem(E2E_AUTH_STORAGE_KEY) === 'true' ? e2eUser : null;
};

const hasAdminClaim = (claims = {}) =>
  claims.admin === true || claims.role === 'admin' || claims.roles?.includes?.('admin');

const getE2EAdmin = () =>
  isE2EMode && typeof window !== 'undefined'
    ? window.localStorage.getItem(E2E_ADMIN_STORAGE_KEY) === 'true'
    : false;

// Custom hook to use the Auth Context
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// AuthProvider component
export function AuthProvider({ children, authClient = auth, authProvider = googleProvider }) {
  const [currentUser, setCurrentUser] = useState(getInitialUser);
  const currentUserRef = useRef(getInitialUser());
  const [loading, setLoading] = useState(!isE2EMode);
  const [error, setError] = useState(null);
  // A failed redirect sign-in. The auth listener clears the error on every
  // callback; this keeps the redirect's failure through whichever settles last.
  const redirectErrorRef = useRef(null);
  // Set by an authenticated response that says the account is waitlisted.
  const [waitlist, setWaitlist] = useState(null);
  const [adminState, setAdminState] = useState(() => ({
    loading: !isE2EMode,
    isAdmin: getE2EAdmin(),
    status: isE2EMode ? (getE2EAdmin() ? 'authorized' : 'forbidden') : 'unknown',
    error: null,
  }));

  // The uid whose admin verdict is settled. Firebase refreshes the ID token
  // about hourly; re-checking that same user keeps the verdict visible instead
  // of dropping guarded routes back to a spinner that unmounts their page.
  const settledAdminUidRef = useRef(null);

  const refreshAdminClaims = useCallback(
    async (user = currentUserRef.current, forceRefresh = false) => {
      if (!user) {
        settledAdminUidRef.current = null;
        setAdminState({ loading: false, isAdmin: false, status: 'signed_out', error: null });
        return false;
      }

      if (isE2EMode) {
        const isAdmin = getE2EAdmin();
        setAdminState({
          loading: false,
          isAdmin,
          status: isAdmin ? 'authorized' : 'forbidden',
          error: null,
        });
        return isAdmin;
      }

      if (!authClient || typeof getIdTokenResult !== 'function') {
        const configurationError = 'Firebase authentication is not configured for admin access.';
        setAdminState({
          loading: false,
          isAdmin: false,
          status: 'configuration_error',
          error: configurationError,
        });
        return false;
      }

      if (forceRefresh || settledAdminUidRef.current !== user.uid) {
        settledAdminUidRef.current = null;
        setAdminState((previous) => ({ ...previous, loading: true, error: null }));
      }
      try {
        const tokenResult = await getIdTokenResult(user, forceRefresh);
        const isAdmin = hasAdminClaim(tokenResult?.claims);
        settledAdminUidRef.current = user.uid;
        setAdminState({
          loading: false,
          isAdmin,
          status: isAdmin ? 'authorized' : 'forbidden',
          error: null,
        });
        return isAdmin;
      } catch (claimError) {
        settledAdminUidRef.current = null;
        const message = claimError?.message || 'Unable to verify administrator permissions.';
        setAdminState({
          loading: false,
          isAdmin: false,
          status: 'configuration_error',
          error: message,
        });
        return false;
      }
    },
    [authClient],
  );

  // Sign in with Google by redirect. `silent` is for a caller that shows the
  // page it is already on until the redirect starts and owns a failed attempt:
  // it neither swaps the page for the loading screen nor records an error.
  const signInWithGoogle = async ({ silent = false } = {}) => {
    let redirecting = false;
    try {
      if (isE2EMode) {
        window.localStorage.setItem(E2E_AUTH_STORAGE_KEY, 'true');
        clearRevisitCaches();
        currentUserRef.current = e2eUser;
        setWaitlist(null);
        setCurrentUser(e2eUser);
        await refreshAdminClaims(e2eUser);
        setError(null);
        return e2eUser;
      }

      if (!authClient || !authProvider) {
        const configurationError = new Error('Firebase authentication is not configured.');
        setError(configurationError.message);
        throw configurationError;
      }

      redirectErrorRef.current = null;
      setError(null);
      if (!silent) setLoading(true);
      // No popup: ad blockers and Safari break it, and a closed popup cannot be
      // told from a blocked one. The page leaves for Google and the account
      // arrives through the auth listener on return, so there is no user to
      // return here and the loading screen stays up while the page navigates.
      await signInWithRedirect(authClient, authProvider);
      redirecting = true;
      return undefined;
    } catch (error) {
      console.error('Google sign-in error:', error);
      if (!silent) setError(error.message);
      throw error;
    } finally {
      if (!silent && !redirecting) setLoading(false);
    }
  };

  // Sign out
  const logout = async () => {
    clearRevisitCaches();
    setWaitlist(null);
    try {
      setError(null);
      if (isE2EMode) {
        window.localStorage.removeItem(E2E_AUTH_STORAGE_KEY);
        window.localStorage.removeItem(E2E_ADMIN_STORAGE_KEY);
        currentUserRef.current = null;
        setCurrentUser(null);
        setAdminState({ loading: false, isAdmin: false, status: 'signed_out', error: null });
        return;
      }
      if (!authClient) return;
      await signOut(authClient);
    } catch (error) {
      console.error('Sign-out error:', error);
      setError(error.message);
      throw error;
    }
  };

  // Get the current user's ID token
  const getToken = async () => {
    if (isE2EMode && currentUser) return 'courtai-e2e-token';

    if (currentUser) {
      try {
        return await getIdToken(currentUser);
      } catch (error) {
        console.error('Error getting token:', error);
        return null;
      }
    }
    return null;
  };

  useEffect(
    () =>
      subscribeWaitlisted((message, account) => {
        if (account && currentUserRef.current?.uid === account) setWaitlist({ message });
      }),
    [],
  );

  // Listen for authentication state changes
  useEffect(() => {
    if (isE2EMode) {
      setLoading(false);
      refreshAdminClaims(getInitialUser());
      return undefined;
    }

    if (!authClient) {
      clearRevisitCaches();
      setCurrentUser(null);
      currentUserRef.current = null;
      setLoading(false);
      setAdminState({
        loading: false,
        isAdmin: false,
        status: 'configuration_error',
        error: 'Firebase authentication is not configured for admin access.',
      });
      return undefined;
    }

    // Completes a sign-in that left the page through signInWithRedirect. The
    // user itself arrives through the auth listener below; only a failure needs
    // reporting, and redirectErrorRef keeps it from the listener's clearing.
    let redirectCancelled = false;
    if (typeof getRedirectResult === 'function') {
      Promise.resolve(getRedirectResult(authClient)).catch((redirectError) => {
        console.error('Google redirect sign-in error:', redirectError);
        if (redirectCancelled) return;
        redirectErrorRef.current = redirectError?.message || 'Google sign-in failed.';
        setError(redirectErrorRef.current);
      });
    }

    const authStateListener =
      typeof onIdTokenChanged === 'function' ? onIdTokenChanged : onAuthStateChanged;
    const unsubscribe = authStateListener(
      authClient,
      async (user) => {
        if (currentUserRef.current?.uid !== user?.uid) {
          clearRevisitCaches();
          setWaitlist(null);
        }
        currentUserRef.current = user;
        setCurrentUser(user);
        setLoading(false);
        setError(redirectErrorRef.current);
        await refreshAdminClaims(user);
      },
      (authError) => {
        console.error('Authentication state error:', authError);
        clearRevisitCaches();
        currentUserRef.current = null;
        setWaitlist(null);
        setCurrentUser(null);
        setLoading(false);
        setAdminState({
          loading: false,
          isAdmin: false,
          status: 'configuration_error',
          error: authError.message || 'Unable to verify administrator permissions.',
        });
        setError(authError.message || 'Unable to determine authentication state.');
      },
    );

    return () => {
      redirectCancelled = true;
      unsubscribe();
    };
  }, [authClient, refreshAdminClaims]);

  const value = {
    currentUser,
    loading,
    error,
    waitlist,
    signInWithGoogle,
    logout,
    getToken,
    isAuthenticated: !!currentUser,
    isAdmin: adminState.isAdmin,
    adminLoading: adminState.loading,
    adminStatus: adminState.status,
    adminError: adminState.error,
    refreshAdminClaims,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
