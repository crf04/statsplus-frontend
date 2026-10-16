/*
 * PROTOTYPE — throwaway. Production payloads captured by ../capture.sh
 * (2026-10-16), served in the standalone build so the home page and the
 * Matchups slate render under the header with no sign-in. Today has no
 * games, so the home page falls back to the last game day (2026-04-12).
 */
import { apiClient } from '../../config';
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

export const installMockApi = () => {
  apiClient.interceptors.request.use((config) => {
    const url = config.url || '';
    const params = config.params || {};
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
