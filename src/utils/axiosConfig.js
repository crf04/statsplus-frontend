import axios from 'axios';
import { getAuth, getIdToken } from 'firebase/auth';

// Create axios instance with default configuration
const apiClient = axios.create({
  timeout: 5000,
});

// Request interceptor to add authentication token
apiClient.interceptors.request.use(
  async (config) => {
    try {
      const auth = getAuth();
      const user = auth.currentUser;
      
      if (user) {
        // Get the Firebase ID token
        const token = await getIdToken(user);
        config.headers.Authorization = `Bearer ${token}`;
        console.log('Added authorization header with token:', token ? 'Token present' : 'Token missing');
      } else {
        console.log('No authenticated user found, skipping authorization header');
      }
    } catch (error) {
      console.error('Error getting auth token:', error);
      // Continue with request even if token retrieval fails
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for handling auth errors
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // Handle 401 Unauthorized responses
    if (error.response?.status === 401) {
      console.error('Authentication error:', error.response.data);
      // You can add logic here to redirect to login or refresh token
    }
    
    return Promise.reject(error);
  }
);

export default apiClient;