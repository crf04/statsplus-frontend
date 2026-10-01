/*
 * Parity kit for the Log Workspace filter panel (crf04/statsplus#99).
 *
 * The prototype's verdict J (tag prototype/filter-panel-j) is the design
 * reference. This fixture serves the exact data the prototype was judged on,
 * so the real build and the prototype can be compared screen for screen:
 * Jalen Johnson's 2025-26 game logs (captured 2026-09-30), Charlotte's real
 * opponent ranks as the `/api/players/next-opponent` response the spec
 * defines, and synthetic Saved Filter Sets.
 *
 * The prototype's standalone build answers these requests itself and ignores
 * the routes; the real build is served entirely from them.
 */
import players from './data/players.json';
import teams from './data/teams.json';
import logsSeason from './data/logs-season.json';
import logsOff from './data/logs-off.json';
import profile from './data/profile.json';
import teamPlaytypes from './data/team-playtypes.json';
import teamTraditional from './data/team-traditional.json';
import teamChaTraditional from './data/team-cha-traditional.json';
import savedFilterSets from './data/saved-filter-sets.json';
import nextOpponent from './data/next-opponent.json';

export const PARITY_PATH =
  '/?player_name=Jalen+Johnson&players_off%5B%5D=Trae+Young&game_filter=10';

const asList = (value) => (value == null ? [] : Array.isArray(value) ? value : [value]);

const mean = (rows) => {
  if (rows.length === 0) return [];
  const out = {};
  Object.keys(rows[0])
    .filter((key) => typeof rows[0][key] === 'number' && key !== 'PLAYTYPE_RTG')
    .forEach((key) => {
      out[key] =
        Math.round((rows.reduce((sum, row) => sum + row[key], 0) / rows.length) * 100) / 100;
    });
  return [out];
};

// The same simplified filtering the prototype applied to the captured season.
const gameLogs = (params) => {
  const base = asList(params.getAll('players_off[]')).includes('Trae Young') ? logsOff : logsSeason;
  let rows = base.game_logs;
  const date = params.get('date_filter');
  if (date) rows = rows.filter((row) => row.GAME_DATE >= date);
  const location = params.get('location_filter');
  if (location === 'Home') rows = rows.filter((row) => row.MATCHUP.includes('vs.'));
  if (location === 'Away') rows = rows.filter((row) => row.MATCHUP.includes('@'));
  const minutes = params.get('minutes_filter');
  if (minutes) {
    const [lo, hi] = minutes.split(',').map(Number);
    rows = rows.filter((row) => row.MIN >= lo && row.MIN <= hi);
  }
  if (params.has('playstyle_RTG_min') || params.has('playstyle_RTG_max')) {
    const lo = Number(params.get('playstyle_RTG_min') ?? 0);
    const hi = Number(params.get('playstyle_RTG_max') ?? 200);
    rows = rows.filter((row) => row.PLAYTYPE_RTG >= lo && row.PLAYTYPE_RTG <= hi);
  }
  for (const [key, value] of params.entries()) {
    const match = key.match(/^self_filters\[(.*)\]$/);
    if (match && value) {
      const [lo, hi] = value.split(',').map(Number);
      rows = rows.filter((row) => row[match[1]] >= lo && row[match[1]] <= hi);
    }
  }
  const games = Number(params.get('game_filter'));
  if (games > 0) rows = rows.slice(0, games);
  return { ...base, game_logs: rows, averages: mean(rows) };
};

export const installParityApi = async (page) => {
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    let json = null;
    if (path === '/api/players') json = players;
    else if (path === '/api/teams') json = teams;
    else if (path === '/api/games/game_logs') json = gameLogs(url.searchParams);
    else if (path === '/api/players/profile') json = profile;
    else if (path === '/api/players/next-opponent') json = nextOpponent;
    else if (path === '/api/teams/stats') {
      const category = url.searchParams.get('category');
      const team = url.searchParams.get('team');
      json =
        category === 'Playtypes'
          ? teamPlaytypes
          : team === 'Charlotte Hornets'
            ? teamChaTraditional
            : teamTraditional;
    } else if (path === '/api/user/saved-filter-sets' && request.method() === 'GET') {
      json = savedFilterSets;
    }
    if (json) await route.fulfill({ json });
    else await route.fulfill({ status: 501, json: { error: `Parity kit has no ${path}` } });
  });
};
