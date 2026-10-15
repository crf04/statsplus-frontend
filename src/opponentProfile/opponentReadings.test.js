import { barScale, opponentReadings, splitColumns } from './opponentReadings';

// Charlotte's production payloads (2026-10-15), trimmed to the keys each test reads.
const traditional = {
  OPP_PTS: 110.76082004555809,
  OPP_PTS_RANK: 7,
  OPP_PTS_vs_avg_pct: -3.6904371197442942,
  OPP_FG_PCT: 0.4668331945600888,
  OPP_FG_PCT_RANK: 11,
  OPP_FG_PCT_vs_avg_pct: -0.8656769298523548,
  OPP_FTA: 20.300683371298405,
  OPP_FTA_RANK: 1,
  OPP_FTA_vs_avg_pct: -13.09613820198009,
};

const playtypes = {
  Cut: 0.9580421949250032,
  Cut_RANK: 8,
  Misc: 1.171157615146854,
  Misc_RANK: 29,
  PRBallHandler: 1.0315146019765173,
  PRBallHandler_RANK: 24,
  Drive: 1.2,
  Drive_RANK: 30,
  TEAM_NAME: 'Charlotte Hornets',
};

const zones = {
  'Restricted Area_OPP_FGM': 16.838268792710707,
  'Restricted Area_OPP_FGM_RANK': 18,
  'Restricted Area_OPP_FGM_vs_avg_pct': -0.31037570177101514,
  'Restricted Area_OPP_FGA': 25.366742596810933,
  'Restricted Area_OPP_FGA_RANK': 17,
  'Restricted Area_OPP_FGA_vs_avg_pct': 0.76294365400702,
};

const shotTypes = [
  {
    ShootingType: 'Pullups',
    PTS: 21.017463933181475,
    PTS_RANK: 18,
    PTS_vs_avg_pct: 2.8382984409665246,
    FG3A: 9.743356112376613,
    FG3A_RANK: 10,
    FG3A_vs_avg_pct: -1.5833976692874452,
  },
  {
    ShootingType: 'Less Than 10 ft',
    PTS: 44.00303720577069,
    PTS_RANK: 13,
    PTS_vs_avg_pct: -1.340892841144381,
    FG3A: 0.0,
    FG3A_RANK: 1,
    FG3A_vs_avg_pct: null,
  },
];

const row = (groups, title, label) =>
  groups.find((group) => group.title === title).rows.find((r) => r.label === label);

test('Traditional readings carry a per-game value, rank and percent vs league', () => {
  const groups = opponentReadings('Traditional', traditional);
  expect(groups.map((group) => group.title)).toEqual([
    'Scoring',
    'Boards & assists',
    'Defense events',
  ]);
  expect(row(groups, 'Scoring', 'Points')).toEqual({
    key: 'OPP_PTS',
    label: 'Points',
    value: '110.8',
    rank: 7,
    vs: -3.6904371197442942,
  });
  expect(row(groups, 'Scoring', 'FG%').value).toBe('46.7%');
  // A stat the payload lacks keeps its row, with nothing to draw.
  expect(row(groups, 'Defense events', 'Steals')).toEqual({
    key: 'OPP_STL',
    label: 'Steals',
    value: null,
    rank: null,
    vs: null,
  });
});

test('Playtypes turn ratios into percent vs league, known types first', () => {
  const [group] = opponentReadings('Playtypes', playtypes);
  expect(group.title).toBeNull();
  expect(group.rows.map((r) => r.label)).toEqual(['P&R ball handler', 'Cut', 'Misc', 'Drive']);
  const misc = group.rows.find((r) => r.label === 'Misc');
  expect(misc.value).toBeNull();
  expect(misc.rank).toBe(29);
  expect(misc.vs).toBeCloseTo(17.1158, 3);
});

test('Assists read as percent vs league with no value of their own', () => {
  const groups = opponentReadings('Assists', {
    Corner3Assists: 0.8249470266490416,
    Corner3Assists_RANK: 2,
  });
  expect(groups.map((group) => group.title)).toEqual(['Volume', 'By shot']);
  const corner = row(groups, 'By shot', 'Corner 3');
  expect(corner.value).toBeNull();
  expect(corner.rank).toBe(2);
  expect(corner.vs).toBeCloseTo(-17.5053, 3);
});

test('each zone is a group headed by made shots and FG%', () => {
  const [rim] = opponentReadings('Zone Shooting', zones);
  expect(rim.title).toBe('Restricted area');
  expect(rim.head).toBe('16.8 made · 66.4%');
  expect(rim.rows.map((r) => [r.label, r.value, r.rank])).toEqual([
    ['Made', '16.8', 18],
    ['Attempts', '25.4', 17],
  ]);
});

test('a shot type with no threes has no 3P rows', () => {
  const [pullups, inside] = opponentReadings('Shooting Type', shotTypes);
  expect(pullups.title).toBe('Pull-ups');
  expect(pullups.head).toBe('21.0 pts');
  expect(pullups.rows.map((r) => r.label)).toEqual([
    'Points',
    '2P made',
    '2P att',
    '3P made',
    '3P att',
  ]);
  expect(inside.title).toBe('Inside 10 ft');
  expect(inside.rows.map((r) => r.label)).toEqual(['Points', '2P made', '2P att']);
});

test('payloads of the wrong shape have no readings', () => {
  expect(opponentReadings('Shooting Type', {})).toEqual([]);
  expect(opponentReadings('Traditional', [])).toEqual([]);
  expect(opponentReadings('Traditional', null)).toEqual([]);
});

test('the bar scale is the widest gap from league, rounded up to 5%', () => {
  expect(barScale([{ rows: [{ vs: -13.1 }, { vs: 2 }] }])).toBe(15);
  expect(barScale([{ rows: [{ vs: 1 }, { vs: null }] }])).toBe(5);
});

const group = (title, rows) => ({
  key: title ?? 'all',
  title,
  rows: Array.from({ length: rows }, (_, i) => ({ key: `${title}-${i}` })),
});
const shape = (columns) =>
  columns.map((column) =>
    column.map((g) => `${g.title}:${g.rows.length}${g.continued ? '+' : ''}`),
  );

test('lists of up to twelve lines stay in one column', () => {
  // Playtypes: 11 rows. Assists: 2 titled groups, 9 rows.
  expect(shape(splitColumns([group(null, 11)]))).toEqual([['null:11']]);
  expect(shape(splitColumns([group('Volume', 2), group('By shot', 7)]))).toEqual([
    ['Volume:2', 'By shot:7'],
  ]);
});

test('longer lists split between groups when that balances', () => {
  // Traditional: 8 + 4 + 4 rows under three titles.
  expect(
    shape(splitColumns([group('Scoring', 8), group('Boards', 4), group('Defense', 4)])),
  ).toEqual([['Scoring:8'], ['Boards:4', 'Defense:4']]);
});

test('a split inside a group never strands fewer than two rows', () => {
  // Shooting Type: 5 + 5 + 3 rows. Splitting Pull-ups would leave it one row.
  expect(shape(splitColumns([group('C&S', 5), group('Pull-ups', 5), group('Inside', 3)]))).toEqual([
    ['C&S:5'],
    ['Pull-ups:5', 'Inside:3'],
  ]);
  // One long group splits in half, the second half marked as continued.
  expect(shape(splitColumns([group('Plays', 14)]))).toEqual([['Plays:7'], ['Plays:7+']]);
});
