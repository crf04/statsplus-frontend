/*
 * PROTOTYPE — throwaway. Production payloads captured 2026-10-15 by
 * ../capture.sh, served to the real Log Workspace in the standalone build so
 * the prototype runs with no sign-in. Team stats exist for Charlotte, OKC and
 * Utah; any other team shows Charlotte's.
 */
import { apiClient } from '../../config';
import players from './players.json';
import teams from './teams.json';
import logs from './logs.json';
import playtypes from './playtypes.json';
import charlotte_hornets_traditional from './charlotte-hornets-traditional.json';
import charlotte_hornets_playtypes from './charlotte-hornets-playtypes.json';
import charlotte_hornets_assists from './charlotte-hornets-assists.json';
import charlotte_hornets_zone_shooting from './charlotte-hornets-zone-shooting.json';
import charlotte_hornets_shooting_type from './charlotte-hornets-shooting-type.json';
import oklahoma_city_thunder_traditional from './oklahoma-city-thunder-traditional.json';
import oklahoma_city_thunder_playtypes from './oklahoma-city-thunder-playtypes.json';
import oklahoma_city_thunder_assists from './oklahoma-city-thunder-assists.json';
import oklahoma_city_thunder_zone_shooting from './oklahoma-city-thunder-zone-shooting.json';
import oklahoma_city_thunder_shooting_type from './oklahoma-city-thunder-shooting-type.json';
import utah_jazz_traditional from './utah-jazz-traditional.json';
import utah_jazz_playtypes from './utah-jazz-playtypes.json';
import utah_jazz_assists from './utah-jazz-assists.json';
import utah_jazz_zone_shooting from './utah-jazz-zone-shooting.json';
import utah_jazz_shooting_type from './utah-jazz-shooting-type.json';

const TEAM_STATS = {
  'charlotte-hornets': { 'traditional': charlotte_hornets_traditional, 'playtypes': charlotte_hornets_playtypes, 'assists': charlotte_hornets_assists, 'zone-shooting': charlotte_hornets_zone_shooting, 'shooting-type': charlotte_hornets_shooting_type },
  'oklahoma-city-thunder': { 'traditional': oklahoma_city_thunder_traditional, 'playtypes': oklahoma_city_thunder_playtypes, 'assists': oklahoma_city_thunder_assists, 'zone-shooting': oklahoma_city_thunder_zone_shooting, 'shooting-type': oklahoma_city_thunder_shooting_type },
  'utah-jazz': { 'traditional': utah_jazz_traditional, 'playtypes': utah_jazz_playtypes, 'assists': utah_jazz_assists, 'zone-shooting': utah_jazz_zone_shooting, 'shooting-type': utah_jazz_shooting_type },
};

export const DEMO_URL = '/?player_name=Jalen+Johnson#proto=team&v=A';

const slug = (s = '') => s.toLowerCase().replace(/ /g, '-');
const teamStats = ({ team, category } = {}) =>
  (TEAM_STATS[slug(team)] || TEAM_STATS['charlotte-hornets'])[slug(category)] || {};

export const installMockApi = () => {
  apiClient.interceptors.request.use((config) => {
    const url = config.url || '';
    let data = null;
    if (url.endsWith('/api/players')) data = players;
    else if (url.endsWith('/api/teams')) data = teams;
    else if (url.endsWith('/api/games/game_logs')) data = { ...logs, next_game: 'Charlotte Hornets' };
    else if (url.endsWith('/api/players/profile')) data = playtypes;
    else if (url.endsWith('/api/players/next-opponent'))
      data = { next_game: null, opponent_ranks: [] };
    else if (url.endsWith('/api/user/saved-filter-sets')) data = { saved_filter_sets: [] };
    else if (url.endsWith('/api/teams/stats')) data = teamStats(config.params);
    if (data) {
      config.adapter = async () => ({ data, status: 200, statusText: 'OK', headers: {}, config });
    }
    return config;
  });
};
