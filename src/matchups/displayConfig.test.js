import { shouldDisplayDietShare } from './displayConfig';

test.each([
  ['playTypes', { share: 0.15, volumePerGame: 0 }, true],
  ['playTypes', { share: 0.149, volumePerGame: 9 }, false],
  ['shotZones', { share: 0.25, volumePerGame: 0 }, true],
  ['shotZones', { share: 0.249, volumePerGame: 9 }, false],
  ['shotTypes', { share: 0.35, volumePerGame: 4 }, true],
  ['shotTypes', { share: 0.4, volumePerGame: 3.99 }, false],
  ['assistLocations', { share: 0.3, volumePerGame: 1 }, true],
  ['assistLocations', { share: 0.35, volumePerGame: 0.99 }, false],
])('%s gating returns %s for the named share and volume floors', (base, value, expected) => {
  expect(shouldDisplayDietShare(base, value)).toBe(expected);
});
