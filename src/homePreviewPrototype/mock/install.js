/*
 * PROTOTYPE — throwaway. Captured production payloads (2026-10-14) for the
 * 2026-04-10 slate, served to the home page in the standalone build so the
 * prototype runs with no sign-in. edges.json is a digest of the fifteen
 * captured Matchups: each player's season Matchup Score for PTS/REB/AST/3PM.
 */
import { apiClient } from '../../config';
import players from './players.json';
import teams from './teams.json';
import slate from './slate.json';
import resolve from './resolve.json';

export const installMockApi = () => {
  apiClient.interceptors.request.use((config) => {
    const url = config.url || '';
    let data = null;
    if (url.endsWith('/api/players')) data = players;
    else if (url.endsWith('/api/teams')) data = teams;
    else if (url.endsWith('/api/games/slate')) data = slate;
    else if (url.endsWith('/api/user/targets/resolve')) data = resolve;
    if (data) {
      config.adapter = async () => ({ data, status: 200, statusText: 'OK', headers: {}, config });
    }
    return config;
  });
};
