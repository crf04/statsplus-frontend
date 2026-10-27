/*
 * PROTOTYPE — throwaway. Production responses captured 2026-10-19 (copied from
 * prototype/saved-sets-placement via round-bars) with
 * `live-shots --record`, replayed so the public link needs no sign-in.
 *
 * Each saved set's URL was captured exactly. A game-log query that was not
 * captured answers from that player's full season with the simple filters
 * applied here (last N, venue, minutes, own stat line); defensive and teammate
 * filters pass through. Saved Filter Sets live in memory: save, rename and
 * delete work until the page reloads.
 */
import { apiClient } from '../../config';
import recorded from './recorded.json';
import { STANDALONE_SETS } from './sets';

export const DEMO_URL = `/?${STANDALONE_SETS[0].query_string}#proto=shrink&v=A`;

let sets = STANDALONE_SETS.map((set) => ({ ...set }));
let nextId = sets.length + 1;

const keyOf = (config) => {
  const url = new URL(apiClient.getUri(config), window.location.origin);
  url.searchParams.sort();
  return {
    path: url.pathname,
    params: url.searchParams,
    key: `${url.pathname}?${url.searchParams}`,
  };
};

const mean = (rows) => {
  if (rows.length === 0) return [];
  const out = {};
  Object.keys(rows[0])
    .filter((key) => typeof rows[0][key] === 'number')
    .forEach((key) => {
      out[key] =
        Math.round((rows.reduce((sum, row) => sum + (row[key] || 0), 0) / rows.length) * 100) / 100;
    });
  return [out];
};

const filteredLogs = (params) => {
  const season =
    recorded[
      `/api/games/game_logs?${new URLSearchParams({ player_name: params.get('player_name') || '' })}`
    ];
  if (!season) return null;
  let rows = season.game_logs || [];
  const location = params.get('location_filter');
  if (location === 'Home') rows = rows.filter((row) => String(row.MATCHUP).includes('vs.'));
  if (location === 'Away') rows = rows.filter((row) => String(row.MATCHUP).includes('@'));
  if (params.get('minutes_filter')) {
    const [lo, hi] = params.get('minutes_filter').split(',').map(Number);
    rows = rows.filter((row) => row.MIN >= lo && row.MIN <= hi);
  }
  if (params.get('date_filter'))
    rows = rows.filter((row) => row.GAME_DATE >= params.get('date_filter'));
  [...params.keys()]
    .filter((key) => key.startsWith('self_filters['))
    .forEach((key) => {
      const column = key.match(/\[(.*?)\]/)[1];
      const [lo, hi] = params.get(key).split(',').map(Number);
      rows = rows.filter((row) => row[column] >= lo && row[column] <= hi);
    });
  if (Number(params.get('game_filter')) > 0)
    rows = rows.slice(0, Number(params.get('game_filter')));
  return { ...season, game_logs: rows, averages: mean(rows) };
};

const answer = (config) => {
  const method = (config.method || 'get').toLowerCase();
  const { path, params, key } = keyOf(config);
  if (path.startsWith('/api/user/saved-filter-sets')) {
    const id = decodeURIComponent(path.split('/')[4] || '');
    const body =
      typeof config.data === 'string' ? JSON.parse(config.data || '{}') : config.data || {};
    if (method === 'post') {
      if (sets.some((set) => set.name === body.name))
        return [409, { error: 'A saved Filter Set already has that name.' }];
      sets = [
        { id: `set-${(nextId += 1)}`, name: body.name, query_string: body.query_string },
        ...sets,
      ];
      return [201, {}];
    }
    if (method === 'patch')
      sets = sets.map((set) => (set.id === id ? { ...set, name: body.name } : set));
    if (method === 'delete') sets = sets.filter((set) => set.id !== id);
    return [200, { saved_filter_sets: sets }];
  }
  if (method !== 'get') return null;
  if (recorded[key]) return [200, recorded[key]];
  if (path === '/api/games/game_logs') {
    const logs = filteredLogs(params);
    if (logs) return [200, logs];
  }
  // Same endpoint, other query: the first capture stands in.
  const near = Object.keys(recorded).find((captured) => captured.startsWith(`${path}?`));
  return near ? [200, recorded[near]] : null;
};

export const installMockApi = () => {
  apiClient.interceptors.request.use((config) => {
    const result = answer(config);
    if (result) {
      const [status, data] = result;
      config.adapter = async () => {
        const response = { data, status, statusText: String(status), headers: {}, config };
        if (status >= 400) {
          const error = new Error(`Request failed with status code ${status}`);
          error.response = response;
          error.config = config;
          error.isAxiosError = true;
          throw error;
        }
        return response;
      };
    }
    return config;
  });
};
