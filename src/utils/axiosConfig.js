import axios from 'axios';
import { getIdToken } from 'firebase/auth';
import { API_TIMEOUT } from '../apiSettings';
import { auth } from '../firebase/config';

// Create axios instance with default configuration
const apiClient = axios.create({
  timeout: API_TIMEOUT,
});

// Request interceptor to add authentication token
apiClient.interceptors.request.use(
  async (config) => {
    try {
      const e2eTokenAvailable =
        process.env.NODE_ENV !== 'production' &&
        process.env.REACT_APP_E2E_MODE === 'true' &&
        typeof window !== 'undefined' &&
        window.localStorage.getItem('courtai:e2e-authenticated') === 'true';
      const user = auth?.currentUser;

      if (e2eTokenAvailable) {
        config.headers = config.headers || {};
        config.headers.Authorization = 'Bearer courtai-e2e-token';
      } else if (user) {
        // Get the Firebase ID token
        const token = await getIdToken(user);
        config.headers = config.headers || {};
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      // Firebase can be intentionally unavailable in local development. The
      // request still proceeds so public endpoints can expose a useful error.
      console.warn('Unable to attach auth token to API request:', error.code || error.message);
      // Continue with request even if token retrieval fails
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

// Response interceptor for handling auth errors
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (
      error?.code === 'ERR_CANCELED' ||
      error?.name === 'CanceledError' ||
      error?.name === 'AbortError'
    ) {
      return Promise.reject(error);
    }

    // Handle 401 Unauthorized responses
    if (error.response?.status === 401) {
      console.error('API request was unauthorized.');
      // You can add logic here to redirect to login or refresh token
    } else {
      console.error('API request failed:', error.response?.status || error.message);
    }

    return Promise.reject(error);
  },
);

export default apiClient;
