import { seasonOfDate, seasonOfGameId } from './gameSeason';

test.each([
  ['2026-10-01', '2026-27'],
  ['2026-12-31', '2026-27'],
  ['2027-01-01', '2026-27'],
  ['2027-09-30', '2026-27'],
  ['2026-04-12', '2025-26'],
  ['2099-11-01', '2099-00'],
])('the Slate of %s is a %s date', (date, season) => {
  expect(seasonOfDate(date)).toBe(season);
});

test.each([
  ['0022600003', '2026-27'],
  ['0022500584', '2025-26'],
  ['0042500101', '2025-26'],
  ['0010900001', '2009-10'],
  ['game-1', null],
  ['22600003', null],
  [undefined, null],
])('game %s is a %s game', (gameId, season) => {
  expect(seasonOfGameId(gameId)).toBe(season);
});
