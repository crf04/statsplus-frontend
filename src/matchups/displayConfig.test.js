import {
  bookMark,
  bookName,
  getDisplayableDietShare,
  shouldDisplayDietShare,
  sliceName,
} from './displayConfig';

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
  ['reboundTypes', { sigmaDeviation: 0.5 }, 1, true],
  ['reboundTypes', { sigmaDeviation: -0.5 }, 1, true],
  ['reboundTypes', { sigmaDeviation: 0.49 }, 9, false],
  ['reboundTypes', { sigmaDeviation: -0.49 }, 9, false],
  ['reboundTypes', { sigmaDeviation: 9 }, 0.99, false],
  ['reboundTypes', { sigmaDeviation: 9 }, 1, true],
  ['reboundTypes', { sigmaDeviation: null }, 9, false],
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
  ['DefTwoPtRebounds', 'DREB off 2PT misses'],
  ['DefThreePtRebounds', 'DREB off 3PT misses'],
  ['FTDefRebounds', 'DREB off FT misses'],
  ['OffTwoPtRebounds', 'OREB off 2PT misses'],
  ['OffThreePtRebounds', 'OREB off 3PT misses'],
  ['FTOffRebounds', 'OREB off FT misses'],
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

test('a rebound lean reads the whole Base volume, not the one slice', () => {
  const entry = (key, volumePerGame, sigmaDeviation) => ({
    key,
    season: { share: 0.2, volumePerGame, sigmaDeviation },
  });
  const player = (...entries) => ({ dietShares: { reboundTypes: entries } });

  // 0.4 a game on the slice, 1.2 across the Base: the Base clears the floor.
  const spread = player(entry('OffTwoPtRebounds', 0.4, 1.5), entry('DefTwoPtRebounds', 0.8, 0.1));
  expect(getDisplayableDietShare(spread, 'reboundTypes', 'OffTwoPtRebounds')).toEqual(
    spread.dietShares.reboundTypes[0].season,
  );
  // 0.4 + 0.59 = 0.99 across the Base: under the floor, however far the slice leans.
  const thin = player(entry('OffTwoPtRebounds', 0.4, 1.5), entry('DefTwoPtRebounds', 0.59, 0.1));
  expect(getDisplayableDietShare(thin, 'reboundTypes', 'OffTwoPtRebounds')).toBeNull();
});
