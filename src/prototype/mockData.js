// THROWAWAY PROTOTYPE DATA — wayfinder crf04/statsplus#7.
// Hand-authored mock for one game (BOS @ NYK). Shapes mirror what the backend
// already stores (see crf04/statsplus#3 stats inventory digest); numbers are
// plausible fiction. Rank semantics: 1 = allows least (tough matchup),
// 30 = allows most (juicy matchup) — same ramp RankCube renders red -> green.

export const GAME = {
  id: '0022501187',
  away: { tri: 'BOS', name: 'Boston Celtics' },
  home: { tri: 'NYK', name: 'New York Knicks' },
  tipUtc: '2026-04-11T23:30:00Z',
  status: 'Scheduled',
  classification: null,
};

// Pool snapshot per the player-pool contract (#5): union of boards, provenance
// kept, partial board failure shrinks the union honestly.
export const POOL_META = {
  retrievedAtLabel: '7 min ago',
  maxAgeMinutes: 15,
  boards: { PP: 'ok', UD: 'ok', DAB: 'unavailable' },
};

export const PLAY_TYPES = [
  'Isolation',
  'Transition',
  'P&R Ball-Handler',
  'P&R Roll Man',
  'Post-Up',
  'Spot-Up',
  'Handoff',
  'Cut',
  'Off-Screen',
  'Putbacks',
  'Misc',
];

export const ZONES = ['Restricted Area', 'Paint (Non-RA)', 'Mid-Range', 'Corner 3', 'Above Break 3'];
export const SHOT_TYPES = ['Catch & Shoot', 'Pull-Up', '< 10 ft'];
export const ASSIST_LOCS = ['Rim', 'Corner 3', 'Arc 3', 'Mid-Range'];

// League-average baselines so every allowed stat can render raw + vs-avg.
// Traditional and shot types already carry vsAvg on their rows.
export const LEAGUE_AVG = {
  playTypes: {
    Isolation: 0.91,
    Transition: 1.08,
    'P&R Ball-Handler': 0.94,
    'P&R Roll Man': 1.1,
    'Post-Up': 1.0,
    'Spot-Up': 1.0,
    Handoff: 0.92,
    Cut: 1.3,
    'Off-Screen': 1.03,
    Putbacks: 1.13,
    Misc: 0.96,
  },
  zones: {
    'Restricted Area': 65.4,
    'Paint (Non-RA)': 44.9,
    'Mid-Range': 41.8,
    'Corner 3': 38.1,
    'Above Break 3': 35.6,
  },
  assistLoc: { Rim: 17.1, 'Corner 3': 3.3, 'Arc 3': 7.2, 'Mid-Range': 3.3 },
};

export const vsAvg = (value, avg, digits = 1) => {
  const d = value - avg;
  return `${d >= 0 ? '+' : ''}${d.toFixed(digits)}`;
};

// League base volumes per game, used to derive points-and-volume lines from
// the stored efficiency stats (round 6: points + volume lead the categories).
const PLAYTYPE_BASE_POSS = {
  Isolation: 7.5,
  Transition: 16.2,
  'P&R Ball-Handler': 18.4,
  'P&R Roll Man': 7.1,
  'Post-Up': 4.4,
  'Spot-Up': 18.1,
  Handoff: 4.6,
  Cut: 7.2,
  'Off-Screen': 4.1,
  Putbacks: 6.3,
  Misc: 5.2,
};
const ZONE_BASE_FGA = {
  'Restricted Area': 28.4,
  'Paint (Non-RA)': 15.2,
  'Mid-Range': 11.8,
  'Corner 3': 8.9,
  'Above Break 3': 30.1,
};
const SHOTTYPE_BASE_FGA = { 'Catch & Shoot': 27.4, 'Pull-Up': 21.8, '< 10 ft': 24.2 };
const ZONE_PT_VALUE = {
  'Restricted Area': 2,
  'Paint (Non-RA)': 2,
  'Mid-Range': 2,
  'Corner 3': 3,
  'Above Break 3': 3,
};

const round1 = (n) => Math.round(n * 10) / 10;
const round2 = (n) => Math.round(n * 100) / 100;
const clampRank = (r) => Math.max(1, Math.min(30, r));

// Round 11 — recency window. L15 defense derives deterministically from the
// season numbers: storied overrides plus a small hash jitter, so the toggle
// shows real movement (e.g. NYK's PnR defense has gotten worse lately).
const L15_OVERRIDES = {
  'NYK|playTypes|P&R Ball-Handler': 0.09,
  'NYK|playTypes|Isolation': -0.05,
  'NYK|zones|Above Break 3': 0.06,
  'NYK|shotTypes|Pull-Up': 0.07,
  'BOS|playTypes|Cut': 0.08,
  'BOS|zones|Restricted Area': 0.05,
  'BOS|traditional|OPP_REB': 0.04,
};
const l15Shift = (tri, cat, label) => {
  const key = `${tri}|${cat}|${label}`;
  if (key in L15_OVERRIDES) return L15_OVERRIDES[key];
  let h = 0;
  for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) % 997;
  return (h / 997 - 0.5) * 0.08;
};

const l15Cache = {};
export function defenseFor(tri, window = 'Season') {
  if (window !== 'L15') return DEFENSE[tri];
  if (l15Cache[tri]) return l15Cache[tri];
  const s = DEFENSE[tri];
  const derived = {
    traditional: s.traditional.map((r) => {
      const sh = l15Shift(tri, 'traditional', r.stat);
      const value = round1(r.value * (1 + sh / 2));
      return { ...r, value, vsAvg: round1(value - (r.value - r.vsAvg)), rank: clampRank(r.rank + Math.round(sh * 40)) };
    }),
    playTypes: Object.fromEntries(
      Object.entries(s.playTypes).map(([type, d]) => {
        const sh = l15Shift(tri, 'playTypes', type);
        return [type, { ppp: round2(d.ppp * (1 + sh)), rank: clampRank(d.rank + Math.round(sh * 40)) }];
      }),
    ),
    zones: Object.fromEntries(
      Object.entries(s.zones).map(([zone, d]) => {
        const sh = l15Shift(tri, 'zones', zone);
        return [zone, { fgPct: round1(d.fgPct * (1 + sh / 2)), rank: clampRank(d.rank + Math.round(sh * 40)) }];
      }),
    ),
    shotTypes: Object.fromEntries(
      Object.entries(s.shotTypes).map(([type, d]) => {
        const sh = l15Shift(tri, 'shotTypes', type);
        const efg = round1(d.efg * (1 + sh / 2));
        return [type, { efg, vsAvg: round1(efg - (d.efg - d.vsAvg)), rank: clampRank(d.rank + Math.round(sh * 40)) }];
      }),
    ),
    assistLoc: Object.fromEntries(
      Object.entries(s.assistLoc).map(([loc, d]) => {
        const sh = l15Shift(tri, 'assistLoc', loc);
        return [loc, { perGame: round1(d.perGame * (1 + sh)), rank: clampRank(d.rank + Math.round(sh * 40)) }];
      }),
    ),
  };
  l15Cache[tri] = derived;
  return derived;
}

// Round 11 — injuries wanted on this page. Includes a non-pool player whose
// absence changes the matchup (rim protection), not just pool members.
export const INJURIES = {
  NYK: [
    { player: 'Mitchell Robinson', status: 'OUT', note: 'knee — rim protection down' },
    { player: 'Josh Hart', status: 'GTD', note: 'ankle' },
  ],
  BOS: [{ player: 'Jrue Holiday', status: 'OUT', note: 'hamstring' }],
};

// Percent-vs-league-average, the comparison language for every stat line.
export const pctVs = (value, avg) => {
  const p = ((value - avg) / avg) * 100;
  return `${p >= 0 ? '+' : ''}${Math.round(p)}% vs avg`;
};

export function defPlayTypeVolume(tri, type, window = 'Season') {
  const d = defenseFor(tri, window).playTypes[type];
  const avgPpp = LEAGUE_AVG.playTypes[type];
  const possG = round1(PLAYTYPE_BASE_POSS[type] * (1 + (d.rank - 15.5) * 0.012));
  const ptsG = round1(possG * d.ppp);
  return {
    possG,
    ptsG,
    ptsPct: pctVs(ptsG, PLAYTYPE_BASE_POSS[type] * avgPpp),
    pppPct: pctVs(d.ppp, avgPpp),
  };
}

export function defZoneVolume(tri, zone, window = 'Season') {
  const d = defenseFor(tri, window).zones[zone];
  const base = ZONE_BASE_FGA[zone];
  const fgaG = round1(base * (1 + (d.rank - 15.5) * 0.012));
  const ptsG = round1((fgaG * d.fgPct * ZONE_PT_VALUE[zone]) / 100);
  return {
    fgaG,
    ptsG,
    ptsPct: pctVs(ptsG, (base * LEAGUE_AVG.zones[zone] * ZONE_PT_VALUE[zone]) / 100),
    fgaPct: pctVs(fgaG, base),
  };
}

export function defShotTypeVolume(tri, type, window = 'Season') {
  const d = defenseFor(tri, window).shotTypes[type];
  const base = SHOTTYPE_BASE_FGA[type];
  const avgEfg = d.efg - d.vsAvg;
  const fgaG = round1(base * (1 + (d.rank - 15.5) * 0.012));
  const ptsG = round1((fgaG * d.efg * 2) / 100);
  return {
    fgaG,
    ptsG,
    ptsPct: pctVs(ptsG, (base * avgEfg * 2) / 100),
    fgaPct: pctVs(fgaG, base),
  };
}

export function playerPlayTypeVolume(player, pt) {
  const totalPoss = player.season.pts / 1.12;
  const possG = round1((pt.freq / 100) * totalPoss);
  return { possG, ptsG: round1(possG * pt.ppp) };
}

export function playerZoneVolume(player, z) {
  const totalFga = player.shotTypes.reduce((sum, st) => sum + st.fga, 0);
  const fgaG = round1((z.share / 100) * totalFga);
  return { fgaG, ptsG: round1((fgaG * z.fgPct * ZONE_PT_VALUE[z.zone]) / 100) };
}

export function playerShotTypeVolume(st) {
  return { fgaG: st.fga, ptsG: round1((st.fga * st.efg * 2) / 100) };
}

// What each defense allows, across the five stored categories.
export const DEFENSE = {
  NYK: {
    traditional: [
      { stat: 'OPP_PTS', value: 117.8, rank: 22, vsAvg: 2.4 },
      { stat: 'OPP_REB', value: 44.1, rank: 14, vsAvg: 0.2 },
      { stat: 'OPP_AST', value: 27.9, rank: 25, vsAvg: 1.8 },
      { stat: 'OPP_3PM', value: 14.6, rank: 28, vsAvg: 1.7 },
      { stat: 'OPP_3PA', value: 39.8, rank: 27, vsAvg: 2.9 },
      { stat: 'OPP_FTA', value: 21.6, rank: 8, vsAvg: -1.2 },
      { stat: 'OPP_TOV', value: 14.9, rank: 20, vsAvg: 0.6 },
      { stat: 'OPP_STL', value: 7.2, rank: 11, vsAvg: -0.3 },
      { stat: 'OPP_BLK', value: 4.6, rank: 9, vsAvg: -0.4 },
    ],
    playTypes: {
      Isolation: { ppp: 0.94, rank: 19 },
      Transition: { ppp: 1.12, rank: 16 },
      'P&R Ball-Handler': { ppp: 0.99, rank: 27 },
      'P&R Roll Man': { ppp: 1.08, rank: 13 },
      'Post-Up': { ppp: 0.98, rank: 15 },
      'Spot-Up': { ppp: 1.04, rank: 26 },
      Handoff: { ppp: 0.95, rank: 22 },
      Cut: { ppp: 1.28, rank: 18 },
      'Off-Screen': { ppp: 1.09, rank: 24 },
      Putbacks: { ppp: 1.11, rank: 12 },
      Misc: { ppp: 0.98, rank: 14 },
    },
    zones: {
      'Restricted Area': { fgPct: 64.1, rank: 8 },
      'Paint (Non-RA)': { fgPct: 44.8, rank: 17 },
      'Mid-Range': { fgPct: 42.9, rank: 21 },
      'Corner 3': { fgPct: 39.2, rank: 25 },
      'Above Break 3': { fgPct: 36.8, rank: 27 },
    },
    shotTypes: {
      'Catch & Shoot': { efg: 56.9, rank: 26, vsAvg: 2.1 },
      'Pull-Up': { efg: 47.8, rank: 24, vsAvg: 1.6 },
      '< 10 ft': { efg: 58.3, rank: 10, vsAvg: -0.9 },
    },
    assistLoc: {
      Rim: { perGame: 17.8, rank: 21 },
      'Corner 3': { perGame: 3.9, rank: 26 },
      'Arc 3': { perGame: 8.1, rank: 24 },
      'Mid-Range': { perGame: 3.2, rank: 13 },
    },
  },
  BOS: {
    traditional: [
      { stat: 'OPP_PTS', value: 110.2, rank: 5, vsAvg: -3.9 },
      { stat: 'OPP_REB', value: 45.9, rank: 22, vsAvg: 1.1 },
      { stat: 'OPP_AST', value: 24.1, rank: 4, vsAvg: -2.4 },
      { stat: 'OPP_3PM', value: 11.9, rank: 3, vsAvg: -1.9 },
      { stat: 'OPP_3PA', value: 35.1, rank: 6, vsAvg: -2.2 },
      { stat: 'OPP_FTA', value: 23.9, rank: 21, vsAvg: 1.3 },
      { stat: 'OPP_TOV', value: 13.1, rank: 8, vsAvg: -0.9 },
      { stat: 'OPP_STL', value: 6.9, rank: 8, vsAvg: -0.5 },
      { stat: 'OPP_BLK', value: 5.8, rank: 24, vsAvg: 0.8 },
    ],
    playTypes: {
      Isolation: { ppp: 0.87, rank: 6 },
      Transition: { ppp: 1.02, rank: 5 },
      'P&R Ball-Handler': { ppp: 0.9, rank: 9 },
      'P&R Roll Man': { ppp: 1.14, rank: 23 },
      'Post-Up': { ppp: 1.06, rank: 24 },
      'Spot-Up': { ppp: 0.96, rank: 8 },
      Handoff: { ppp: 0.9, rank: 10 },
      Cut: { ppp: 1.34, rank: 26 },
      'Off-Screen': { ppp: 0.98, rank: 9 },
      Putbacks: { ppp: 1.16, rank: 22 },
      Misc: { ppp: 0.94, rank: 8 },
    },
    zones: {
      'Restricted Area': { fgPct: 67.2, rank: 24 },
      'Paint (Non-RA)': { fgPct: 46.1, rank: 22 },
      'Mid-Range': { fgPct: 40.1, rank: 9 },
      'Corner 3': { fgPct: 35.8, rank: 7 },
      'Above Break 3': { fgPct: 34.2, rank: 4 },
    },
    shotTypes: {
      'Catch & Shoot': { efg: 50.1, rank: 5, vsAvg: -2.7 },
      'Pull-Up': { efg: 44.9, rank: 9, vsAvg: -1.1 },
      '< 10 ft': { efg: 60.9, rank: 23, vsAvg: 1.8 },
    },
    assistLoc: {
      Rim: { perGame: 19.4, rank: 26 },
      'Corner 3': { perGame: 2.8, rank: 6 },
      'Arc 3': { perGame: 6.4, rank: 7 },
      'Mid-Range': { perGame: 3.6, rank: 18 },
    },
  },
};

// Targetable players per the pool contract (#5): >= 1 qualifying market on any
// board, keyed to canonical players, provenance per board.
export const PLAYERS = [
  {
    id: 1,
    name: 'Jayson Tatum',
    team: 'BOS',
    pos: 'F',
    archetype: 'Perimeter Shot Creator',
    season: { min: 36.2, pts: 27.4, reb: 8.6, ast: 5.1, fg3m: 3.2 },
    boards: { PP: ['PTS', 'REB', 'AST', '3PM', 'PRA'], UD: ['PTS', 'REB', 'AST', 'PRA', 'FGA'], DAB: [] },
    playTypes: [
      { type: 'Isolation', freq: 21.8, ppp: 1.02 },
      { type: 'P&R Ball-Handler', freq: 19.5, ppp: 0.98 },
      { type: 'Spot-Up', freq: 14.2, ppp: 1.11 },
      { type: 'Transition', freq: 13.0, ppp: 1.19 },
      { type: 'Post-Up', freq: 7.6, ppp: 1.04 },
    ],
    zones: [
      { zone: 'Above Break 3', share: 33.8, fgPct: 36.9 },
      { zone: 'Restricted Area', share: 24.1, fgPct: 68.2 },
      { zone: 'Mid-Range', share: 18.9, fgPct: 44.1 },
      { zone: 'Paint (Non-RA)', share: 14.7, fgPct: 47.3 },
      { zone: 'Corner 3', share: 8.5, fgPct: 41.2 },
    ],
    shotTypes: [
      { type: 'Pull-Up', fga: 9.4, efg: 49.8 },
      { type: '< 10 ft', fga: 7.1, efg: 63.4 },
      { type: 'Catch & Shoot', fga: 5.6, efg: 59.2 },
    ],
    assistLoc: { Rim: 2.3, 'Corner 3': 1.0, 'Arc 3': 1.4, 'Mid-Range': 0.6 },
    minutes: [37, 36, 38, 35, 36, 37, 36, 38, 36, 37],
    vsOpp: [{ date: 'Jan 8', min: 37, pts: 32, reb: 9, ast: 5, fg3m: 3 }, { date: 'Feb 26', min: 36, pts: 28, reb: 7, ast: 6, fg3m: 2 }, { date: 'Mar 30', min: 39, pts: 41, reb: 11, ast: 4, fg3m: 5 }],
  },
  {
    id: 2,
    name: 'Jaylen Brown',
    team: 'BOS',
    pos: 'G-F',
    archetype: 'Slashing Wing',
    season: { min: 34.8, pts: 24.1, reb: 6.3, ast: 3.8, fg3m: 2.2 },
    boards: { PP: ['PTS', 'REB', 'PRA'], UD: ['PTS', 'AST'], DAB: [] },
    playTypes: [
      { type: 'Transition', freq: 18.9, ppp: 1.15 },
      { type: 'Isolation', freq: 16.2, ppp: 0.96 },
      { type: 'P&R Ball-Handler', freq: 14.8, ppp: 0.92 },
      { type: 'Spot-Up', freq: 13.5, ppp: 1.02 },
      { type: 'Post-Up', freq: 8.8, ppp: 1.01 },
    ],
    zones: [
      { zone: 'Restricted Area', share: 31.2, fgPct: 66.9 },
      { zone: 'Above Break 3', share: 24.8, fgPct: 34.6 },
      { zone: 'Mid-Range', share: 21.4, fgPct: 43.8 },
      { zone: 'Paint (Non-RA)', share: 13.9, fgPct: 45.2 },
      { zone: 'Corner 3', share: 6.1, fgPct: 37.8 },
    ],
    shotTypes: [
      { type: '< 10 ft', fga: 8.3, efg: 61.2 },
      { type: 'Pull-Up', fga: 7.2, efg: 46.1 },
      { type: 'Catch & Shoot', fga: 4.4, efg: 55.3 },
    ],
    assistLoc: { Rim: 1.8, 'Corner 3': 0.6, 'Arc 3': 0.8, 'Mid-Range': 0.5 },
    minutes: [35, 34, 36, 33, 35, 34, 36, 35, 34, 35],
    vsOpp: [{ date: 'Jan 8', min: 35, pts: 22, reb: 5, ast: 3, fg3m: 1 }, { date: 'Feb 26', min: 36, pts: 27, reb: 8, ast: 4, fg3m: 3 }, { date: 'Mar 30', min: 33, pts: 19, reb: 6, ast: 5, fg3m: 2 }],
  },
  {
    id: 3,
    name: 'Derrick White',
    team: 'BOS',
    pos: 'G',
    archetype: 'Movement Shooter',
    season: { min: 33.1, pts: 17.2, reb: 4.4, ast: 4.9, fg3m: 3.1 },
    boards: { PP: ['PTS', '3PM', 'AST'], UD: ['PTS', '3PM', 'FG3A'], DAB: [] },
    playTypes: [
      { type: 'P&R Ball-Handler', freq: 24.6, ppp: 1.01 },
      { type: 'Spot-Up', freq: 22.1, ppp: 1.14 },
      { type: 'Transition', freq: 12.4, ppp: 1.21 },
      { type: 'Handoff', freq: 8.9, ppp: 1.05 },
    ],
    zones: [
      { zone: 'Above Break 3', share: 41.2, fgPct: 38.4 },
      { zone: 'Restricted Area', share: 22.6, fgPct: 61.8 },
      { zone: 'Corner 3', share: 9.8, fgPct: 42.0 },
      { zone: 'Mid-Range', share: 13.1, fgPct: 41.6 },
      { zone: 'Paint (Non-RA)', share: 13.3, fgPct: 44.9 },
    ],
    shotTypes: [
      { type: 'Catch & Shoot', fga: 6.8, efg: 61.8 },
      { type: 'Pull-Up', fga: 5.3, efg: 48.2 },
      { type: '< 10 ft', fga: 4.1, efg: 58.7 },
    ],
    assistLoc: { Rim: 1.9, 'Corner 3': 0.8, 'Arc 3': 1.1, 'Mid-Range': 0.4 },
    minutes: [32, 33, 34, 33, 35, 34, 35, 36, 36, 37],
    vsOpp: [{ date: 'Jan 8', min: 33, pts: 15, reb: 4, ast: 6, fg3m: 3 }, { date: 'Feb 26', min: 34, pts: 21, reb: 3, ast: 5, fg3m: 5 }, { date: 'Mar 30', min: 35, pts: 12, reb: 5, ast: 7, fg3m: 2 }],
  },
  {
    id: 4,
    name: 'Kristaps Porzingis',
    team: 'BOS',
    pos: 'C',
    archetype: 'Stretch Big',
    season: { min: 29.4, pts: 20.3, reb: 7.1, ast: 1.9, fg3m: 2.4 },
    boards: { PP: ['PTS', 'REB', '3PM'], UD: ['PTS', 'REB', 'PRA'], DAB: [] },
    playTypes: [
      { type: 'P&R Roll Man', freq: 20.1, ppp: 1.12 },
      { type: 'Post-Up', freq: 18.4, ppp: 1.08 },
      { type: 'Spot-Up', freq: 17.8, ppp: 1.18 },
      { type: 'Putbacks', freq: 7.2, ppp: 1.14 },
    ],
    zones: [
      { zone: 'Above Break 3', share: 30.4, fgPct: 37.8 },
      { zone: 'Restricted Area', share: 28.9, fgPct: 72.1 },
      { zone: 'Paint (Non-RA)', share: 16.2, fgPct: 51.0 },
      { zone: 'Mid-Range', share: 15.4, fgPct: 45.7 },
      { zone: 'Corner 3', share: 9.1, fgPct: 36.4 },
    ],
    shotTypes: [
      { type: '< 10 ft', fga: 6.8, efg: 66.2 },
      { type: 'Catch & Shoot', fga: 5.9, efg: 60.4 },
      { type: 'Pull-Up', fga: 2.1, efg: 41.3 },
    ],
    assistLoc: { Rim: 0.7, 'Corner 3': 0.3, 'Arc 3': 0.4, 'Mid-Range': 0.3 },
    minutes: [31, 29, 30, 26, 28, 30, 27, 29, 28, 26],
    vsOpp: [{ date: 'Jan 8', min: 30, pts: 24, reb: 8, ast: 1, fg3m: 3 }, { date: 'Mar 30', min: 27, pts: 16, reb: 6, ast: 2, fg3m: 1 }],
  },
  {
    id: 5,
    name: 'Payton Pritchard',
    team: 'BOS',
    pos: 'G',
    archetype: 'Movement Shooter',
    season: { min: 27.2, pts: 14.8, reb: 3.6, ast: 3.4, fg3m: 3.0 },
    boards: { PP: ['PTS', '3PM', 'FG3A'], UD: ['3PM'], DAB: [] },
    playTypes: [
      { type: 'Spot-Up', freq: 26.2, ppp: 1.16 },
      { type: 'P&R Ball-Handler', freq: 18.1, ppp: 0.94 },
      { type: 'Transition', freq: 14.6, ppp: 1.24 },
      { type: 'Handoff', freq: 10.2, ppp: 1.08 },
    ],
    zones: [
      { zone: 'Above Break 3', share: 44.6, fgPct: 39.1 },
      { zone: 'Restricted Area', share: 18.2, fgPct: 58.9 },
      { zone: 'Corner 3', share: 10.4, fgPct: 43.1 },
      { zone: 'Mid-Range', share: 12.6, fgPct: 42.2 },
      { zone: 'Paint (Non-RA)', share: 14.2, fgPct: 43.8 },
    ],
    shotTypes: [
      { type: 'Catch & Shoot', fga: 6.1, efg: 62.4 },
      { type: 'Pull-Up', fga: 4.8, efg: 47.1 },
      { type: '< 10 ft', fga: 2.9, efg: 55.2 },
    ],
    assistLoc: { Rim: 1.2, 'Corner 3': 0.5, 'Arc 3': 0.9, 'Mid-Range': 0.3 },
    minutes: [24, 25, 26, 27, 26, 28, 29, 28, 30, 31],
    vsOpp: [{ date: 'Jan 8', min: 22, pts: 11, reb: 2, ast: 3, fg3m: 3 }, { date: 'Feb 26', min: 27, pts: 18, reb: 4, ast: 2, fg3m: 4 }, { date: 'Mar 30', min: 29, pts: 14, reb: 3, ast: 4, fg3m: 2 }],
  },
  {
    id: 6,
    name: 'Sam Hauser',
    team: 'BOS',
    pos: 'F',
    archetype: 'Spot-Up Specialist',
    season: { min: 22.1, pts: 8.9, reb: 3.4, ast: 1.1, fg3m: 2.3 },
    boards: { PP: ['3PM', 'PTS', 'FG3A'], UD: [], DAB: [] },
    playTypes: [
      { type: 'Spot-Up', freq: 48.2, ppp: 1.19 },
      { type: 'Transition', freq: 12.1, ppp: 1.18 },
      { type: 'Off-Screen', freq: 10.8, ppp: 1.06 },
    ],
    zones: [
      { zone: 'Above Break 3', share: 52.1, fgPct: 38.2 },
      { zone: 'Corner 3', share: 21.8, fgPct: 41.9 },
      { zone: 'Restricted Area', share: 12.4, fgPct: 62.1 },
      { zone: 'Mid-Range', share: 7.2, fgPct: 39.8 },
      { zone: 'Paint (Non-RA)', share: 6.5, fgPct: 41.2 },
    ],
    shotTypes: [
      { type: 'Catch & Shoot', fga: 6.9, efg: 63.1 },
      { type: 'Pull-Up', fga: 1.2, efg: 42.6 },
      { type: '< 10 ft', fga: 1.1, efg: 57.4 },
    ],
    assistLoc: { Rim: 0.4, 'Corner 3': 0.2, 'Arc 3': 0.3, 'Mid-Range': 0.2 },
    minutes: [23, 21, 22, 24, 20, 22, 21, 19, 20, 18],
    vsOpp: [{ date: 'Feb 26', min: 19, pts: 9, reb: 3, ast: 0, fg3m: 3 }],
  },
  {
    id: 7,
    name: 'Jalen Brunson',
    team: 'NYK',
    pos: 'G',
    archetype: 'Pick-and-Roll Maestro',
    season: { min: 35.6, pts: 28.1, reb: 3.7, ast: 6.8, fg3m: 2.6 },
    boards: { PP: ['PTS', 'AST', 'PRA', '3PM', 'FGA'], UD: ['PTS', 'AST', 'PA'], DAB: [] },
    playTypes: [
      { type: 'P&R Ball-Handler', freq: 34.8, ppp: 1.04 },
      { type: 'Isolation', freq: 18.2, ppp: 1.06 },
      { type: 'Post-Up', freq: 8.1, ppp: 1.02 },
      { type: 'Spot-Up', freq: 7.4, ppp: 1.03 },
    ],
    zones: [
      { zone: 'Mid-Range', share: 28.4, fgPct: 47.2 },
      { zone: 'Restricted Area', share: 26.1, fgPct: 59.8 },
      { zone: 'Above Break 3', share: 22.8, fgPct: 36.1 },
      { zone: 'Paint (Non-RA)', share: 16.9, fgPct: 46.8 },
      { zone: 'Corner 3', share: 5.8, fgPct: 39.2 },
    ],
    shotTypes: [
      { type: 'Pull-Up', fga: 10.8, efg: 50.6 },
      { type: '< 10 ft', fga: 6.9, efg: 54.2 },
      { type: 'Catch & Shoot', fga: 2.4, efg: 57.8 },
    ],
    assistLoc: { Rim: 3.1, 'Corner 3': 1.1, 'Arc 3': 1.6, 'Mid-Range': 0.8 },
    minutes: [36, 35, 37, 36, 34, 36, 35, 37, 36, 36],
    vsOpp: [{ date: 'Dec 12', min: 36, pts: 18, reb: 3, ast: 7, fg3m: 1 }, { date: 'Feb 4', min: 38, pts: 29, reb: 4, ast: 8, fg3m: 3 }, { date: 'Apr 2', min: 35, pts: 24, reb: 2, ast: 6, fg3m: 2 }],
  },
  {
    id: 8,
    name: 'Karl-Anthony Towns',
    team: 'NYK',
    pos: 'C',
    archetype: 'Post Scorer / Stretch Big',
    season: { min: 34.1, pts: 24.6, reb: 12.8, ast: 3.1, fg3m: 2.0 },
    boards: { PP: ['PTS', 'REB', 'PRA', '3PM'], UD: ['PTS', 'REB', 'RA', 'FGA'], DAB: [] },
    playTypes: [
      { type: 'Post-Up', freq: 19.6, ppp: 1.09 },
      { type: 'P&R Roll Man', freq: 17.2, ppp: 1.16 },
      { type: 'Spot-Up', freq: 16.4, ppp: 1.12 },
      { type: 'Putbacks', freq: 8.4, ppp: 1.21 },
      { type: 'Transition', freq: 8.0, ppp: 1.14 },
    ],
    zones: [
      { zone: 'Restricted Area', share: 30.2, fgPct: 69.4 },
      { zone: 'Above Break 3', share: 26.1, fgPct: 40.2 },
      { zone: 'Paint (Non-RA)', share: 17.8, fgPct: 48.9 },
      { zone: 'Mid-Range', share: 16.7, fgPct: 46.1 },
      { zone: 'Corner 3', share: 9.2, fgPct: 41.8 },
    ],
    shotTypes: [
      { type: '< 10 ft', fga: 8.2, efg: 64.8 },
      { type: 'Catch & Shoot', fga: 4.8, efg: 62.1 },
      { type: 'Pull-Up', fga: 3.6, efg: 44.9 },
    ],
    assistLoc: { Rim: 1.1, 'Corner 3': 0.5, 'Arc 3': 0.8, 'Mid-Range': 0.4 },
    minutes: [34, 35, 33, 34, 36, 34, 35, 33, 34, 35],
    vsOpp: [{ date: 'Dec 12', min: 35, pts: 27, reb: 14, ast: 2, fg3m: 2 }, { date: 'Feb 4', min: 33, pts: 22, reb: 11, ast: 4, fg3m: 1 }, { date: 'Apr 2', min: 36, pts: 31, reb: 15, ast: 3, fg3m: 3 }],
  },
  {
    id: 9,
    name: 'Mikal Bridges',
    team: 'NYK',
    pos: 'F',
    archetype: '3&D Wing',
    season: { min: 36.8, pts: 17.8, reb: 4.1, ast: 3.4, fg3m: 2.7 },
    boards: { PP: ['PTS', '3PM'], UD: ['PTS', '3PM', 'PRA'], DAB: [] },
    playTypes: [
      { type: 'Spot-Up', freq: 22.4, ppp: 1.08 },
      { type: 'Off-Screen', freq: 14.2, ppp: 1.02 },
      { type: 'Transition', freq: 13.8, ppp: 1.12 },
      { type: 'P&R Ball-Handler', freq: 12.6, ppp: 0.94 },
      { type: 'Cut', freq: 8.9, ppp: 1.31 },
    ],
    zones: [
      { zone: 'Above Break 3', share: 32.1, fgPct: 36.8 },
      { zone: 'Restricted Area', share: 24.6, fgPct: 63.2 },
      { zone: 'Mid-Range', share: 19.8, fgPct: 44.6 },
      { zone: 'Corner 3', share: 11.2, fgPct: 40.8 },
      { zone: 'Paint (Non-RA)', share: 12.3, fgPct: 43.1 },
    ],
    shotTypes: [
      { type: 'Catch & Shoot', fga: 5.9, efg: 58.6 },
      { type: 'Pull-Up', fga: 4.9, efg: 46.8 },
      { type: '< 10 ft', fga: 3.8, efg: 59.1 },
    ],
    assistLoc: { Rim: 1.4, 'Corner 3': 0.5, 'Arc 3': 0.7, 'Mid-Range': 0.4 },
    minutes: [37, 36, 38, 37, 36, 37, 38, 36, 37, 36],
    vsOpp: [{ date: 'Dec 12', min: 36, pts: 12, reb: 3, ast: 2, fg3m: 2 }, { date: 'Feb 4', min: 37, pts: 16, reb: 5, ast: 4, fg3m: 2 }, { date: 'Apr 2', min: 34, pts: 10, reb: 4, ast: 1, fg3m: 1 }],
  },
  {
    id: 10,
    name: 'OG Anunoby',
    team: 'NYK',
    pos: 'F',
    archetype: 'Cutting Wing',
    season: { min: 34.9, pts: 15.9, reb: 5.2, ast: 2.2, fg3m: 2.1 },
    boards: { PP: ['PTS', 'REB'], UD: ['PTS', 'STKS'], DAB: [] },
    playTypes: [
      { type: 'Spot-Up', freq: 24.8, ppp: 1.05 },
      { type: 'Cut', freq: 16.2, ppp: 1.38 },
      { type: 'Transition', freq: 15.4, ppp: 1.18 },
      { type: 'Putbacks', freq: 6.8, ppp: 1.12 },
    ],
    zones: [
      { zone: 'Restricted Area', share: 32.4, fgPct: 68.9 },
      { zone: 'Above Break 3', share: 23.4, fgPct: 35.2 },
      { zone: 'Corner 3', share: 12.1, fgPct: 38.9 },
      { zone: 'Mid-Range', share: 14.8, fgPct: 41.2 },
      { zone: 'Paint (Non-RA)', share: 17.3, fgPct: 47.6 },
    ],
    shotTypes: [
      { type: '< 10 ft', fga: 5.4, efg: 63.8 },
      { type: 'Catch & Shoot', fga: 4.6, efg: 55.9 },
      { type: 'Pull-Up', fga: 2.2, efg: 43.1 },
    ],
    assistLoc: { Rim: 0.9, 'Corner 3': 0.3, 'Arc 3': 0.4, 'Mid-Range': 0.3 },
    minutes: [35, 34, 36, 35, 33, 34, 36, 35, 34, 35],
    vsOpp: [{ date: 'Dec 12', min: 34, pts: 14, reb: 6, ast: 1, fg3m: 2 }, { date: 'Apr 2', min: 36, pts: 18, reb: 7, ast: 2, fg3m: 2 }],
  },
  {
    id: 11,
    name: 'Josh Hart',
    team: 'NYK',
    pos: 'G-F',
    archetype: 'Connector',
    season: { min: 37.2, pts: 13.4, reb: 9.6, ast: 5.8, fg3m: 1.4 },
    boards: { PP: ['REB', 'AST', 'PRA'], UD: ['REB', 'RA'], DAB: [] },
    playTypes: [
      { type: 'Transition', freq: 24.1, ppp: 1.16 },
      { type: 'Cut', freq: 14.8, ppp: 1.29 },
      { type: 'Spot-Up', freq: 13.2, ppp: 0.98 },
      { type: 'Putbacks', freq: 8.9, ppp: 1.18 },
    ],
    zones: [
      { zone: 'Restricted Area', share: 41.2, fgPct: 64.8 },
      { zone: 'Above Break 3', share: 18.6, fgPct: 33.1 },
      { zone: 'Corner 3', share: 10.9, fgPct: 36.8 },
      { zone: 'Mid-Range', share: 12.1, fgPct: 39.4 },
      { zone: 'Paint (Non-RA)', share: 17.2, fgPct: 46.2 },
    ],
    shotTypes: [
      { type: '< 10 ft', fga: 5.8, efg: 61.9 },
      { type: 'Catch & Shoot', fga: 2.9, efg: 51.2 },
      { type: 'Pull-Up', fga: 1.6, efg: 40.8 },
    ],
    assistLoc: { Rim: 2.4, 'Corner 3': 0.8, 'Arc 3': 1.1, 'Mid-Range': 0.6 },
    minutes: [38, 37, 36, 39, 37, 35, 33, 30, 28, 25],
    vsOpp: [{ date: 'Dec 12', min: 38, pts: 11, reb: 12, ast: 6, fg3m: 0 }, { date: 'Feb 4', min: 36, pts: 8, reb: 9, ast: 7, fg3m: 1 }, { date: 'Apr 2', min: 35, pts: 13, reb: 11, ast: 4, fg3m: 1 }],
  },
  {
    id: 12,
    name: 'Miles McBride',
    team: 'NYK',
    pos: 'G',
    archetype: 'Bench Combo Guard',
    season: { min: 24.6, pts: 9.8, reb: 2.9, ast: 2.6, fg3m: 2.1 },
    boards: { PP: [], UD: ['PTS', '3PM'], DAB: [] },
    playTypes: [
      { type: 'Spot-Up', freq: 28.4, ppp: 1.06 },
      { type: 'P&R Ball-Handler', freq: 16.9, ppp: 0.89 },
      { type: 'Transition', freq: 13.2, ppp: 1.11 },
    ],
    zones: [
      { zone: 'Above Break 3', share: 46.8, fgPct: 36.4 },
      { zone: 'Restricted Area', share: 16.9, fgPct: 57.2 },
      { zone: 'Corner 3', share: 11.2, fgPct: 39.6 },
      { zone: 'Mid-Range', share: 11.8, fgPct: 40.1 },
      { zone: 'Paint (Non-RA)', share: 13.3, fgPct: 42.4 },
    ],
    shotTypes: [
      { type: 'Catch & Shoot', fga: 5.2, efg: 57.1 },
      { type: 'Pull-Up', fga: 3.1, efg: 44.2 },
      { type: '< 10 ft', fga: 1.8, efg: 52.9 },
    ],
    assistLoc: { Rim: 1.0, 'Corner 3': 0.3, 'Arc 3': 0.6, 'Mid-Range': 0.3 },
    minutes: [22, 25, 20, 27, 24, 19, 28, 23, 26, 21],
    vsOpp: [{ date: 'Feb 4', min: 18, pts: 7, reb: 2, ast: 1, fg3m: 1 }],
  },
];

// Similar players (same archetype cluster) vs this opponent, this season.
// Deliberately includes thin/empty samples — the honest state early in a
// season or for rare archetypes (probes the early-season fog patch).
export const ARCHETYPE_LOGS = {
  'Perimeter Shot Creator|NYK': [
    { player: 'S. Gilgeous-Alexander', rates: { pts: 0.95, reb: 0.14, ast: 0.17, fg3m: 0.06 }, date: 'Mar 28', min: 36, pts: 35, reb: 5, ast: 7, fg3m: 2 },
    { player: 'L. Doncic', rates: { pts: 0.92, reb: 0.23, ast: 0.22, fg3m: 0.1 }, date: 'Mar 14', min: 38, pts: 38, reb: 9, ast: 8, fg3m: 5 },
    { player: 'D. Mitchell', rates: { pts: 0.85, reb: 0.13, ast: 0.14, fg3m: 0.1 }, date: 'Feb 21', min: 35, pts: 31, reb: 4, ast: 5, fg3m: 4 },
    { player: 'D. Booker', rates: { pts: 0.78, reb: 0.12, ast: 0.19, fg3m: 0.08 }, date: 'Jan 30', min: 37, pts: 29, reb: 4, ast: 6, fg3m: 3 },
    { player: 'D. DeRozan', rates: { pts: 0.7, reb: 0.11, ast: 0.13, fg3m: 0.03 }, date: 'Jan 12', min: 34, pts: 24, reb: 3, ast: 4, fg3m: 1 },
  ],
  'Slashing Wing|NYK': [
    { player: 'A. Edwards', rates: { pts: 0.75, reb: 0.15, ast: 0.13, fg3m: 0.09 }, date: 'Mar 20', min: 37, pts: 27, reb: 6, ast: 4, fg3m: 3 },
    { player: 'J. Williams', rates: { pts: 0.62, reb: 0.15, ast: 0.15, fg3m: 0.05 }, date: 'Feb 26', min: 34, pts: 22, reb: 5, ast: 5, fg3m: 2 },
    { player: 'B. Ingram', rates: { pts: 0.68, reb: 0.15, ast: 0.14, fg3m: 0.06 }, date: 'Feb 2', min: 35, pts: 25, reb: 5, ast: 4, fg3m: 2 },
  ],
  'Movement Shooter|NYK': [
    { player: 'B. Hield', rates: { pts: 0.62, reb: 0.11, ast: 0.09, fg3m: 0.14 }, date: 'Mar 25', min: 29, pts: 19, reb: 3, ast: 2, fg3m: 5 },
    { player: 'M. Beasley', rates: { pts: 0.7, reb: 0.1, ast: 0.05, fg3m: 0.14 }, date: 'Mar 3', min: 27, pts: 21, reb: 2, ast: 1, fg3m: 6 },
    { player: 'D. Robinson', rates: { pts: 0.58, reb: 0.09, ast: 0.08, fg3m: 0.12 }, date: 'Jan 27', min: 25, pts: 16, reb: 2, ast: 2, fg3m: 4 },
  ],
  'Stretch Big|NYK': [
    { player: 'L. Markkanen', rates: { pts: 0.7, reb: 0.2, ast: 0.06, fg3m: 0.09 }, date: 'Mar 31', min: 33, pts: 24, reb: 8, ast: 2, fg3m: 4 },
    { player: 'N. Reid', rates: { pts: 0.66, reb: 0.19, ast: 0.05, fg3m: 0.09 }, date: 'Mar 20', min: 26, pts: 18, reb: 6, ast: 2, fg3m: 3 },
  ],
  'Spot-Up Specialist|NYK': [
    { player: 'G. Allen', rates: { pts: 0.48, reb: 0.12, ast: 0.09, fg3m: 0.1 }, date: 'Jan 30', min: 24, pts: 11, reb: 3, ast: 1, fg3m: 3 },
  ],
  'Pick-and-Roll Maestro|BOS': [
    { player: 'C. Cunningham', rates: { pts: 0.7, reb: 0.17, ast: 0.23, fg3m: 0.06 }, date: 'Mar 26', min: 36, pts: 25, reb: 6, ast: 8, fg3m: 2 },
    { player: 'T. Young', rates: { pts: 0.65, reb: 0.08, ast: 0.3, fg3m: 0.08 }, date: 'Mar 8', min: 35, pts: 22, reb: 3, ast: 9, fg3m: 2 },
    { player: 'T. Haliburton', rates: { pts: 0.58, reb: 0.11, ast: 0.27, fg3m: 0.09 }, date: 'Feb 4', min: 34, pts: 19, reb: 4, ast: 10, fg3m: 3 },
  ],
  'Post Scorer / Stretch Big|BOS': [
    { player: 'N. Jokic', rates: { pts: 0.8, reb: 0.36, ast: 0.26, fg3m: 0.03 }, date: 'Mar 2', min: 37, pts: 31, reb: 13, ast: 8, fg3m: 1 },
    { player: 'D. Sabonis', rates: { pts: 0.7, reb: 0.36, ast: 0.21, fg3m: 0.01 }, date: 'Feb 10', min: 35, pts: 26, reb: 14, ast: 6, fg3m: 0 },
    { player: 'A. Davis', rates: { pts: 0.75, reb: 0.33, ast: 0.09, fg3m: 0.02 }, date: 'Jan 23', min: 36, pts: 28, reb: 12, ast: 3, fg3m: 1 },
  ],
  '3&D Wing|BOS': [
    { player: 'H. Jones', rates: { pts: 0.32, reb: 0.12, ast: 0.08, fg3m: 0.03 }, date: 'Mar 18', min: 33, pts: 9, reb: 4, ast: 2, fg3m: 1 },
    { player: 'D. Finney-Smith', rates: { pts: 0.3, reb: 0.14, ast: 0.05, fg3m: 0.05 }, date: 'Feb 24', min: 28, pts: 8, reb: 3, ast: 1, fg3m: 2 },
  ],
  Connector: [],
  'Connector|BOS': [
    { player: 'D. Green', rates: { pts: 0.28, reb: 0.28, ast: 0.2, fg3m: 0.03 }, date: 'Mar 12', min: 31, pts: 8, reb: 9, ast: 7, fg3m: 1 },
  ],
  'Cutting Wing|BOS': [],
  'Bench Combo Guard|BOS': [],
};

export function archetypeLogsFor(player) {
  const opp = player.team === GAME.away.tri ? GAME.home.tri : GAME.away.tri;
  return ARCHETYPE_LOGS[`${player.archetype}|${opp}`] || [];
}

export function opponentOf(player) {
  return player.team === GAME.away.tri ? GAME.home.tri : GAME.away.tri;
}

export function marketsFor(player) {
  return [...new Set([...player.boards.PP, ...player.boards.UD, ...player.boards.DAB])];
}

// Round 9/10 — the user's matchup-score formula: weight the share of the
// player's own play-type diet by the opponent's POINTS allowed per 48 in that
// type vs the league average (points fold efficiency and volume together;
// per-48 normalizes overtime volume — the mock's per-game numbers stand in
// for per-48). 1.0 = league-average matchup; render as +/-%.
export function playTypeMatchupScore(player, window = 'Season') {
  const tri = opponentOf(player);
  let covered = 0;
  let acc = 0;
  player.playTypes.forEach((pt) => {
    const avgPpp = LEAGUE_AVG.playTypes[pt.type];
    const basePoss = PLAYTYPE_BASE_POSS[pt.type];
    if (!avgPpp || !basePoss || !DEFENSE[tri].playTypes[pt.type]) return;
    const v = defPlayTypeVolume(tri, pt.type, window);
    acc += (pt.freq / 100) * (v.ptsG / (basePoss * avgPpp));
    covered += pt.freq / 100;
  });
  return covered > 0 ? acc / covered : null;
}

const THREE_ZONES = ['Corner 3', 'Above Break 3'];
const THREE_SHOT_TYPES = ['Catch & Shoot', 'Pull-Up'];

// Round 14 — a market's score decomposes by category base: PTS is estimable
// independently via play types, shot zones, and shot types. Each component is
// the same shape: player diet share × opponent per-48 concession ratio vs
// league average. Returns { playTypes?, zones?, shotTypes?, assistLoc?,
// traditional? } — only the bases that inform the market.
export function scoreComponents(player, market = 'PTS', window = 'Season') {
  const tri = opponentOf(player);
  const def = defenseFor(tri, window);
  const totalFga = player.shotTypes.reduce((sum, st) => sum + st.fga, 0);
  const ALL_ZONES = Object.keys(LEAGUE_AVG.zones);

  const zoneScore = (zones, volumeOnly) => {
    let covered = 0;
    let acc = 0;
    player.zones
      .filter((z) => zones.includes(z.zone))
      .forEach((z) => {
        const v = defZoneVolume(tri, z.zone, window);
        const base = ZONE_BASE_FGA[z.zone];
        const avgPts = (base * LEAGUE_AVG.zones[z.zone] * ZONE_PT_VALUE[z.zone]) / 100;
        const ratio = volumeOnly ? v.fgaG / base : v.ptsG / avgPts;
        acc += (z.share / 100) * ratio;
        covered += z.share / 100;
      });
    return covered > 0 ? acc / covered : null;
  };

  const shotTypeScore = (types, volumeOnly) => {
    let covered = 0;
    let acc = 0;
    player.shotTypes
      .filter((st) => types.includes(st.type))
      .forEach((st) => {
        const v = defShotTypeVolume(tri, st.type, window);
        const base = SHOTTYPE_BASE_FGA[st.type];
        const d = def.shotTypes[st.type];
        const avgPts = (base * (d.efg - d.vsAvg) * 2) / 100;
        const ratio = volumeOnly ? v.fgaG / base : v.ptsG / avgPts;
        const w = totalFga > 0 ? st.fga / totalFga : 0;
        acc += w * ratio;
        covered += w;
      });
    return covered > 0 ? acc / covered : null;
  };

  const assistScore = () => {
    let covered = 0;
    let acc = 0;
    Object.entries(player.assistLoc).forEach(([loc, perGame]) => {
      const d = def.assistLoc[loc];
      const avg = LEAGUE_AVG.assistLoc[loc];
      if (!d || !avg) return;
      acc += perGame * (d.perGame / avg);
      covered += perGame;
    });
    return covered > 0 ? acc / covered : null;
  };

  const rebScore = () => {
    const r = def.traditional.find((x) => x.stat === 'OPP_REB');
    return r ? r.value / (r.value - r.vsAvg) : null;
  };

  switch (market) {
    case 'All':
    case 'PTS':
      return {
        playTypes: playTypeMatchupScore(player, window),
        zones: zoneScore(ALL_ZONES, false),
        shotTypes: shotTypeScore(SHOT_TYPES, false),
      };
    case '3PM':
      return { zones: zoneScore(THREE_ZONES, false), shotTypes: shotTypeScore(THREE_SHOT_TYPES, false) };
    case 'FGA':
      return { zones: zoneScore(ALL_ZONES, true), shotTypes: shotTypeScore(SHOT_TYPES, true) };
    case 'FG3A':
      return { zones: zoneScore(THREE_ZONES, true), shotTypes: shotTypeScore(THREE_SHOT_TYPES, true) };
    case 'AST':
      return { assistLoc: assistScore() };
    case 'REB':
      return { traditional: rebScore() };
    default:
      return {};
  }
}

// Season-stat-weighted combos; simple markets blend as the mean of their
// available component bases.
const COMBO_PARTS = {
  PRA: ['pts', 'reb', 'ast'],
  PA: ['pts', 'ast'],
  RA: ['reb', 'ast'],
  PR: ['pts', 'reb'],
};
const PART_MARKET = { pts: 'PTS', reb: 'REB', ast: 'AST' };

export function matchupScore(player, market = 'PTS', window = 'Season') {
  if (COMBO_PARTS[market]) {
    const parts = COMBO_PARTS[market]
      .map((part) => [player.season[part], matchupScore(player, PART_MARKET[part], window)])
      .filter(([, sc]) => sc != null);
    const w = parts.reduce((sum, [wt]) => sum + wt, 0);
    return w > 0 ? parts.reduce((sum, [wt, sc]) => sum + wt * sc, 0) / w : null;
  }
  const comps = Object.values(scoreComponents(player, market, window)).filter((v) => v != null);
  return comps.length > 0 ? comps.reduce((a, b) => a + b, 0) / comps.length : null;
}

export const scoreLabel = (ratio) => {
  if (ratio == null) return null;
  const p = (ratio - 1) * 100;
  return `${p >= 0 ? '+' : ''}${p.toFixed(1)}%`;
};

const MARKET_TO_TRADITIONAL = {
  PTS: 'OPP_PTS',
  REB: 'OPP_REB',
  AST: 'OPP_AST',
  '3PM': 'OPP_3PM',
};

// Organize (don't score): line up what a player leans on against what the
// opponent concedes in that exact category. Hot = opponent bottom-10 defending
// it (rank >= 21); cold = opponent top-9 (rank <= 9). No composite number.
export function computeEdges(player) {
  const def = DEFENSE[opponentOf(player)];
  const hot = [];
  const cold = [];
  const push = (rank, entry) => {
    if (rank >= 21) hot.push({ ...entry, rank });
    else if (rank <= 9) cold.push({ ...entry, rank });
  };

  marketsFor(player).forEach((market) => {
    const stat = MARKET_TO_TRADITIONAL[market];
    if (!stat) return;
    const row = def.traditional.find((r) => r.stat === stat);
    if (row) {
      push(row.rank, {
        category: 'Traditional',
        label: `${market} market vs ${stat.replace('OPP_', 'opp ')}`,
        playerLine: `${market} posted`,
        oppLine: `${row.value} allowed (${row.vsAvg > 0 ? '+' : ''}${row.vsAvg} vs avg)`,
      });
    }
  });

  player.playTypes
    .filter((pt) => pt.freq >= 12)
    .forEach((pt) => {
      const d = def.playTypes[pt.type];
      if (d) {
        push(d.rank, {
          category: 'Play types',
          label: pt.type,
          playerLine: `${pt.freq}% freq · ${pt.ppp} PPP`,
          oppLine: `${d.ppp} PPP allowed`,
        });
      }
    });

  player.zones
    .filter((z) => z.share >= 20)
    .forEach((z) => {
      const d = def.zones[z.zone];
      if (d) {
        push(d.rank, {
          category: 'Shot zones',
          label: z.zone,
          playerLine: `${z.share}% of FGA · ${z.fgPct} FG%`,
          oppLine: `${d.fgPct} FG% allowed`,
        });
      }
    });

  player.shotTypes
    .filter((st) => st.fga >= 4)
    .forEach((st) => {
      const d = def.shotTypes[st.type];
      if (d) {
        push(d.rank, {
          category: 'Shot types',
          label: st.type,
          playerLine: `${st.fga} FGA · ${st.efg} eFG%`,
          oppLine: `${d.efg} eFG% allowed (${d.vsAvg > 0 ? '+' : ''}${d.vsAvg} vs avg)`,
        });
      }
    });

  Object.entries(player.assistLoc)
    .filter(([, perGame]) => perGame >= 1.0)
    .forEach(([loc, perGame]) => {
      const d = def.assistLoc[loc];
      if (d) {
        push(d.rank, {
          category: 'Assist locations',
          label: `Assists to ${loc}`,
          playerLine: `${perGame}/gm`,
          oppLine: `${d.perGame}/gm allowed`,
        });
      }
    });

  return { hot, cold };
}
