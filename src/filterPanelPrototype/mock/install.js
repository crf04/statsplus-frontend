/*
 * PROTOTYPE — throwaway. Captured production payloads for Jalen Johnson's
 * 2025-26 season (captured 2026-09-30), served to the real Log Workspace in
 * the standalone build so the prototype runs with no sign-in.
 *
 * The game-log endpoint answers from the captured season (or the captured
 * "Trae Young off" set) and then applies the simple filters itself, so
 * Apply visibly changes the chart and table. Defensive filters are not
 * modelled: they pass through unfiltered. Saved Filter Sets are synthetic.
 */
import { apiClient } from '../../config';
import players from './players.json';
import teams from './teams.json';
import logsSeason from './logs-season.json';
import logsOff from './logs-off.json';
import profile from './profile.json';
import teamPlaytypes from './team-playtypes.json';
import teamTraditional from './team-traditional.json';
import teamChaTraditional from './team-cha-traditional.json';
import savedFilterSets from './saved-filter-sets.json';

export const DEMO_URL = '/?player_name=Jalen+Johnson&players_off%5B%5D=Trae+Young#proto=filters&v=A';

const asList = (value) => (value == null ? [] : Array.isArray(value) ? value : [value]);

const numericKeys = (row) =>
  Object.keys(row).filter((key) => typeof row[key] === 'number' && key !== 'PLAYTYPE_RTG');

const mean = (rows) => {
  if (rows.length === 0) return [];
  const out = {};
  numericKeys(rows[0]).forEach((key) => {
    out[key] = Math.round((rows.reduce((sum, row) => sum + row[key], 0) / rows.length) * 100) / 100;
  });
  return [out];
};

const gameLogs = (params = {}) => {
  const off = asList(params['players_off[]']);
  const base = off.includes('Trae Young') ? logsOff : logsSeason;
  let rows = base.game_logs;
  if (params.date_filter) rows = rows.filter((row) => row.GAME_DATE >= params.date_filter);
  if (params.location_filter === 'Home') rows = rows.filter((row) => row.MATCHUP.includes('vs.'));
  if (params.location_filter === 'Away') rows = rows.filter((row) => row.MATCHUP.includes('@'));
  if (params.minutes_filter) {
    const [lo, hi] = String(params.minutes_filter).split(',').map(Number);
    rows = rows.filter((row) => row.MIN >= lo && row.MIN <= hi);
  }
  if (params.playstyle_RTG_min != null || params.playstyle_RTG_max != null) {
    const lo = Number(params.playstyle_RTG_min ?? 0);
    const hi = Number(params.playstyle_RTG_max ?? 200);
    rows = rows.filter((row) => row.PLAYTYPE_RTG >= lo && row.PLAYTYPE_RTG <= hi);
  }
  Object.keys(params)
    .filter((key) => key.startsWith('self_filters[') && params[key])
    .forEach((key) => {
      const column = key.match(/\[(.*?)\]/)[1];
      const [lo, hi] = String(params[key]).split(',').map(Number);
      rows = rows.filter((row) => row[column] >= lo && row[column] <= hi);
    });
  if (Number(params.game_filter) > 0) rows = rows.slice(0, Number(params.game_filter));
  return { ...base, game_logs: rows, averages: mean(rows) };
};

export const installMockApi = () => {
  apiClient.interceptors.request.use((config) => {
    const url = config.url || '';
    let data = null;
    if (url.endsWith('/api/players')) data = players;
    else if (url.endsWith('/api/teams')) data = teams;
    else if (url.endsWith('/api/games/game_logs')) data = gameLogs(config.params);
    else if (url.endsWith('/api/players/profile')) data = profile;
    else if (url.endsWith('/api/teams/stats'))
      data =
        config.params?.category === 'Playtypes'
          ? teamPlaytypes
          : config.params?.team === 'Charlotte Hornets'
            ? teamChaTraditional
            : teamTraditional;
    // Synthetic saved sets (not the owner's real ones): the link is public.
    else if (url.endsWith('/api/user/saved-filter-sets') && (config.method || 'get') === 'get')
      data = savedFilterSets;
    if (data) {
      config.adapter = async () => ({ data, status: 200, statusText: 'OK', headers: {}, config });
    }
    return config;
  });
};
