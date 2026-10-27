import { deriveTargetTitle, formatQualifier } from './targetCatalog';

const corner = {
  base: 'shot_zones',
  sliceKey: 'Corner 3',
  comparator: 'at_or_above',
  threshold: 0.4,
};
const average = { base: 'season_average', stat: '3PA', comparator: 'at_or_above', threshold: 0.3 };

test('a Position leads the title whatever order it was entered in, joined as Wing/Big', () => {
  expect(
    deriveTargetTitle({
      opponent: 'MEM',
      qualifiers: [corner, average, { base: 'position', groups: ['Wing', 'Big'] }],
    }),
  ).toBe('MEM vs Wing/Big, Corner 3 ≥ 40%, 3PA avg ≥ 0.3');
});

test('Qualifiers read in the units they are written in', () => {
  expect(formatQualifier(corner)).toBe('Corner 3 ≥ 40%');
  expect(
    formatQualifier({ ...average, stat: 'PTS/36', comparator: 'at_or_below', threshold: 17.5 }),
  ).toBe('PTS/36 avg ≤ 17.5');
  expect(formatQualifier({ base: 'position', groups: ['Big'] })).toBe('Big');
});
