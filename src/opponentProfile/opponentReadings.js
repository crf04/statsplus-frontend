import { toFiniteNumber } from '../numberUtils';

/*
 * Shapes a /api/teams/stats payload into labelled groups of readings for the
 * Opposing Team Profile. A reading is how much of a stat the opponent allows:
 * its per-game value (when the category has one), its 1-30 rank (30 allows
 * the most) and its percent above or below league average. Playtypes and
 * Assists carry only a ratio to league (1.06 = 6% above), so their percent is
 * derived from that ratio and they have no value of their own.
 */

const TRADITIONAL = [
  [
    'Scoring',
    [
      ['OPP_PTS', 'Points'],
      ['OPP_FGM', 'FG made'],
      ['OPP_FGA', 'FG attempts'],
      ['OPP_FG_PCT', 'FG%', 'pct'],
      ['OPP_FG3M', '3P made'],
      ['OPP_FG3A', '3P attempts'],
      ['OPP_FG3_PCT', '3P%', 'pct'],
      ['OPP_FTA', 'FT attempts'],
    ],
  ],
  [
    'Boards & assists',
    [
      ['OPP_REB', 'Rebounds'],
      ['OPP_OREB', 'Off. rebounds'],
      ['OPP_DREB', 'Def. rebounds'],
      ['OPP_AST', 'Assists'],
    ],
  ],
  [
    'Defense events',
    [
      ['OPP_TOV', 'Turnovers'],
      ['OPP_STL', 'Steals'],
      ['OPP_BLK', 'Blocks'],
      ['OPP_STL+BLK', 'Stocks'],
    ],
  ],
];

const PLAYTYPE_LABELS = {
  PRBallHandler: 'P&R ball handler',
  PRRollMan: 'P&R roll man',
  Isolation: 'Isolation',
  Spotup: 'Spot-up',
  Transition: 'Transition',
  Postup: 'Post-up',
  Cut: 'Cut',
  OffScreen: 'Off screen',
  Handoff: 'Handoff',
  OffRebound: 'Putbacks',
  Misc: 'Misc',
};

const ASSISTS = [
  [
    'Volume',
    [
      ['Assists', 'Assists'],
      ['AssistPoints', 'Assist points'],
    ],
  ],
  [
    'By shot',
    [
      ['AtRimAssists', 'At rim'],
      ['ShortMidRangeAssists', 'Short mid'],
      ['LongMidRangeAssists', 'Long mid'],
      ['TwoPtAssists', 'All 2s'],
      ['Corner3Assists', 'Corner 3'],
      ['Arc3Assists', 'Above-break 3'],
      ['ThreePtAssists', 'All 3s'],
    ],
  ],
];

const ZONES = [
  ['Restricted Area', 'Restricted area'],
  ['In The Paint (Non-RA)', 'Paint (non-RA)'],
  ['Mid-Range', 'Mid-range'],
  ['Corner 3', 'Corner 3'],
  ['Above the Break 3', 'Above-break 3'],
];

const SHOT_TYPES = {
  'Catch and Shoot': 'Catch & shoot',
  Pullups: 'Pull-ups',
  'Less Than 10 ft': 'Inside 10 ft',
};

const SHOT_TYPE_STATS = [
  ['PTS', 'Points'],
  ['FG2M', '2P made'],
  ['FG2A', '2P att'],
  ['FG3M', '3P made'],
  ['FG3A', '3P att'],
];

export const formatValue = (value, kind = 'count') => {
  if (value === null) return null;
  return kind === 'pct' ? `${(value * 100).toFixed(1)}%` : value.toFixed(1);
};

export const formatVsLeague = (vs) => {
  if (vs === null) return '—';
  const size = Math.abs(vs);
  return `${vs >= 0 ? '+' : '−'}${size.toFixed(size < 10 ? 1 : 0)}%`;
};

const reading = (data, key, label, kind) => ({
  key,
  label,
  value: formatValue(toFiniteNumber(data?.[key]), kind),
  rank: toFiniteNumber(data?.[`${key}_RANK`]),
  vs: toFiniteNumber(data?.[`${key}_vs_avg_pct`]),
});

const ratioReading = (data, key, label) => {
  const ratio = toFiniteNumber(data?.[key]);
  return {
    key,
    label,
    value: null,
    rank: toFiniteNumber(data?.[`${key}_RANK`]),
    vs: ratio === null ? null : (ratio - 1) * 100,
  };
};

const isObject = (data) => data !== null && typeof data === 'object' && !Array.isArray(data);

const playtypeGroups = (data) => {
  // Play types the labels do not know yet still appear, under their own key.
  const keys = Object.keys(data).filter((key) => !key.includes('RANK') && !key.includes('TEAM'));
  const known = Object.keys(PLAYTYPE_LABELS).filter((key) => keys.includes(key));
  const unknown = keys.filter((key) => !(key in PLAYTYPE_LABELS));
  return [
    {
      key: 'playtypes',
      title: null,
      rows: [...known, ...unknown].map((key) =>
        ratioReading(data, key, PLAYTYPE_LABELS[key] ?? key),
      ),
    },
  ];
};

const zoneGroups = (data) =>
  ZONES.map(([zone, title]) => {
    const made = toFiniteNumber(data[`${zone}_OPP_FGM`]);
    const attempts = toFiniteNumber(data[`${zone}_OPP_FGA`]);
    const pct = made !== null && attempts > 0 ? ` · ${formatValue(made / attempts, 'pct')}` : '';
    return {
      key: zone,
      title,
      head: made === null ? null : `${formatValue(made)} made${pct}`,
      rows: [
        reading(data, `${zone}_OPP_FGM`, 'Made'),
        reading(data, `${zone}_OPP_FGA`, 'Attempts'),
      ],
    };
  });

const shotTypeGroups = (rows) =>
  rows.map((row = {}) => {
    const points = toFiniteNumber(row?.PTS);
    // A type with no threes (shots inside 10 ft) has no 3P readings to show.
    const hasThrees = toFiniteNumber(row?.FG3A) > 0;
    return {
      key: row?.ShootingType ?? 'Unknown',
      title: SHOT_TYPES[row?.ShootingType] ?? row?.ShootingType ?? 'Unknown',
      head: points === null ? null : `${formatValue(points)} pts`,
      rows: SHOT_TYPE_STATS.filter(([key]) => hasThrees || !key.startsWith('FG3')).map(
        ([key, label]) => reading(row, key, label),
      ),
    };
  });

const listGroups = (data, groups, toReading) =>
  groups.map(([title, stats]) => ({
    key: title,
    title,
    rows: stats.map(([key, label, kind]) => toReading(data, key, label, kind)),
  }));

/* Groups of readings for one category, or [] when the payload has none. */
export const opponentReadings = (category, data) => {
  if (category === 'Shooting Type') return Array.isArray(data) ? shotTypeGroups(data) : [];
  if (!isObject(data)) return [];
  if (category === 'Traditional') return listGroups(data, TRADITIONAL, reading);
  if (category === 'Playtypes') return playtypeGroups(data);
  if (category === 'Assists') return listGroups(data, ASSISTS, ratioReading);
  if (category === 'Zone Shooting') return zoneGroups(data);
  return [];
};

/* One scale for every bar: the largest gap from league, rounded up to 5%. */
export const barScale = (groups) => {
  const gaps = groups.flatMap((group) => group.rows.map((row) => Math.abs(row.vs ?? 0)));
  return Math.ceil(Math.max(5, ...gaps) / 5) * 5;
};

// Groups plus rows. Up to this many lines read fine in one column.
export const ONE_COLUMN_LINES = 12;

const lineCount = (group) => (group.title ? 1 : 0) + group.rows.length;

/*
 * Splits groups into two balanced columns when a list is too long for one.
 * The split falls between groups when that balances within three lines;
 * otherwise inside a group, never leaving fewer than two rows on either side.
 * A group split in two is marked `continues` / `continued`.
 */
export const splitColumns = (groups) => {
  const total = groups.reduce((sum, group) => sum + lineCount(group), 0);
  if (total <= ONE_COLUMN_LINES) return [groups];

  let best = null;
  let seen = 0;
  groups.slice(0, -1).forEach((group, index) => {
    seen += lineCount(group);
    const gap = Math.abs(total - 2 * seen);
    if (!best || gap < best.gap) best = { at: index + 1, gap };
  });
  if (best && best.gap <= 3) return [groups.slice(0, best.at), groups.slice(best.at)];

  const half = Math.ceil(total / 2);
  const left = [];
  const right = [];
  let used = 0;
  groups.forEach((group) => {
    const room = half - used;
    const take = room - (group.title ? 1 : 0);
    // Once a group has gone right, every later one follows to keep the order.
    if (right.length) right.push(group);
    else if (lineCount(group) <= room) left.push(group);
    else if (take < 2 || group.rows.length - take < 2) right.push(group);
    else {
      left.push({ ...group, continues: true, rows: group.rows.slice(0, take) });
      right.push({ ...group, head: null, continued: true, rows: group.rows.slice(take) });
    }
    used += lineCount(group);
  });
  return [left, right].filter((column) => column.length);
};
