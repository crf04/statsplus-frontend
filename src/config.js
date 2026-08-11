import { API_TIMEOUT } from './apiSettings';

const trimTrailingSlashes = (value) => value.replace(/\/+$/, '');
const configuredApiBaseUrl = trimTrailingSlashes((process.env.REACT_APP_API_BASE_URL || '').trim());
const apiBaseUrl =
  process.env.NODE_ENV === 'production' ? '' : configuredApiBaseUrl || 'http://127.0.0.1:8000';

const config = {
  // Production always stays same-origin so Vercel's /api rewrite owns backend routing.
  API_BASE_URL: apiBaseUrl,

  // API endpoints
  API_ENDPOINTS: {
    PLAYERS: '/api/players',
    TEAMS: '/api/teams',
    GAME_LOGS: '/api/games/game_logs',
    SLATE: '/api/games/slate',
    MATCHUP: '/api/games/matchup',
    MATCHUP_SELECTION: '/api/games/matchup/selection',
    PLAYER_PROFILE: '/api/players/profile',
    TEAM_STATS: '/api/teams/stats',
    NL_QUERY: '/api/nl-query',
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
  API_TIMEOUT,
};

// Helper function to build full API URLs
export const getApiUrl = (endpoint) => {
  return `${config.API_BASE_URL}${config.API_ENDPOINTS[endpoint] || endpoint}`;
};

// Export configured axios client with authentication
export { default as apiClient } from './utils/axiosConfig';

export default config;
