import { opponentExtremes } from './opponentExtremes';

const row = (label, family, markets, mostRank) => ({
  group: 'Traditional',
  label,
  unit: 'count',
  value: 10,
  most_rank: mostRank,
  ranked_teams: 30,
  team_filter: null,
  vs_league_pct: null,
  family,
  markets,
});

const opponentRanks = [
  row('Points allowed', 'points', ['PTS'], 6),
  row('Inside 10 ft 2PA', 'inside', ['PTS'], 1),
  row('Inside 10 ft attempts', 'inside', ['PTS'], 1),
  row('In The Paint (Non-RA) attempts', 'inside', ['PTS'], 3),
  row('In The Paint (Non-RA) makes', 'inside', ['PTS'], 5),
  row('Rebounds', 'rebounds', ['REB'], 2),
  row('Off. rebounds', 'rebounds', ['REB'], 4),
  row('Putback points', 'rebounds', ['PTS', 'REB'], 7),
  row('Assists', 'assists', ['AST'], 28),
  row('Corner-3 assists', '3pt-assists', ['AST'], 8),
  row('Steals', 'steals-blocks', ['STL'], 3),
  row('Steals + blocks', 'steals-blocks', ['STL', 'BLK'], 2),
  row('Blocks', 'steals-blocks', ['BLK'], 30),
  row('Transition', 'play-type:transition', ['PTS'], 4),
  row('Turnovers forced', 'turnovers', ['TOV'], 15),
];

const labels = (lineType, rows = opponentRanks) =>
  opponentExtremes(rows, lineType).map((stat) => stat.label);

test('AC1: points shows one inside row among the rows bearing on PTS', () => {
  expect(labels('PTS')).toEqual([
    'Inside 10 ft 2PA',
    'Transition',
    'Points allowed',
    'Putback points',
  ]);
});

test('AC2: rebounds shows at most one rebound-family row and nothing else', () => {
  expect(labels('REB')).toEqual(['Rebounds']);
});

test('AC3: steals shows one of Steals and Steals + blocks, never Blocks', () => {
  expect(labels('STL')).toEqual(['Steals + blocks']);
});

test('AC4: PRA shows rows bearing on PTS, REB or AST, one per family', () => {
  expect(labels('PRA')).toEqual([
    'Inside 10 ft 2PA',
    'Rebounds',
    'Assists',
    'Transition',
    'Points allowed',
    'Corner-3 assists',
  ]);
});

test('steals + blocks bears on both STL and BLK', () => {
  expect(labels('STKS')).toEqual(['Blocks']);
});

test.each(['None', 'FD_PTS', 'FG3A'])(
  'AC5: %s applies no stat filter and shows every family once',
  (lineType) => {
    expect(labels(lineType)).toEqual([
      'Blocks',
      'Inside 10 ft 2PA',
      'Rebounds',
      'Assists',
      'Transition',
      'Points allowed',
      'Corner-3 assists',
    ]);
  },
);

test('AC6: rows without family or markets list every top and bottom 8 rank as before', () => {
  const legacy = opponentRanks.map(({ family, markets, ...stat }) => stat);
  expect(labels('PTS', legacy)).toEqual([
    'Blocks',
    'Inside 10 ft 2PA',
    'Inside 10 ft attempts',
    'Rebounds',
    'Steals + blocks',
    'Assists',
    'In The Paint (Non-RA) attempts',
    'Steals',
    'Off. rebounds',
    'Transition',
    'In The Paint (Non-RA) makes',
    'Points allowed',
    'Putback points',
    'Corner-3 assists',
  ]);
});

test('a fewest-end row takes its place and filter tier from the fewest end', () => {
  expect(opponentExtremes(opponentRanks, 'BLK')).toEqual([
    expect.objectContaining({ label: 'Blocks', fewest: true, place: 1, tier: [23, 30] }),
  ]);
});
