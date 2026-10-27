import { decodeTeamStats } from './teamStatsApi';

jest.mock('./config', () => ({ apiClient: { get: jest.fn() }, getApiUrl: (key) => key }));

test('a bare body is the data, with no season context', () => {
  expect(decodeTeamStats({ OPP_PTS: 110.8 })).toEqual({
    data: { OPP_PTS: 110.8 },
    seasonContext: undefined,
  });
  expect(decodeTeamStats([{ SHOT_TYPE: 'Dunk' }])).toEqual({
    data: [{ SHOT_TYPE: 'Dunk' }],
    seasonContext: undefined,
  });
});

test('a wrapped body unwraps its data, season context and trailing families', () => {
  expect(
    decodeTeamStats({
      data: [],
      season_context: { selected_season: '2026-27', published_season: '2025-26' },
      trailing: [
        {
          family: 'team_defense',
          serving_season: '2025-26',
          rule: 'every team has played a game',
          team_games: { min: 82, max: 82 },
        },
      ],
    }),
  ).toEqual({
    data: [],
    seasonContext: { selectedSeason: '2026-27', publishedSeason: '2025-26' },
    trailing: [
      {
        family: 'team_defense',
        servingSeason: '2025-26',
        rule: 'every team has played a game',
        teamGames: { min: 82, max: 82 },
      },
    ],
  });
});

test('a wrapped body without data or with a malformed season context is refused', () => {
  expect(() =>
    decodeTeamStats({
      season_context: { selected_season: '2026-27', published_season: '2025-26' },
    }),
  ).toThrow('The team stats endpoint returned an invalid response.');
  expect(() => decodeTeamStats({ data: {}, season_context: { selected_season: 2026 } })).toThrow(
    'The team stats endpoint returned an invalid response.',
  );
});
