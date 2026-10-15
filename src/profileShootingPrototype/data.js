/*
 * PROTOTYPE — throwaway. Shapes the two profile payloads for the variants.
 *
 * `share` on a zone is computed here as the zone's points over the sum of the
 * six zones' points. The payload's own `PTS%` divides by a sum over every
 * numeric column (FGA, FG% and all), so it does not add up to 100 and is not
 * shown. `vsLg` is the payload's `PTS%+` (1.00 = league-average emphasis).
 */
const TYPE_NAMES = { 'C&S': 'Catch & shoot', Pullup: 'Pull-up', '<10 Ft': 'Inside 10 ft' };

export const shotTypes = (rows) =>
  (Array.isArray(rows) ? rows : []).map((r) => ({
    key: r.SHOT_TYPE,
    name: TYPE_NAMES[r.SHOT_TYPE] ?? r.SHOT_TYPE,
    share: r.FGA_FREQUENCY,
    fg: { m: r.FGM, a: r.FGA, pct: r.FGA > 0 ? r.FG_PCT : null },
    two: { m: r.FG2M, a: r.FG2A, pct: r.FG2A > 0 ? r.FG2_PCT : null, share: r.FG2A_FREQUENCY },
    three: { m: r.FG3M, a: r.FG3A, pct: r.FG3A > 0 ? r.FG3_PCT : null, share: r.FG3A_FREQUENCY },
  }));

const ZONES = [
  { key: 'Restricted Area', name: 'Restricted area', short: 'Rim', three: false },
  { key: 'In The Paint (Non-RA)', name: 'Paint (non-RA)', short: 'Paint', three: false },
  { key: 'Mid-Range', name: 'Mid-range', short: 'Mid', three: false },
  { key: 'Left Corner 3', name: 'Left corner 3', short: 'L corner', three: true },
  { key: 'Right Corner 3', name: 'Right corner 3', short: 'R corner', three: true },
  { key: 'Above the Break 3', name: 'Above the break 3', short: 'Above break', three: true },
];

export const zones = (data) => {
  if (!data) return [];
  const rows = ZONES.map((z) => ({
    ...z,
    fg: {
      m: data[`${z.key}_FGM`] ?? 0,
      a: data[`${z.key}_FGA`] ?? 0,
      pct: data[`${z.key}_FGA`] > 0 ? data[`${z.key}_FG_PCT`] : null,
    },
    pts: data[`${z.key}_PTS`] ?? 0,
    vsLg: data[`${z.key}_PTS%+`] ?? null,
  }));
  const total = rows.reduce((sum, z) => sum + z.pts, 0) || 1;
  return rows.map((z) => ({ ...z, share: z.pts / total })).sort((a, b) => b.pts - a.pts);
};

export const pct = (x, digits = 1) => (x == null ? '—' : `${(x * 100).toFixed(digits)}%`);
export const share = (x) => (x == null ? '—' : `${Math.round(x * 100)}%`);
export const one = (x) => (x == null ? '—' : (Math.round(x * 10) / 10).toFixed(1));
export const ma = ({ m, a }) => `${one(m)}/${one(a)}`;
export const times = (x) => (x == null ? '—' : `${x.toFixed(2)}×`);

/* Emphasis vs league, not quality: gold above, dim below. */
export const vsTone = (x) => (x == null ? 'flat' : x >= 1.15 ? 'up' : x <= 0.85 ? 'down' : 'flat');

/* ---- round 2: league shares and the MCP get_matchup court ---- */

/* /api/diet/baselines keys → the profile's SHOT_TYPE. The Diet share is the
   profile's FGA_FREQUENCY (checked: 0.203 / 0.239 / 0.529 for Jalen Johnson). */
const TYPE_DIET_KEY = { 'C&S': 'Catch and Shoot', Pullup: 'Pullups', '<10 Ft': 'Less Than 10 ft' };
export const leagueTypeShare = (baselines, shotType) =>
  baselines?.shares?.shot_types?.[TYPE_DIET_KEY[shotType]] ?? null;

export const TEAM_CODES = {
  'Atlanta Hawks': 'ATL', 'Boston Celtics': 'BOS', 'Brooklyn Nets': 'BKN', 'Charlotte Hornets': 'CHA',
  'Chicago Bulls': 'CHI', 'Cleveland Cavaliers': 'CLE', 'Dallas Mavericks': 'DAL', 'Denver Nuggets': 'DEN',
  'Detroit Pistons': 'DET', 'Golden State Warriors': 'GSW', 'Houston Rockets': 'HOU', 'Indiana Pacers': 'IND',
  'Los Angeles Clippers': 'LAC', 'Los Angeles Lakers': 'LAL', 'Memphis Grizzlies': 'MEM', 'Miami Heat': 'MIA',
  'Milwaukee Bucks': 'MIL', 'Minnesota Timberwolves': 'MIN', 'New Orleans Pelicans': 'NOP', 'New York Knicks': 'NYK',
  'Oklahoma City Thunder': 'OKC', 'Orlando Magic': 'ORL', 'Philadelphia 76ers': 'PHI', 'Phoenix Suns': 'PHX',
  'Portland Trail Blazers': 'POR', 'Sacramento Kings': 'SAC', 'San Antonio Spurs': 'SAS', 'Toronto Raptors': 'TOR',
  'Utah Jazz': 'UTA', 'Washington Wizards': 'WAS',
};

/* The MCP court's five regions, in its words. */
export const COURT_ZONES = {
  rim: { key: 'Restricted Area', label: 'Restricted area' },
  paint: { key: 'In The Paint (Non-RA)', label: 'Paint (non-RA)' },
  mid: { key: 'Mid-Range', label: 'Mid-range' },
  corner: { key: 'Corner 3', label: 'Corner 3' },
  arc: { key: 'Above the Break 3', label: 'Above-break 3' },
};

/* One slice per region, as /api/matchups/unscheduled returns it: his Diet
   share (of FGA) and the league's, joined to the opponent's season row. The
   PTS market reads the made-shot rows (`<zone>:FGM`), as the MCP card does. */
export const courtSlices = (matchups, tricode, row = 'FGM') => {
  const opp = matchups?.opponents?.[tricode]?.shot_zones || [];
  return Object.fromEntries(
    Object.entries(COURT_ZONES).map(([region, { key, label }]) => {
      const diet = (matchups?.diet?.shot_zones || []).find((s) => s.key === key)?.season;
      const sheet = opp.find((r) => r.key === `${key}:${row}`)?.season;
      return [
        region,
        {
          key,
          label,
          share: diet?.share ?? null,
          league: diet?.league_average_share ?? null,
          sd: diet?.sigma_deviation ?? null,
          rank: sheet?.rank ?? null,
          vsLg: sheet?.percent_vs_league_average ?? null,
        },
      ];
    }),
  );
};

export const ordinal = (n) => {
  if (n == null) return '–';
  const t = n % 100;
  const s = t >= 11 && t <= 13 ? 'th' : { 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th';
  return `${n}${s}`;
};
export const signed = (p) => (p == null ? '–' : `${p >= 0 ? '+' : '−'}${Math.abs(p).toFixed(1)}%`);
export const points = (d) => (d == null ? '–' : `${d >= 0 ? '+' : '−'}${Math.abs(Math.round(d * 100))}`);
