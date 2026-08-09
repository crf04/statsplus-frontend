import { createContext, useContext, useState, useEffect } from 'react';
import { signInWithPopup, signOut, onAuthStateChanged, getIdToken } from 'firebase/auth';
import { auth, googleProvider } from '../firebase/config';

// Create the Auth Context
const AuthContext = createContext();

const E2E_AUTH_STORAGE_KEY = 'courtai:e2e-authenticated';
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

  // Sign in with Google
  const signInWithGoogle = async () => {
    try {
      if (isE2EMode) {
        window.localStorage.setItem(E2E_AUTH_STORAGE_KEY, 'true');
        setCurrentUser(e2eUser);
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
        setCurrentUser(null);
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
      return undefined;
    }

    if (!auth) {
      setCurrentUser(null);
      setLoading(false);
      return undefined;
    }

    const unsubscribe = onAuthStateChanged(
      auth,
      (user) => {
        setCurrentUser(user);
        setLoading(false);
        setError(null);
      },
      (authError) => {
        console.error('Authentication state error:', authError);
        setCurrentUser(null);
        setLoading(false);
        setError(authError.message || 'Unable to determine authentication state.');
      },
    );

    return unsubscribe;
  }, []);

  const value = {
    currentUser,
    loading,
    error,
    signInWithGoogle,
    logout,
    getToken,
    isAuthenticated: !!currentUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
