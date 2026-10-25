import { apiClient } from './config';
import { decodeGameLogsResponse, fetchGameLogsData, getRequestErrorMessage } from './gameLogsApi';
import {
  decodeMatchup,
  decodeMatchupSelection,
  fetchMatchup,
  fetchMatchupSelection,
} from './matchups/matchupApi';
import { payload as matchupPayload } from './matchups/matchupPayloadFixture';
import { fetchPlayerProfile } from './playerProfileApi';
import { decodeSeasons } from './seasonsApi';
import { SeasonAfterGameError, SeasonUnavailableError } from './servingSeason';
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
          reason: 'window_not_ready',
        },
        synergy: { served_season: null, state: 'unavailable', reason: 'upstream_missing' },
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
              reason: 'window_not_ready',
            },
            synergy: { servedSeason: null, state: 'unavailable', reason: 'upstream_missing' },
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
    ...[
      ['an unknown state', { served_season: '2026-27', state: 'stale' }],
      ['an empty state', { served_season: '2026-27', state: '' }],
      ['an unknown reason', { served_season: '2026-27', state: 'trailing', reason: 'later' }],
      ['an empty reason', { served_season: '2026-27', state: 'serving', reason: '' }],
      [
        'an unavailable family with a served season',
        { served_season: '2025-26', state: 'unavailable' },
      ],
      ['a serving family with no served season', { served_season: null, state: 'serving' }],
      ['a trailing family with no served season', { served_season: null, state: 'trailing' }],
    ].map(([name, family]) => [name, [{ ...choice, families: { game_logs: family } }]]),
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
    details: { selected_season: '2026-27', published_season: '2025-26' },
  });

  test.each([
    ['Matchup', () => fetchMatchup('0022600011')],
    ['Slate', () => fetchSlate('2026-10-24')],
    ['Slate edges', () => fetchSlateEdges({ date: '2026-10-24' })],
    ['Diet baselines', () => fetchDietBaselines()],
    ['game logs', () => fetchGameLogsData({ season_filter: '2026-27' })],
    [
      'Player Profile',
      () => fetchPlayerProfile({ player_name: 'LeBron James', season: '2026-27' }),
    ],
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

  test('a flat season_unavailable string is not the typed refusal', async () => {
    const flat = refusal('season_unavailable');
    apiClient.get.mockRejectedValue(flat);
    await expect(fetchSlate('2026-10-24')).rejects.toBe(flat);
  });

  test('a refusal without details is the typed error without seasons', async () => {
    apiClient.get.mockRejectedValue(refusal({ code: 'season_unavailable', message: 'Not yet.' }));
    const error = await fetchSlate('2026-10-24').catch((failure) => failure);
    expect(error).toBeInstanceOf(SeasonUnavailableError);
    expect([error.selectedSeason, error.publishedSeason, error.message]).toEqual([
      null,
      null,
      'Not yet.',
    ]);
  });

  test('a malformed season is the generic 400 invalid_input failure', async () => {
    const malformed = Object.assign(new Error('Request failed with status code 400'), {
      response: {
        status: 400,
        data: { error: { code: 'invalid_input', message: 'season must be YYYY-YY.' } },
        headers: { 'x-request-id': 'abcdef0123456789' },
      },
    });
    apiClient.get.mockRejectedValue(malformed);
    const error = await fetchMatchup('0022600011').catch((failure) => failure);
    expect(error).toBe(malformed);
    expect(getRequestErrorMessage(error)).toBe('season must be YYYY-YY.');
  });

  test('any other 503 is the failure it was', async () => {
    const outage = refusal({ code: 'provider_unavailable', message: 'down' });
    apiClient.get.mockRejectedValue(outage);
    await expect(fetchSlate('2026-10-24')).rejects.toBe(outage);
  });
});

describe('/api/players/profile', () => {
  const rows = [{ SHOT_TYPE: 'Catch and Shoot', FGA: 4.2 }];
  const summary = { PTS: 25.1, GP: 3 };
  const read = (body) => {
    apiClient.get.mockResolvedValue({ data: body });
    return fetchPlayerProfile({ player_name: 'LeBron James', category: 'Shooting Type' });
  };

  test.each([
    ['an array body', rows],
    ['an object body', summary],
  ])('reads %s with no season as today', async (_name, body) => {
    await expect(read(body)).resolves.toEqual({ data: body, seasonContext: undefined });
  });

  test.each([
    ['an array body', rows],
    ['an object body', summary],
  ])('unwraps %s under an explicit selection', async (_name, body) => {
    await expect(read({ data: body, season_context: seasonContext })).resolves.toEqual({
      data: body,
      seasonContext: decodedContext,
    });
  });

  test.each([
    ['an envelope without data', { season_context: seasonContext }],
    ['a malformed season_context', { data: rows, season_context: { selected_season: '2026' } }],
  ])('refuses %s', async (_name, body) => {
    await expect(read(body)).rejects.toThrow(
      'The player profile endpoint returned an invalid response.',
    );
  });
});

describe('400 season_after_game', () => {
  const afterGame = Object.assign(new Error('Request failed with status code 400'), {
    response: {
      status: 400,
      headers: {},
      data: {
        error: {
          code: 'season_after_game',
          message: 'The 2026-27 season cannot be selected for a 2025-26 game.',
          details: { selected_season: '2026-27', game_season: '2025-26' },
        },
      },
    },
  });

  test.each([
    ['Matchup', () => fetchMatchup('0022500011', { season: '2026-27' })],
    [
      'Matchup selection',
      () => fetchMatchupSelection('0022500011', 2544, ['PTS'], { season: '2026-27' }),
    ],
    ['Slate', () => fetchSlate('2026-04-10', { season: '2026-27' })],
  ])('%s refuses with the typed error naming both seasons', async (_name, read) => {
    apiClient.get.mockRejectedValue(afterGame);
    const error = await read().catch((failure) => failure);
    expect(error).toBeInstanceOf(SeasonAfterGameError);
    expect([error.selectedSeason, error.gameSeason]).toEqual(['2026-27', '2025-26']);
  });

  test('another 400 is the failure it was', async () => {
    const invalid = {
      ...afterGame,
      response: {
        ...afterGame.response,
        data: { error: { code: 'invalid_input', message: 'No.' } },
      },
    };
    apiClient.get.mockRejectedValue(invalid);
    await expect(fetchSlate('2026-04-10')).rejects.toBe(invalid);
  });
});

describe('season on the request', () => {
  beforeEach(() => apiClient.get.mockRejectedValue(new Error('stop')));
  const params = () => apiClient.get.mock.calls[0][1].params;

  test.each([
    ['Matchup', (season) => fetchMatchup('0022600011', { season }), { game_id: '0022600011' }],
    [
      'Matchup selection',
      (season) => fetchMatchupSelection('0022600011', 2544, ['PTS'], { season }),
      { game_id: '0022600011', player_id: 2544 },
    ],
    ['Slate', (season) => fetchSlate('2026-10-24', { season }), { date: '2026-10-24' }],
  ])('%s names an explicit season and nothing else', async (_name, read, base) => {
    await read('2026-27').catch(() => {});
    expect(params()).toEqual({ ...base, season: '2026-27' });
    apiClient.get.mockClear();
    await read(null).catch(() => {});
    expect(params()).toEqual(base);
  });
});

describe('trailing team_games', () => {
  const trailing = [
    {
      family: 'team_defense',
      serving_season: '2025-26',
      rule: 'every team has played 10 games',
      team_games: { min: 80, max: 82 },
    },
  ];

  test.each([
    ['Matchup', (data) => decodeMatchup(data), matchupPayload],
    ['Slate', (data) => decodeSlate(data), closingPoolSlatePayload],
  ])('%s reads each trailing sample, and none when absent', (_name, decode, data) => {
    expect(decode({ ...data, trailing }).trailing).toEqual([
      {
        family: 'team_defense',
        servingSeason: '2025-26',
        rule: 'every team has played 10 games',
        teamGames: { min: 80, max: 82 },
      },
    ]);
    const { team_games: _omitted, ...unsampled } = trailing[0];
    expect(decode({ ...data, trailing: [unsampled] }).trailing).toEqual([
      { family: 'team_defense', servingSeason: '2025-26', rule: 'every team has played 10 games' },
    ]);
  });

  test.each([null, { min: 3 }, { min: 4, max: 3 }, { min: 1.5, max: 3 }, { min: -1, max: 3 }])(
    'refuses a malformed sample %p',
    (teamGames) => {
      expect(() =>
        decodeMatchup({ ...matchupPayload, trailing: [{ ...trailing[0], team_games: teamGames }] }),
      ).toThrow('The matchup endpoint returned an invalid response.');
    },
  );
});
