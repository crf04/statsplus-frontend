import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  onIdTokenChanged,
  getIdToken,
  getIdTokenResult,
} from 'firebase/auth';
import { auth, googleProvider } from '../firebase/config';

// Create the Auth Context
const AuthContext = createContext();

const E2E_AUTH_STORAGE_KEY = 'courtai:e2e-authenticated';
export const E2E_ADMIN_STORAGE_KEY = 'courtai:e2e-admin';
const isE2EMode =
  process.env.NODE_ENV !== 'production' && process.env.REACT_APP_E2E_MODE === 'true';
const e2eUser = {
  uid: 'courtai-e2e-user',
  displayName: 'CourtAI Test User',
  email: 'e2e@courtai.test',
};

const getInitialUser = () => {
  if (!isE2EMode || typeof window === 'undefined') return null;
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
export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(getInitialUser);
  const [loading, setLoading] = useState(!isE2EMode);
  const [error, setError] = useState(null);
  const [adminState, setAdminState] = useState(() => ({
    loading: !isE2EMode,
    isAdmin: getE2EAdmin(),
    status: isE2EMode ? (getE2EAdmin() ? 'authorized' : 'forbidden') : 'unknown',
    error: null,
  }));

  const refreshAdminClaims = useCallback(
    async (user = currentUser, forceRefresh = false) => {
      if (!user) {
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

      if (!auth || typeof getIdTokenResult !== 'function') {
        const configurationError = 'Firebase authentication is not configured for admin access.';
        setAdminState({
          loading: false,
          isAdmin: false,
          status: 'configuration_error',
          error: configurationError,
        });
        return false;
      }

      setAdminState((previous) => ({ ...previous, loading: true, error: null }));
      try {
        const tokenResult = await getIdTokenResult(user, forceRefresh);
        const isAdmin = hasAdminClaim(tokenResult?.claims);
        setAdminState({
          loading: false,
          isAdmin,
          status: isAdmin ? 'authorized' : 'forbidden',
          error: null,
        });
        return isAdmin;
      } catch (claimError) {
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
    [currentUser],
  );

  // Sign in with Google
  const signInWithGoogle = async () => {
    try {
      if (isE2EMode) {
        window.localStorage.setItem(E2E_AUTH_STORAGE_KEY, 'true');
        setCurrentUser(e2eUser);
        await refreshAdminClaims(e2eUser);
        setError(null);
        return e2eUser;
      }

      if (!auth || !googleProvider) {
        const configurationError = new Error('Firebase authentication is not configured.');
        setError(configurationError.message);
        throw configurationError;
      }

      setError(null);
      setLoading(true);
      const result = await signInWithPopup(auth, googleProvider);
      return result.user;
    } catch (error) {
      console.error('Google sign-in error:', error);
      setError(error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Sign out
  const logout = async () => {
    try {
      setError(null);
      if (isE2EMode) {
        window.localStorage.removeItem(E2E_AUTH_STORAGE_KEY);
        window.localStorage.removeItem(E2E_ADMIN_STORAGE_KEY);
        setCurrentUser(null);
        setAdminState({ loading: false, isAdmin: false, status: 'signed_out', error: null });
        return;
      }
      if (!auth) return;
      await signOut(auth);
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

  // Listen for authentication state changes
  useEffect(() => {
    if (isE2EMode) {
      setLoading(false);
      refreshAdminClaims(getInitialUser());
      return undefined;
    }

    if (!auth) {
      setCurrentUser(null);
      setLoading(false);
      return undefined;
    }

    const authStateListener =
      typeof onIdTokenChanged === 'function' ? onIdTokenChanged : onAuthStateChanged;
    const unsubscribe = authStateListener(
      auth,
      async (user) => {
        setCurrentUser(user);
        setLoading(false);
        setError(null);
        await refreshAdminClaims(user);
      },
      (authError) => {
        console.error('Authentication state error:', authError);
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

    return unsubscribe;
  }, [refreshAdminClaims]);

  const value = {
    currentUser,
    loading,
    error,
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
