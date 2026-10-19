/*
 * PROTOTYPE — throwaway. Production payloads captured by ../capture.sh
 * (2026-10-16, reused from prototype/header-look), served in the standalone
 * build so the home page and the Matchups slate render with no sign-in.
 *
 * With `err=1` in the hash, the slate answers a 500 with an X-Request-ID, the
 * way production fails, so the page shows a real "(ref …)" line.
 */
import { apiClient } from '../../config';
import { isFailing } from '../prototypeMode';
import players from './players.json';
import teams from './teams.json';
import slateToday from './slate-today.json';
import slate from './slate.json';
import edges from './edges.json';
import resolve from './resolve.json';
import ladderStart from './ladder-start.json';
import ladderNarrow from './ladder-narrow.json';
import ladderStack from './ladder-stack.json';

const gameLogs = (params = {}) => {
  if (params['teams_against[]']) return ladderStack;
  if (params['players_off[]']) return ladderNarrow;
  return ladderStart;
};

export const installMockApi = ({ standalone }) => {
  apiClient.interceptors.request.use((config) => {
    const url = config.url || '';
    const params = config.params || {};
    if (isFailing() && url.endsWith('/api/games/slate')) {
      config.adapter = async () => {
        const error = new Error('Request failed with status code 500');
        error.response = {
          status: 500,
          data: { error: 'Unable to load this slate. Please try again.' },
          headers: { 'x-request-id': '3f9a12bc-7d41-4e0b-9c55-0a6f1e2d4b88' },
          config,
        };
        error.config = config;
        throw error;
      };
      return config;
    }
    if (!standalone) return config;
    let data = null;
    if (url.endsWith('/api/players')) data = players;
    else if (url.endsWith('/api/teams')) data = teams;
    else if (url.endsWith('/api/games/slate')) data = params.date ? slate : slateToday;
    else if (url.endsWith('/api/games/slate/edges')) data = edges;
    else if (url.endsWith('/api/user/targets/resolve')) data = resolve;
    else if (url.endsWith('/api/games/game_logs')) data = gameLogs(params);
    if (data) {
      config.adapter = async () => ({ data, status: 200, statusText: 'OK', headers: {}, config });
    }
    return config;
  });
};
