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
