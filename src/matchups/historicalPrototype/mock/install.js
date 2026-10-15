/*
 * PROTOTYPE — throwaway. Captured production payloads for CLE @ ORL
 * 2026-03-11 (game 0022500947), served to the real matchup page in the
 * standalone build so the prototype runs with no sign-in.
 */
import { apiClient } from '../../../config';
import matchup from './matchup.json';
import s1628378 from './selection-1628378.json';
import s1628418 from './selection-1628418.json';
import s1628975 from './selection-1628975.json';
import s1628976 from './selection-1628976.json';
import s1629021 from './selection-1629021.json';
import s1629731 from './selection-1629731.json';
import s1630217 from './selection-1630217.json';
import s1630241 from './selection-1630241.json';
import s1630591 from './selection-1630591.json';
import s1630596 from './selection-1630596.json';
import s1631094 from './selection-1631094.json';
import s1631165 from './selection-1631165.json';
import s1641724 from './selection-1641724.json';
import s1641783 from './selection-1641783.json';
import s1642281 from './selection-1642281.json';
import s1642869 from './selection-1642869.json';
import s201935 from './selection-201935.json';
import s203471 from './selection-203471.json';

export const DEMO_GAME_ID = '0022500947';
export const DEMO_URL = `/matchups/${DEMO_GAME_ID}?v=A`;

const selections = {
  1628378: s1628378,
  1628418: s1628418,
  1628975: s1628975,
  1628976: s1628976,
  1629021: s1629021,
  1629731: s1629731,
  1630217: s1630217,
  1630241: s1630241,
  1630591: s1630591,
  1630596: s1630596,
  1631094: s1631094,
  1631165: s1631165,
  1641724: s1641724,
  1641783: s1641783,
  1642281: s1642281,
  1642869: s1642869,
  201935: s201935,
  203471: s203471,
};

export const installMockApi = () => {
  apiClient.interceptors.request.use((config) => {
    const url = config.url || '';
    let data = null;
    if (url.endsWith('/api/games/matchup')) data = matchup;
    else if (url.endsWith('/api/games/matchup/selection'))
      data = selections[config.params?.player_id];
    if (data)
      config.adapter = async () => ({ data, status: 200, statusText: 'OK', headers: {}, config });
    return config;
  });
};
