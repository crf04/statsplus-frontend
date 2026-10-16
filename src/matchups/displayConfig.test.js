import { bookMark, bookName, shouldDisplayDietShare, sliceName } from './displayConfig';

test.each([
  ['playTypes', { sigmaDeviation: 0.5 }, 1, true],
  ['playTypes', { sigmaDeviation: -0.5 }, 1, true],
  ['playTypes', { sigmaDeviation: 0.49 }, 9, false],
  ['playTypes', { sigmaDeviation: -0.49 }, 9, false],
  ['playTypes', { sigmaDeviation: 9 }, 0.99, false],
  ['playTypes', { sigmaDeviation: null }, 9, false],
  ['shotZones', { sigmaDeviation: 0.5 }, 1, true],
  ['shotZones', { sigmaDeviation: -0.5 }, 1, true],
  ['shotZones', { sigmaDeviation: 0.49 }, 9, false],
  ['shotZones', { sigmaDeviation: -0.49 }, 9, false],
  ['shotZones', { sigmaDeviation: 9 }, 0.99, false],
  ['shotZones', { sigmaDeviation: null }, 9, false],
  ['shotTypes', { sigmaDeviation: 0.5 }, 4, true],
  ['shotTypes', { sigmaDeviation: -0.5 }, 4, true],
  ['shotTypes', { sigmaDeviation: 0.49 }, 9, false],
  ['shotTypes', { sigmaDeviation: -0.49 }, 9, false],
  ['shotTypes', { sigmaDeviation: 9 }, 3.99, false],
  ['shotTypes', { sigmaDeviation: null }, 9, false],
  ['assistLocations', { sigmaDeviation: 0.5 }, 1, true],
  ['assistLocations', { sigmaDeviation: -0.5 }, 1, true],
  ['assistLocations', { sigmaDeviation: 0.49 }, 9, false],
  ['assistLocations', { sigmaDeviation: -0.49 }, 9, false],
  ['assistLocations', { sigmaDeviation: 9 }, 0.99, false],
  ['assistLocations', { sigmaDeviation: null }, 9, false],
])(
  '%s gating of %j at %s a game in the whole Base returns %s',
  (base, value, baseVolumePerGame, expected) => {
    expect(shouldDisplayDietShare(base, value, baseVolumePerGame)).toBe(expected);
  },
);

test.each([
  ['Arc3Assists', 'Above-the-break 3s'],
  ['OffRebound', 'Putbacks'],
  ['Less Than 10 ft', 'Under 10 ft'],
  ['OPP_REB', 'Rebounds'],
  ['Catch and Shoot', 'Catch-and-shoot'],
])('names the %s slice in plain English', (sliceKey, expected) => {
  expect(sliceName(sliceKey)).toBe(expected);
});

test.each([
  ['dabble', 'Dabble', 'DB'],
  ['kalshi', 'Kalshi', 'KX'],
  ['novig', 'Novig', 'NV'],
  ['polymarket', 'Polymarket', 'PM'],
  ['prizepicks', 'PrizePicks', 'PP'],
  ['underdog', 'Underdog', 'UD'],
  ['draftkings', 'DraftKings', 'DK'],
  ['fanduel', 'FanDuel', 'FD'],
])('names the %s book %s and marks it %s', (provider, name, mark) => {
  expect(bookName(provider)).toBe(name);
  expect(bookMark(provider)).toBe(mark);
});
