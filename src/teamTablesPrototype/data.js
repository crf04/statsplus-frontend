/*
 * PROTOTYPE — throwaway (branch prototype/team-profile-tables). Shapes the five
 * /api/teams/stats payloads into one model the variants share.
 *
 * Every reading is { value, rank, vs }: `rank` 1-30 (30 = allows the most),
 * `vs` the percent above or below league average. Playtypes and Assists carry
 * only a ratio to league (1.06 = 6% above), so their `vs` is derived from it
 * and their `value` is that ratio.
 */

const num = (x) => (typeof x === 'number' && Number.isFinite(x) ? x : null);

const TRADITIONAL = [
  {
    title: 'Scoring',
    stats: [
      ['OPP_PTS', 'Points'],
      ['OPP_FGM', 'FG made'],
      ['OPP_FGA', 'FG attempts'],
      ['OPP_FG_PCT', 'FG%', 'pct'],
      ['OPP_FG3M', '3P made'],
      ['OPP_FG3A', '3P attempts'],
      ['OPP_FG3_PCT', '3P%', 'pct'],
      ['OPP_FTA', 'FT attempts'],
    ],
  },
  {
    title: 'Boards & assists',
    stats: [
      ['OPP_REB', 'Rebounds'],
      ['OPP_OREB', 'Off. rebounds'],
      ['OPP_DREB', 'Def. rebounds'],
      ['OPP_AST', 'Assists'],
    ],
  },
  {
    title: 'Defense events',
    stats: [
      ['OPP_TOV', 'Turnovers'],
      ['OPP_STL', 'Steals'],
      ['OPP_BLK', 'Blocks'],
      ['OPP_STL+BLK', 'Stocks'],
    ],
  },
];

const PLAYTYPES = [
  ['PRBallHandler', 'P&R ball handler'],
  ['PRRollMan', 'P&R roll man'],
  ['Isolation', 'Isolation'],
  ['Spotup', 'Spot-up'],
  ['Transition', 'Transition'],
  ['Postup', 'Post-up'],
  ['Cut', 'Cut'],
  ['OffScreen', 'Off screen'],
  ['Handoff', 'Handoff'],
  ['OffRebound', 'Putbacks'],
  ['Misc', 'Misc'],
];

const ASSISTS = [
  {
    title: 'Volume',
    stats: [
      ['Assists', 'Assists'],
      ['AssistPoints', 'Assist points'],
    ],
  },
  {
    title: 'By shot',
    stats: [
      ['AtRimAssists', 'At rim'],
      ['ShortMidRangeAssists', 'Short mid'],
      ['LongMidRangeAssists', 'Long mid'],
      ['TwoPtAssists', 'All 2s'],
      ['Corner3Assists', 'Corner 3'],
      ['Arc3Assists', 'Above-break 3'],
      ['ThreePtAssists', 'All 3s'],
    ],
  },
];

const ZONES = [
  ['Restricted Area', 'Restricted area', 'Rim'],
  ['In The Paint (Non-RA)', 'Paint (non-RA)', 'Paint'],
  ['Mid-Range', 'Mid-range', 'Mid'],
  ['Corner 3', 'Corner 3', 'Corner 3'],
  ['Above the Break 3', 'Above-break 3', 'Arc 3'],
];

const TYPES = {
  'Catch and Shoot': ['Catch & shoot', 'C&S'],
  Pullups: ['Pull-ups', 'Pull-up'],
  'Less Than 10 ft': ['Inside 10 ft', '<10 ft'],
};

const reading = (d, key, kind = 'count') => ({
  value: num(d?.[key]),
  rank: num(d?.[`${key}_RANK`]),
  vs: num(d?.[`${key}_vs_avg_pct`]),
  kind,
});

const ratioReading = (d, key) => {
  const value = num(d?.[key]);
  return {
    value,
    rank: num(d?.[`${key}_RANK`]),
    vs: value == null ? null : (value - 1) * 100,
    kind: 'ratio',
  };
};

/* kind 'list': groups of labelled readings.
   kind 'matrix': rows (zones / shot types) × metrics. */
export const model = (category, data) => {
  if (!data) return null;
  if (category === 'Traditional')
    return {
      kind: 'list',
      unit: 'Allowed per game',
      groups: TRADITIONAL.map(({ title, stats }) => ({
        title,
        items: stats.map(([key, label, kind]) => ({ key, label, ...reading(data, key, kind) })),
      })),
    };
  if (category === 'Playtypes')
    return {
      kind: 'list',
      unit: 'Ratio to league average (1.00× = average)',
      groups: [
        {
          title: null,
          items: PLAYTYPES.map(([key, label]) => ({ key, label, ...ratioReading(data, key) })),
        },
      ],
    };
  if (category === 'Assists')
    return {
      kind: 'list',
      unit: 'Ratio to league average (1.00× = average)',
      groups: ASSISTS.map(({ title, stats }) => ({
        title,
        items: stats.map(([key, label]) => ({ key, label, ...ratioReading(data, key) })),
      })),
    };
  if (category === 'Zone Shooting')
    return {
      kind: 'matrix',
      unit: 'Opponent shots per game by zone',
      metrics: [
        { key: 'FGM', label: 'Made' },
        { key: 'FGA', label: 'Attempts' },
        { key: 'PCT', label: 'FG%' },
      ],
      rows: ZONES.map(([key, label, short]) => {
        const m = reading(data, `${key}_OPP_FGM`);
        const a = reading(data, `${key}_OPP_FGA`);
        const pct =
          m.value != null && a.value > 0
            ? { value: m.value / a.value, rank: null, vs: null, kind: 'pct' }
            : { value: null, rank: null, vs: null, kind: 'pct' };
        return { key, label, short, headline: 'FGM', cells: { FGM: m, FGA: a, PCT: pct } };
      }),
    };
  if (category === 'Shooting Type') {
    const rows = Array.isArray(data) ? data : [];
    return {
      kind: 'matrix',
      unit: 'Opponent shots per game by type',
      metrics: [
        { key: 'PTS', label: 'Points' },
        { key: 'FG2M', label: '2P made' },
        { key: 'FG2A', label: '2P att' },
        { key: 'FG3M', label: '3P made' },
        { key: 'FG3A', label: '3P att' },
      ],
      rows: rows.map((r) => {
        const [label, short] = TYPES[r.ShootingType] || [r.ShootingType, r.ShootingType];
        const noThrees = !(r.FG3A > 0);
        const cells = Object.fromEntries(
          ['PTS', 'FG2M', 'FG2A', 'FG3M', 'FG3A'].map((k) => [
            k,
            noThrees && k.startsWith('FG3')
              ? { value: null, rank: null, vs: null, kind: 'count' }
              : reading(r, k),
          ]),
        );
        return { key: r.ShootingType, label, short, headline: 'PTS', cells };
      }),
    };
  }
  return null;
};

export const fmtValue = ({ value, kind }) => {
  if (value == null) return '—';
  if (kind === 'pct') return `${(value * 100).toFixed(1)}%`;
  if (kind === 'ratio') return `${value.toFixed(2)}×`;
  return value.toFixed(1);
};

export const fmtVs = (vs) =>
  vs == null ? '—' : `${vs >= 0 ? '+' : '−'}${Math.abs(vs).toFixed(Math.abs(vs) < 10 ? 1 : 0)}%`;

/* Hue for a rank, the same scale as the app's .rank-pill: red allows least,
   green allows most. */
export const rankHue = (rank) => (rank == null ? null : (rank - 1) * 4.1);

export const tone = (vs) => (vs == null ? 'flat' : vs >= 3 ? 'up' : vs <= -3 ? 'down' : 'flat');

export const ordinal = (n) => {
  if (n == null) return '–';
  const t = n % 100;
  const s = t >= 11 && t <= 13 ? 'th' : { 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th';
  return `${n}${s}`;
};
