import { decodeShotZoneMatchup } from './shotZoneMatchupApi';

const payload = (overrides = {}) => ({
  players: [
    {
      diet_shares: {
        shot_zones: [
          { key: 'Restricted Area', season: { share: 0.313, league_average_share: 0.276 } },
          { key: 'Corner 3', season: { share: 0.02, league_average_share: null } },
        ],
      },
    },
  ],
  teams: [
    {
      tricode: 'CHA',
      defense_sheet: {
        shot_zones: [
          { key: 'Restricted Area:FGA', season: { rank: 17, percent_vs_league_average: 0.8 } },
          { key: 'Restricted Area:FGM', season: { rank: 18, percent_vs_league_average: -0.3 } },
          { key: 'Corner 3:FGM', season: { rank: 2, percent_vs_league_average: null } },
        ],
      },
    },
  ],
  ...overrides,
});

test('reads his Diet share and the opponent made-shot row for every zone', () => {
  expect(decodeShotZoneMatchup(payload(), 'CHA')).toEqual({
    opponent: 'CHA',
    zones: {
      'Restricted Area': { share: 0.313, leagueShare: 0.276, rank: 18, percentVsLeague: -0.3 },
      'In The Paint (Non-RA)': {
        share: null,
        leagueShare: null,
        rank: null,
        percentVsLeague: null,
      },
      'Mid-Range': { share: null, leagueShare: null, rank: null, percentVsLeague: null },
      'Corner 3': { share: 0.02, leagueShare: null, rank: 2, percentVsLeague: null },
      'Above the Break 3': { share: null, leagueShare: null, rank: null, percentVsLeague: null },
    },
  });
});

test.each([
  ['an opponent the response does not carry', payload(), 'BOS'],
  [
    'a share above one',
    payload({
      players: [
        {
          diet_shares: {
            shot_zones: [{ key: 'Mid-Range', season: { share: 1.2, league_average_share: 0.1 } }],
          },
        },
      ],
    }),
    'CHA',
  ],
  [
    'a rank outside 1-30',
    payload({
      teams: [
        {
          tricode: 'CHA',
          defense_sheet: {
            shot_zones: [
              { key: 'Mid-Range:FGM', season: { rank: 31, percent_vs_league_average: 1 } },
            ],
          },
        },
      ],
    }),
    'CHA',
  ],
  ['more than one player', payload({ players: [{}, {}] }), 'CHA'],
  ['no Diet', payload({ players: [{ diet_shares: {} }] }), 'CHA'],
])('refuses %s', (_, data, opponent) => {
  expect(() => decodeShotZoneMatchup(data, opponent)).toThrow(
    'The shot zone matchup API returned an invalid response.',
  );
});
