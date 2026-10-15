/*
 * PROTOTYPE — throwaway. Captured production payloads (2026-10-14, borrowed
 * from prototype/home-feature-previews) so the pages under the header render
 * in the standalone build with no sign-in.
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
