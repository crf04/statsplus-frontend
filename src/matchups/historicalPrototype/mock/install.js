/*
 * PROTOTYPE — throwaway. Captured production payloads for CLE @ ORL
 * 2026-03-11 (game 0022500947), plus an upcoming-game twin built by
 * make_upcoming.py. `?demo=upcoming` serves the twin with sample lines;
 * `?demo=upcoming-bare` serves the same twin as today's contract sees it
 * (which books post which market, no line numbers).
 */
import { apiClient } from '../../../config';
import matchup from './matchup.json';
import matchupUpcoming from './matchup-upcoming.json';
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
import u1628378 from './selection-upcoming-1628378.json';
import u1628418 from './selection-upcoming-1628418.json';
import u1628975 from './selection-upcoming-1628975.json';
import u1628976 from './selection-upcoming-1628976.json';
import u1629021 from './selection-upcoming-1629021.json';
import u1629731 from './selection-upcoming-1629731.json';
import u1630217 from './selection-upcoming-1630217.json';
import u1630241 from './selection-upcoming-1630241.json';
import u1630591 from './selection-upcoming-1630591.json';
import u1630596 from './selection-upcoming-1630596.json';
import u1631094 from './selection-upcoming-1631094.json';
import u1631165 from './selection-upcoming-1631165.json';
import u1641724 from './selection-upcoming-1641724.json';
import u1641783 from './selection-upcoming-1641783.json';
import u1642281 from './selection-upcoming-1642281.json';
import u201935 from './selection-upcoming-201935.json';
import u203471 from './selection-upcoming-203471.json';

export const DEMO_GAME_ID = '0022500947';
export const DEMO_URL = `/matchups/${DEMO_GAME_ID}?v=A`;

const completed = {
  matchup,
  selections: {
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
  },
};
const upcoming = {
  matchup: matchupUpcoming,
  selections: {
    1628378: u1628378,
    1628418: u1628418,
    1628975: u1628975,
    1628976: u1628976,
    1629021: u1629021,
    1629731: u1629731,
    1630217: u1630217,
    1630241: u1630241,
    1630591: u1630591,
    1630596: u1630596,
    1631094: u1631094,
    1631165: u1631165,
    1641724: u1641724,
    1641783: u1641783,
    1642281: u1642281,
    201935: u201935,
    203471: u203471,
  },
};

export const installMockApi = () => {
  apiClient.interceptors.request.use((config) => {
    const demo = new URLSearchParams(window.location.search).get('demo') || '';
    const set = demo.startsWith('upcoming') ? upcoming : completed;
    const url = config.url || '';
    let data = null;
    if (url.endsWith('/api/games/matchup')) data = set.matchup;
    else if (url.endsWith('/api/games/matchup/selection'))
      data = set.selections[config.params?.player_id];
    if (data)
      config.adapter = async () => ({ data, status: 200, statusText: 'OK', headers: {}, config });
    return config;
  });
};
