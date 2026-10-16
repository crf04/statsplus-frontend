import { bookMark, bookName, shouldDisplayDietShare, sliceName } from './displayConfig';

test.each([
  ['playTypes', { sigmaDeviation: 0.5, volumePerGame: 1 }, true],
  ['playTypes', { sigmaDeviation: -0.5, volumePerGame: 1 }, true],
  ['playTypes', { sigmaDeviation: 0.49, volumePerGame: 9 }, false],
  ['playTypes', { sigmaDeviation: -0.49, volumePerGame: 9 }, false],
  ['playTypes', { sigmaDeviation: 9, volumePerGame: 0.99 }, false],
  ['playTypes', { sigmaDeviation: null, volumePerGame: 9 }, false],
  ['shotZones', { sigmaDeviation: 0.5, volumePerGame: 1 }, true],
  ['shotZones', { sigmaDeviation: -0.5, volumePerGame: 1 }, true],
  ['shotZones', { sigmaDeviation: 0.49, volumePerGame: 9 }, false],
  ['shotZones', { sigmaDeviation: -0.49, volumePerGame: 9 }, false],
  ['shotZones', { sigmaDeviation: 9, volumePerGame: 0.99 }, false],
  ['shotZones', { sigmaDeviation: null, volumePerGame: 9 }, false],
  ['shotTypes', { sigmaDeviation: 0.5, volumePerGame: 4 }, true],
  ['shotTypes', { sigmaDeviation: -0.5, volumePerGame: 4 }, true],
  ['shotTypes', { sigmaDeviation: 0.49, volumePerGame: 9 }, false],
  ['shotTypes', { sigmaDeviation: -0.49, volumePerGame: 9 }, false],
  ['shotTypes', { sigmaDeviation: 9, volumePerGame: 3.99 }, false],
  ['shotTypes', { sigmaDeviation: null, volumePerGame: 9 }, false],
  ['assistLocations', { sigmaDeviation: 0.5, volumePerGame: 1 }, true],
  ['assistLocations', { sigmaDeviation: -0.5, volumePerGame: 1 }, true],
  ['assistLocations', { sigmaDeviation: 0.49, volumePerGame: 9 }, false],
  ['assistLocations', { sigmaDeviation: -0.49, volumePerGame: 9 }, false],
  ['assistLocations', { sigmaDeviation: 9, volumePerGame: 0.99 }, false],
  ['assistLocations', { sigmaDeviation: null, volumePerGame: 9 }, false],
  ['shotValues', { sigmaDeviation: 0.5, volumePerGame: 2 }, true],
  ['shotValues', { sigmaDeviation: -0.5, volumePerGame: 2 }, true],
  ['shotValues', { sigmaDeviation: 0.49, volumePerGame: 9 }, false],
  ['shotValues', { sigmaDeviation: 9, volumePerGame: 1.99 }, false],
  ['shotValues', { sigmaDeviation: null, volumePerGame: 9 }, false],
])(
  '%s gating returns %s for the named sigma deviation and volume floors',
  (base, value, expected) => {
    expect(shouldDisplayDietShare(base, value)).toBe(expected);
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
