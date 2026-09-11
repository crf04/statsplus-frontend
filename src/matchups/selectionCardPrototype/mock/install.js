/*
 * PROTOTYPE — throwaway. Captured production payloads for ATL @ CHA
 * 2026-02-11 (game 0022500775), served to the real matchup page in the
 * standalone build so the prototype runs with no sign-in.
 */
import { apiClient } from '../../../config';
import matchup from './matchup.json';
import s1629111 from './selection-1629111.json';
import s1629638 from './selection-1629638.json';
import s1629684 from './selection-1629684.json';
import s1630163 from './selection-1630163.json';
import s1630168 from './selection-1630168.json';
import s1630182 from './selection-1630182.json';
import s1630214 from './selection-1630214.json';
import s1630544 from './selection-1630544.json';
import s1630552 from './selection-1630552.json';
import s1630557 from './selection-1630557.json';
import s1630700 from './selection-1630700.json';
import s1631243 from './selection-1631243.json';
import s1641706 from './selection-1641706.json';
import s1641750 from './selection-1641750.json';
import s1641790 from './selection-1641790.json';
import s1642258 from './selection-1642258.json';
import s1642275 from './selection-1642275.json';
import s1642851 from './selection-1642851.json';
import s1642854 from './selection-1642854.json';
import s1642883 from './selection-1642883.json';
import s203468 from './selection-203468.json';

export const DEMO_GAME_ID = '0022500775';
export const DEMO_PLAYER_ID = 1630552;

const selections = {
  1629111: s1629111,
  1629638: s1629638,
  1629684: s1629684,
  1630163: s1630163,
  1630168: s1630168,
  1630182: s1630182,
  1630214: s1630214,
  1630544: s1630544,
  1630552: s1630552,
  1630557: s1630557,
  1630700: s1630700,
  1631243: s1631243,
  1641706: s1641706,
  1641750: s1641750,
  1641790: s1641790,
  1642258: s1642258,
  1642275: s1642275,
  1642851: s1642851,
  1642854: s1642854,
  1642883: s1642883,
  203468: s203468,
};

export const installMockApi = () => {
  apiClient.interceptors.request.use((config) => {
    const url = config.url || '';
    let data = null;
    if (url.endsWith('/api/games/matchup')) data = matchup;
    else if (url.endsWith('/api/games/matchup/selection'))
      data = selections[config.params?.player_id];
    if (data) {
      config.adapter = async () => ({ data, status: 200, statusText: 'OK', headers: {}, config });
    }
    return config;
  });
};
