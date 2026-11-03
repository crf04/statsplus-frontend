import { execFileSync } from 'node:child_process';
import { decodeMatchup } from './matchupApi';

// The browser fixture is an ES module with a JSON import, which Jest does not
// load, so Node reads it and hands back the payload.
const readFixture = (name = 'scoreCoverageMatchupPayload') =>
  JSON.parse(
    execFileSync(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        `import { ${name} } from './e2e/fixtures/courtai-contract.mjs';
         console.log(JSON.stringify(${name}));`,
      ],
      { cwd: process.cwd(), encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
    ),
  );

describe('the statsplus#407 browser fixture decodes beside today’s shape', () => {
  const matchup = decodeMatchup(readFixture());
  const player = (name) => matchup.players.find((candidate) => candidate.name === name);

  test('LeBron’s new scores reach the page', () => {
    const { scores } = player('LeBron James');
    expect(scores.PTS.season.components.traditional).toEqual({ value: 0.03, thin: false });
    expect(scores.TOV.season.blend.value).toBeCloseTo(0.23, 10);
    expect(scores.TOV.season.blend).toEqual(scores.TOV.season.components.traditional);
    expect(scores.FTA.season).toEqual({
      components: { traditional: { value: -0.11, thin: false } },
      blend: { value: -0.11, thin: false },
      missingInputs: [],
    });
    expect(scores.FGM.season.blend).toEqual({ value: 0.04, thin: false });
    expect(Object.hasOwn(scores, 'FTM')).toBe(false);
  });

  test('a defensive market with no Blend still decodes', () => {
    expect(player('Austin Reaves').scores.STL.season.blend).toBeNull();
  });

  test('both teams list their shot make rows under FGM and FG2M', () => {
    matchup.teams.forEach((team) => {
      const { shotZones, shotTypes, traditional } = team.defenseSheet;
      const listed = (market) =>
        [...shotZones, ...shotTypes, ...traditional]
          .filter((row) => row.markets.includes(market))
          .map((row) => row.key);
      expect(listed('FGM')).toEqual([
        'Restricted Area:FGM',
        'Above the Break 3:FGM',
        'Pullups:FG2M',
        'Catch and Shoot:FG3M',
        'OPP_FGM',
      ]);
      expect(listed('FG2M')).toEqual(['Restricted Area:FGM', 'Pullups:FG2M']);
    });
  });

  test('both teams list the eight new Traditional rows with their markets', () => {
    matchup.teams.forEach((team) => {
      expect(
        team.defenseSheet.traditional
          .filter((row) => !['OPP_REB', 'OPP_TOV', 'OPP_STL', 'OPP_BLK'].includes(row.key))
          .map((row) => [row.key, row.markets]),
      ).toEqual([
        ['OPP_PTS', ['PTS', 'PA', 'PR', 'PRA']],
        ['OPP_AST', ['AST', 'PA', 'RA', 'PRA']],
        ['OPP_FGM', ['FGM']],
        ['OPP_FGA', ['FGA']],
        ['OPP_FG3M', ['3PM']],
        ['OPP_FG3A', ['FG3A']],
        ['OPP_FTM', ['FTM']],
        ['OPP_FTA', ['FTA']],
      ]);
    });
  });
});

describe('the statsplus#416 browser fixture decodes', () => {
  const matchup = decodeMatchup(readFixture('playTypeTurnoverMatchupPayload'));
  const lebron = matchup.players.find((candidate) => candidate.name === 'LeBron James');

  test('LeBron’s TOV and FTA carry a Play types component beside Traditional', () => {
    expect(lebron.scores.TOV.season.components.playTypes).toEqual({ value: 0.09, thin: false });
    expect(lebron.scores.TOV.season.blend).toEqual({ value: 0.16, thin: false });
    expect(lebron.scores.FTA.season).toEqual({
      components: {
        traditional: { value: -0.11, thin: false },
        playTypes: { value: 0.05, thin: true },
      },
      blend: { value: -0.03, thin: false },
      missingInputs: [],
    });
    expect(Object.keys(lebron.scores.TOV.last15.components)).toEqual(['traditional']);
  });

  test('both teams list the shown play types’ turnover and FT trip rows, without Misc', () => {
    matchup.teams.forEach((team) => {
      expect(
        team.defenseSheet.playTypes
          .filter((row) => /:(TOV|FTT)$/.test(row.key))
          .map((row) => [row.key, row.markets, row.last15]),
      ).toEqual([
        ['Transition:TOV', ['TOV'], null],
        ['PRBallHandler:TOV', ['TOV'], null],
        ['Isolation:TOV', ['TOV'], null],
        ['PRBallHandler:FTT', ['FTA', 'FTM'], null],
        ['Postup:FTT', ['FTA', 'FTM'], null],
        ['Isolation:FTT', ['FTA', 'FTM'], null],
      ]);
    });
  });
});
