import { formatFocalGameLine, shouldDisplayDietShare } from './displayConfig';

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
