import { formatFocalGameLine, shouldDisplayDietShare } from './displayConfig';

test.each([
  ['playTypes', { sigmaDeviation: 1, volumePerGame: 1 }, true],
  ['playTypes', { sigmaDeviation: 0.99, volumePerGame: 9 }, false],
  ['playTypes', { sigmaDeviation: 9, volumePerGame: 0.99 }, false],
  ['playTypes', { sigmaDeviation: null, volumePerGame: 9 }, false],
  ['shotZones', { sigmaDeviation: 1, volumePerGame: 1 }, true],
  ['shotZones', { sigmaDeviation: 0.99, volumePerGame: 9 }, false],
  ['shotZones', { sigmaDeviation: null, volumePerGame: 9 }, false],
  ['shotTypes', { sigmaDeviation: 1, volumePerGame: 4 }, true],
  ['shotTypes', { sigmaDeviation: 9, volumePerGame: 3.99 }, false],
  ['shotTypes', { sigmaDeviation: null, volumePerGame: 9 }, false],
  ['assistLocations', { sigmaDeviation: 1, volumePerGame: 1 }, true],
  ['assistLocations', { sigmaDeviation: 9, volumePerGame: 0.99 }, false],
  ['assistLocations', { sigmaDeviation: null, volumePerGame: 9 }, false],
])(
  '%s gating returns %s for the named sigma deviation and volume floors',
  (base, value, expected) => {
    expect(shouldDisplayDietShare(base, value)).toBe(expected);
  },
);

const focalGameLine = {
  gameId: '0022501082',
  gameDate: '2026-03-29',
  matchup: 'LAC @ MIL',
  minutes: 34.5,
  stats: { PTS: 24, REB: 5, AST: 7 },
};

test('states the focal game line the same way wherever it is shown', () => {
  expect(formatFocalGameLine(focalGameLine, ['PTS', 'REB', 'AST'])).toBe(
    'Focal game LAC @ MIL · 34.5 MIN · 24.0 PTS · 5.0 REB · 7.0 AST',
  );
  // The rail scopes to the selected category; the dossier dates the outcome.
  expect(formatFocalGameLine(focalGameLine, ['REB'])).toBe(
    'Focal game LAC @ MIL · 34.5 MIN · 5.0 REB',
  );
  expect(formatFocalGameLine(focalGameLine, ['PTS'], { includeDate: true })).toBe(
    'Focal game LAC @ MIL · 2026-03-29 · 34.5 MIN · 24.0 PTS',
  );
});
