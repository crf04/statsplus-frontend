// Firebase configuration
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

// Firebase configuration object
// These will be set via environment variables
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
};

const requiredConfigKeys = [
  'apiKey',
  'authDomain',
  'projectId',
  'storageBucket',
  'messagingSenderId',
  'appId',
];

export const firebaseConfigErrors = requiredConfigKeys
  .filter((key) => !firebaseConfig[key])
  .map(
    (key) => `REACT_APP_FIREBASE_${key.replace(/[A-Z]/g, (letter) => `_${letter}`).toUpperCase()}`,
  );

export const hasValidFirebaseConfig = firebaseConfigErrors.length === 0;

// Firebase is optional for a local shell/build. Keep the exports defined so
// auth consumers can render a useful state instead of failing during module
// evaluation when environment variables are absent.
let app = null;
let auth = null;
let googleProvider = null;

if (hasValidFirebaseConfig) {
  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    googleProvider = new GoogleAuthProvider();

    // Optional: Configure Google provider
    googleProvider.addScope('email');
    googleProvider.addScope('profile');
  } catch (error) {
    console.error('Firebase initialization error:', error);
  }
} else if (process.env.NODE_ENV !== 'test') {
  console.warn(
    `Firebase is not configured; authentication is disabled. Missing: ${firebaseConfigErrors.join(', ')}`,
  );
}

export { auth, googleProvider, firebaseConfig };
export default app;
