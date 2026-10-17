import { execFileSync } from 'node:child_process';

// The browser fixture is an ES module with a JSON import, which Jest does not
// load, so Node reads it and hands back the numbers the identity needs.
const readFixture = () =>
  JSON.parse(
    execFileSync(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        `import { matchupPayload, historicalMatchupPayload } from './e2e/fixtures/courtai-contract.mjs';
         console.log(JSON.stringify({ matchupPayload, historicalMatchupPayload }));`,
      ],
      { cwd: process.cwd(), encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
    ),
  );

const SLICES = [
  'DefTwoPtRebounds',
  'DefThreePtRebounds',
  'FTDefRebounds',
  'OffTwoPtRebounds',
  'OffThreePtRebounds',
  'FTOffRebounds',
];
const sum = (values) => values.reduce((total, value) => total + value, 0);

describe('the fixture publishes Rebound Types as a breakdown of OPP_REB', () => {
  const fixture = readFixture();

  test.each([
    ['live matchup', 'matchupPayload', [45, 46]],
    ['historical matchup', 'historicalMatchupPayload', [45, 46]],
  ])('%s: each team adds up to its Season OPP_REB in both windows', (_name, key, totals) => {
    const { teams } = fixture[key];
    expect(teams).toHaveLength(2);
    teams.forEach((team, index) => {
      const rows = team.defense_sheet.rebound_types;
      expect(rows.map((row) => row.key)).toEqual(SLICES);
      const opponentRebounds = team.defense_sheet.traditional.find((row) => row.key === 'OPP_REB');
      expect(opponentRebounds.season.allowed_per_48).toBe(totals[index]);
      expect(sum(rows.map((row) => row.season.allowed_per_48))).toBeCloseTo(totals[index], 6);
      // The fixture withholds Last 15 OPP_REB, so Last 15 slices add up to the Season total.
      if (key === 'matchupPayload') {
        expect(sum(rows.map((row) => row.last_15.allowed_per_48))).toBeCloseTo(totals[index], 6);
      }
    });
  });

  test('the league averages add up to the league OPP_REB average in both windows', () => {
    const rows = fixture.matchupPayload.league.defense_sheet.rebound_types;
    expect(rows.map((row) => row.key)).toEqual(SLICES);
    const opponentRebounds = fixture.matchupPayload.league.defense_sheet.traditional.find(
      (row) => row.key === 'OPP_REB',
    );
    expect(opponentRebounds.season.average_allowed_per_48).toBe(46);
    expect(sum(rows.map((row) => row.season.average_allowed_per_48))).toBeCloseTo(46, 6);
    expect(sum(rows.map((row) => row.last_15.average_allowed_per_48))).toBeCloseTo(46, 6);
  });
});
