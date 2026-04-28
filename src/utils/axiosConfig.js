import axios from 'axios';
import { getAuth, getIdToken } from 'firebase/auth';

// Create axios instance with default configuration
const apiClient = axios.create({
  // No timeout - let game logs take as long as needed
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
      }
    } catch (error) {
      console.error('Unable to attach auth token to API request:', error.code || error.message);
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
      console.error('API request was unauthorized.');
      // You can add logic here to redirect to login or refresh token
    } else {
      console.error('API request failed:', error.response?.status || error.message);
    }
    
    return Promise.reject(error);
  }
);

export default apiClient;
