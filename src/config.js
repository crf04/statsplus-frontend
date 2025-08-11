// API Configuration
const config = {
  // API Base URL - defaults to localhost for development
  API_BASE_URL: process.env.REACT_APP_API_BASE_URL || 'http://127.0.0.1:8000',
  
  // API endpoints
  API_ENDPOINTS: {
    PLAYERS: '/api/players',
    TEAMS: '/api/teams', 
    GAME_LOGS: '/api/games/game_logs',
    PLAYER_PROFILE: '/api/players/profile',
    TEAM_STATS: '/api/teams/stats',
    NL_QUERY: '/api/nl-query'
  },
  
  // Application settings
  APP_NAME: process.env.REACT_APP_NAME || 'NBA Game Logs',
  APP_VERSION: process.env.REACT_APP_VERSION || '1.0.0',
  ENVIRONMENT: process.env.REACT_APP_ENVIRONMENT || 'development',
  
  // Feature flags
  ENABLE_ANALYTICS: process.env.REACT_APP_ENABLE_ANALYTICS === 'true',
  ENABLE_ERROR_REPORTING: process.env.REACT_APP_ENABLE_ERROR_REPORTING === 'true',
  DEBUG: process.env.REACT_APP_DEBUG === 'true',
  
  // Timeouts
  API_TIMEOUT: parseInt(process.env.REACT_APP_API_TIMEOUT) || 5000,
};

// Helper function to build full API URLs
export const getApiUrl = (endpoint) => {
  const url = `${config.API_BASE_URL}${config.API_ENDPOINTS[endpoint] || endpoint}`;
  console.log(`getApiUrl(${endpoint}) = ${url}`);
  console.log('Environment:', process.env.NODE_ENV);
  console.log('REACT_APP_API_BASE_URL:', process.env.REACT_APP_API_BASE_URL);
  return url;
};

export default config;