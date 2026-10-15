/*
 * PROTOTYPE — throwaway. Production payloads captured 2026-10-14 by
 * ../capture.sh, served to the real Log Workspace in the standalone build so
 * the prototype runs with no sign-in. Game logs are Jalen Johnson's season
 * whatever filters are applied.
 */
import { apiClient } from '../../config';
import { SAMPLE_PLAYERS } from '../prototypeMode';
import players from './players.json';
import teams from './teams.json';
import logs from './logs.json';
import playtypes from './playtypes.json';

export const DEMO_URL = '/?player_name=Jalen+Johnson#proto=shooting&v=A';

const profile = (params = {}) => {
  if (params.category === 'Playtypes') return playtypes;
  const sample =
    Object.values(SAMPLE_PLAYERS).find(({ name }) => name === params.player_name) ||
    SAMPLE_PLAYERS['jalen-johnson'];
  if (params.category === 'Shooting Type') return sample.type;
  if (params.category === 'Zone Shooting') return sample.zone;
  return [];
};

export const installMockApi = () => {
  apiClient.interceptors.request.use((config) => {
    const url = config.url || '';
    let data = null;
    if (url.endsWith('/api/players')) data = players;
    else if (url.endsWith('/api/teams')) data = teams;
    else if (url.endsWith('/api/games/game_logs')) data = logs;
    else if (url.endsWith('/api/players/profile')) data = profile(config.params);
    else if (url.endsWith('/api/players/next-opponent'))
      data = { next_game: null, opponent_ranks: [] };
    else if (url.endsWith('/api/user/saved-filter-sets')) data = { saved_filter_sets: [] };
    else if (url.endsWith('/api/teams/stats')) data = {};
    if (data) {
      config.adapter = async () => ({ data, status: 200, statusText: 'OK', headers: {}, config });
    }
    return config;
  });
};
