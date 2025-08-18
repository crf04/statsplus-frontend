import axios from 'axios';
import { getAuth, getIdToken } from 'firebase/auth';

// Create axios instance with default configuration
const apiClient = axios.create({
  // No timeout - let game logs take as long as needed
});

// Request interceptor to add authentication token
apiClient.interceptors.request.use(
  async (config) => {
    console.log(`🔐 Axios interceptor called for: ${config.method?.toUpperCase()} ${config.url}`);
    try {
      const auth = getAuth();
      const user = auth.currentUser;
      
      if (user) {
        // Get the Firebase ID token
        const token = await getIdToken(user);
        config.headers.Authorization = `Bearer ${token}`;
        console.log(`✅ Authorization header added for ${config.url}:`, token ? 'Token present' : 'Token missing');
      } else {
        console.log(`❌ No authenticated user found for ${config.url}, skipping authorization header`);
      }
    } catch (error) {
      console.error(`💥 Error getting auth token for ${config.url}:`, error);
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
    console.log(`✅ Successful response from: ${response.config.url}`);
    return response;
  },
  (error) => {
    // Handle 401 Unauthorized responses
    if (error.response?.status === 401) {
      console.error(`🚫 401 Unauthorized error for ${error.config?.url}:`, error.response.data);
      // You can add logic here to redirect to login or refresh token
    } else {
      console.error(`💥 API error for ${error.config?.url}:`, error.response?.status, error.response?.data);
    }
    
    return Promise.reject(error);
  }
);

export default apiClient;