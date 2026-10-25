import { apiClient } from './config';
import { decodeGameLogsResponse, fetchGameLogsData, getRequestErrorMessage } from './gameLogsApi';
import { decodeMatchup, decodeMatchupSelection, fetchMatchup } from './matchups/matchupApi';
import { payload as matchupPayload } from './matchups/matchupPayloadFixture';
import { decodeSeasons } from './seasonsApi';
import { SeasonUnavailableError } from './servingSeason';
import { decodeSlate, fetchSlate } from './slateApi';
import { closingPoolSlatePayload } from './slateClosingPoolFixture';
import { decodeSlateEdges, fetchSlateEdges } from './slateEdgesApi';
import { decodeDietBaselines, fetchDietBaselines } from './targets/targetsApi';

jest.mock('./config', () => ({
  apiClient: { get: jest.fn() },
  getApiUrl: jest.fn((key) => key),
}));

afterEach(() => jest.clearAllMocks());

// Explicit Evidence season selection (crf04/statsplus#330, Boundary contract).
const seasonContext = { selected_season: '2026-27', published_season: '2025-26' };
const decodedContext = { selectedSeason: '2026-27', publishedSeason: '2025-26' };

const selection = {
  player_id: 2544,
  h2h: { thin: false, rows: [] },
  archetype: { thin: true, rows: [] },
};
const edges = {
  slate_date: '2026-10-24',
  games: [],
  spotlight: { best: null, toughest: null },
};
const baselines = { shares: { shot_types: { 'Catch and Shoot': 0.31 } } };
const gameLogs = { game_logs: [], averages: [], season_averages: [] };

describe.each([
  ['Matchup', (data) => decodeMatchup(data), matchupPayload],
  ['Matchup selection', (data) => decodeMatchupSelection(data, ['PTS'], 2544), selection],
  ['Slate', (data) => decodeSlate(data), closingPoolSlatePayload],
  ['Slate edges', (data) => decodeSlateEdges(data), edges],
  ['Diet baselines', (data) => decodeDietBaselines(data), baselines],
  ['game logs', (data) => decodeGameLogsResponse(data), gameLogs],
])('%s season_context', (_name, decode, data) => {
  test('reads an explicit selection as its selected and Published Season', () => {
    expect(decode({ ...data, season_context: seasonContext }).seasonContext).toEqual(
      decodedContext,
    );
  });

  test('reads an omitted-season response as no selection, otherwise unchanged', () => {
    const decoded = decode(data);
    expect(decoded.seasonContext).toBeUndefined();
    expect(decode({ ...data, season_context: seasonContext })).toEqual({
      ...decoded,
      seasonContext: decodedContext,
    });
  });

  test.each([
    null,
    '2026-27',
    { selected_season: '2026-27' },
    { selected_season: '2026', published_season: '2025-26' },
    { selected_season: '2026-27', published_season: null },
  ])('refuses a malformed season_context %p', (value) => {
    expect(() => decode({ ...data, season_context: value })).toThrow();
  });
});

test('a Matchup whose season_context contradicts as_of.season is refused', () => {
  const withAsOf = { ...matchupPayload, as_of: { season: '2025-26' } };
  expect(decodeMatchup({ ...withAsOf, season_context: seasonContext }).asOfSeason).toBe('2025-26');
  expect(() =>
    decodeMatchup({
      ...withAsOf,
      season_context: { selected_season: '2026-27', published_season: '2026-27' },
    }),
  ).toThrow('The matchup endpoint returned an invalid response.');
});

test('a held candidate in the generation list does not change the decoded Slate or Matchup', () => {
  const candidate = {
    generation: [
      { stream_key: 'grouped_shot_types', publication_id: 7, fence: 2, version: 1 },
      {
        stream_key: 'exact_shot_zones',
        publication_id: 9,
        fence: 1,
        version: 1,
        status: 'candidate',
      },
    ],
  };
  expect(
    decodeSlate({
      ...closingPoolSlatePayload,
      provenance: { ...closingPoolSlatePayload.provenance, ...candidate },
    }),
  ).toEqual(decodeSlate(closingPoolSlatePayload));
  expect(decodeMatchup({ ...matchupPayload, provenance: candidate })).toEqual(
    decodeMatchup(matchupPayload),
  );
});

describe('/api/games/seasons choices', () => {
  const legacy = { seasons: ['2025-26', '2024-25'], default_season: '2025-26' };
  const choices = [
    {
      season: '2025-26',
      mode: 'published',
      families: { game_logs: { served_season: '2025-26', state: 'serving' } },
    },
    {
      season: '2026-27',
      mode: 'unpublished',
      families: {
        game_logs: { served_season: '2026-27', state: 'serving' },
        player_diets: {
          served_season: '2025-26',
          state: 'trailing',
          reason: 'every team has played 10 games',
        },
      },
      team_games: { min: 2, max: 3 },
    },
    { season: '2024-25', mode: 'retained', families: {} },
  ];

  test('keeps seasons and the default season, and reads no choices from an older backend', () => {
    expect(decodeSeasons(legacy)).toEqual({
      seasons: ['2025-26', '2024-25'],
      defaultSeason: '2025-26',
      choices: undefined,
    });
  });

  test('reads every choice with its mode, families and team games', () => {
    expect(decodeSeasons({ ...legacy, choices })).toEqual({
      seasons: ['2025-26', '2024-25'],
      defaultSeason: '2025-26',
      choices: [
        {
          season: '2025-26',
          mode: 'published',
          families: { game_logs: { servedSeason: '2025-26', state: 'serving', reason: null } },
          teamGames: null,
        },
        {
          season: '2026-27',
          mode: 'unpublished',
          families: {
            game_logs: { servedSeason: '2026-27', state: 'serving', reason: null },
            player_diets: {
              servedSeason: '2025-26',
              state: 'trailing',
              reason: 'every team has played 10 games',
            },
          },
          teamGames: { min: 2, max: 3 },
        },
        { season: '2024-25', mode: 'retained', families: {}, teamGames: null },
      ],
    });
  });

  const choice = choices[1];
  test.each([
    ['choices that are not a list', { season: '2026-27' }],
    ['an unknown mode', [{ ...choice, mode: 'candidate' }]],
    ['a malformed season', [{ ...choice, season: '2026' }]],
    ['families that are not a record', [{ ...choice, families: [] }]],
    [
      'a family without its served season',
      [{ ...choice, families: { game_logs: { state: 'serving' } } }],
    ],
    [
      'a family without a state',
      [{ ...choice, families: { game_logs: { served_season: '2026-27' } } }],
    ],
    [
      'an empty reason',
      [
        {
          ...choice,
          families: { game_logs: { served_season: '2026-27', state: 'serving', reason: '' } },
        },
      ],
    ],
    ['team games whose fewest exceed their most', [{ ...choice, team_games: { min: 4, max: 3 } }]],
    ['fractional team games', [{ ...choice, team_games: { min: 1.5, max: 3 } }]],
    ['a season offered twice', [choice, choice]],
  ])('refuses %s', (_name, value) => {
    expect(() => decodeSeasons({ ...legacy, choices: value })).toThrow(
      'The seasons endpoint returned an invalid response.',
    );
  });
});

describe('503 season_unavailable', () => {
  const refusal = (error) =>
    Object.assign(new Error('Request failed with status code 503'), {
      response: {
        status: 503,
        data: { error },
        headers: { 'x-request-id': 'abcdef0123456789' },
      },
    });
  const backendRefusal = refusal({
    code: 'season_unavailable',
    message: 'The requested season is unavailable.',
    details: { season: '2026-27', published_season: '2025-26', stream: 'player_game_logs' },
  });

  test.each([
    ['Matchup', () => fetchMatchup('0022600011')],
    ['Slate', () => fetchSlate('2026-10-24')],
    ['Slate edges', () => fetchSlateEdges({ date: '2026-10-24' })],
    ['Diet baselines', () => fetchDietBaselines()],
    ['game logs', () => fetchGameLogsData({ season_filter: '2026-27' })],
  ])('%s refuses with the typed error naming both seasons', async (_name, read) => {
    apiClient.get.mockRejectedValue(backendRefusal);
    const error = await read().catch((failure) => failure);
    expect(error).toBeInstanceOf(SeasonUnavailableError);
    expect([error.selectedSeason, error.publishedSeason, error.message]).toEqual([
      '2026-27',
      '2025-26',
      'The requested season is unavailable.',
    ]);
    expect(getRequestErrorMessage(error)).toBe(
      'The requested season is unavailable. (ref abcdef01)',
    );
  });

  test('a bare season_unavailable code is the typed error without seasons', async () => {
    apiClient.get.mockRejectedValue(refusal('season_unavailable'));
    const error = await fetchSlate('2026-10-24').catch((failure) => failure);
    expect(error).toBeInstanceOf(SeasonUnavailableError);
    expect([error.selectedSeason, error.publishedSeason]).toEqual([null, null]);
  });

  test('any other 503 is the failure it was', async () => {
    const outage = refusal({ code: 'provider_unavailable', message: 'down' });
    apiClient.get.mockRejectedValue(outage);
    await expect(fetchSlate('2026-10-24')).rejects.toBe(outage);
  });
});
