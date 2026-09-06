import { apiClient } from '../config';
import {
  createTarget,
  decodeDietBaselines,
  fetchDietBaselines,
  decodeBacktest,
  decodePreview,
  decodeResolvedTargets,
  decodeTargets,
  deleteTarget,
  fetchResolvedTargets,
  fetchTargetBacktest,
  fetchTargetPreview,
  fetchTargets,
  updateTarget,
} from './targetsApi';

jest.mock('../config', () => ({
  apiClient: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() },
  getApiUrl: (name) =>
    ({
      TARGETS: '/api/user/targets',
      TARGET_PREVIEW: '/api/user/targets/preview',
      DIET_BASELINES: '/api/diet/baselines',
    })[name],
}));

const wireTarget = {
  id: 7,
  opponent: 'OKC',
  title: 'OKC vs Corner 3 ≥ 40%',
  note: 'Leaks the corner late.',
  created_at: '2026-04-08T15:12:00Z',
  qualifiers: [
    { base: 'shot_zones', slice_key: 'Corner 3', comparator: 'at_or_above', threshold: 0.4 },
  ],
};

beforeEach(() => {
  jest.clearAllMocks();
});

test('decodes the list to what the UI needs, keeping the backend order', () => {
  expect(
    decodeTargets({
      success: true,
      targets: [wireTarget, { ...wireTarget, id: 8, opponent: 'BOS', note: null }],
    }),
  ).toEqual([
    {
      id: 7,
      opponent: 'OKC',
      title: 'OKC vs Corner 3 ≥ 40%',
      note: 'Leaks the corner late.',
      createdAt: '2026-04-08T15:12:00Z',
      qualifiers: [
        { base: 'shot_zones', sliceKey: 'Corner 3', comparator: 'at_or_above', threshold: 0.4 },
      ],
    },
    {
      id: 8,
      opponent: 'BOS',
      title: 'OKC vs Corner 3 ≥ 40%',
      note: '',
      createdAt: '2026-04-08T15:12:00Z',
      qualifiers: [
        { base: 'shot_zones', sliceKey: 'Corner 3', comparator: 'at_or_above', threshold: 0.4 },
      ],
    },
  ]);
});

test('refuses a response that is not the documented list', () => {
  expect(() => decodeTargets({ success: true })).toThrow(/invalid response/i);
  // Every Target is opened by id, so a record without one cannot be reached.
  expect(() => decodeTargets({ targets: [{ ...wireTarget, id: undefined }] })).toThrow(
    /invalid response/i,
  );
  // The title is the backend's to derive, so a record without one is unusable.
  expect(() => decodeTargets({ targets: [{ ...wireTarget, title: undefined }] })).toThrow(
    /invalid response/i,
  );
  // A player fits by meeting every Qualifier, so no Qualifiers means no filter.
  expect(() => decodeTargets({ targets: [{ ...wireTarget, qualifiers: [] }] })).toThrow(
    /invalid response/i,
  );
  expect(() =>
    decodeTargets({
      targets: [{ ...wireTarget, qualifiers: [{ ...wireTarget.qualifiers[0], threshold: 40 }] }],
    }),
  ).toThrow(/invalid response/i);
  expect(() =>
    decodeTargets({
      targets: [
        { ...wireTarget, qualifiers: [{ ...wireTarget.qualifiers[0], comparator: 'gte' }] },
      ],
    }),
  ).toThrow(/invalid response/i);
});

test('fetches the list from the documented path', async () => {
  apiClient.get.mockResolvedValue({ data: { success: true, targets: [] } });
  const controller = new AbortController();

  await expect(fetchTargets({ signal: controller.signal })).resolves.toEqual([]);
  expect(apiClient.get).toHaveBeenCalledWith('/api/user/targets', {
    signal: controller.signal,
  });
});

/*
 * Create is the one mutation that answers with a record. A surface that
 * confirms a save by name shows the title the backend derived, so the created
 * Target has to come back decoded rather than be inferred from what was sent.
 */
test('creates a Target with the wire shape of its Qualifiers and returns what was stored', async () => {
  apiClient.post.mockResolvedValue({ data: { success: true, target: wireTarget } });

  await expect(
    createTarget({
      opponent: 'OKC',
      note: 'Leaks the corner late.',
      qualifiers: [
        { base: 'shot_zones', sliceKey: 'Corner 3', comparator: 'at_or_above', threshold: 0.4 },
      ],
    }),
  ).resolves.toMatchObject({ id: 7, title: 'OKC vs Corner 3 ≥ 40%' });

  expect(apiClient.post).toHaveBeenCalledWith('/api/user/targets', {
    opponent: 'OKC',
    note: 'Leaks the corner late.',
    qualifiers: [
      { base: 'shot_zones', slice_key: 'Corner 3', comparator: 'at_or_above', threshold: 0.4 },
    ],
  });
});

test('edits only the Qualifiers and the note of one Target', async () => {
  apiClient.patch.mockResolvedValue({ data: { success: true } });

  await updateTarget({
    id: 7,
    note: '',
    qualifiers: [
      { base: 'play_types', sliceKey: 'Transition', comparator: 'at_or_below', threshold: 0.15 },
    ],
  });

  expect(apiClient.patch).toHaveBeenCalledWith('/api/user/targets/7', {
    note: '',
    qualifiers: [
      { base: 'play_types', slice_key: 'Transition', comparator: 'at_or_below', threshold: 0.15 },
    ],
  });
});

test('deletes one Target by id', async () => {
  apiClient.delete.mockResolvedValue({ data: { success: true } });

  await deleteTarget({ id: 7 });

  expect(apiClient.delete).toHaveBeenCalledWith('/api/user/targets/7');
});

const wireResolvedLive = {
  target: wireTarget,
  game: {
    game_id: '0022500584',
    scheduled_at: '2026-01-16T00:30:00Z',
    status: { state: 'scheduled', label: 'Scheduled' },
    away: { team_id: 1610612747, tricode: 'LAL', name: 'Los Angeles Lakers' },
    home: { team_id: 1610612760, tricode: 'OKC', name: 'Oklahoma City Thunder' },
    opponent: { team_id: 1610612760, tricode: 'OKC', name: 'Oklahoma City Thunder' },
    opposing_team: { team_id: 1610612747, tricode: 'LAL', name: 'Los Angeles Lakers' },
  },
  context: [
    {
      base: 'shot_zones',
      slice_key: 'Corner 3',
      label: 'Corner 3',
      availability: {
        season: { status: 'available', unavailable_reason: null },
        last_15: { status: 'available', unavailable_reason: null },
      },
      metrics: [
        {
          key: 'Corner 3:FGA',
          label: 'Corner 3 FGA',
          markets: ['FGA', 'FG3A'],
          opponent: {
            season: {
              allowed_per_48: 9.4,
              percent_vs_league_average: 9.7,
              sigma_deviation: 1.2,
              rank: 27,
            },
            last_15: {
              allowed_per_48: 8.1,
              percent_vs_league_average: -4.2,
              sigma_deviation: -0.6,
              rank: 11,
            },
          },
          league: {
            season: { average_allowed_per_48: 8.6, sigma: 0.7 },
            last_15: { average_allowed_per_48: 8.5, sigma: 0.6 },
          },
        },
      ],
    },
  ],
  availability: {
    status: 'available',
    source: 'player_pool',
    context: 'current',
    unavailable_reason: null,
  },
  players: [
    {
      canonical_id: 2544,
      name: 'LeBron James',
      team_id: 1610612747,
      tricode: 'LAL',
      posted_markets: ['PTS'],
      injury_badge_ref: null,
      season_scoring: 25.4,
      thin: false,
      shares: [
        { base: 'shot_zones', slice_key: 'Corner 3', share: 0.44, league_average_share: 0.2 },
      ],
    },
  ],
};

const wireResolvedIdle = {
  target: { ...wireTarget, id: 8, opponent: 'MIA' },
  game: null,
  context: [],
  availability: {
    status: 'unavailable',
    source: null,
    context: null,
    unavailable_reason: 'opponent_idle',
  },
  players: [],
};

const resolvePayload = (targets) => ({ success: true, slate_date: '2026-01-15', targets });

test('decodes a live Target into the readings and fits the day-scoped surfaces render', () => {
  expect(decodeResolvedTargets(resolvePayload([wireResolvedLive]))).toEqual({
    slateDate: '2026-01-15',
    entries: [
      {
        target: expect.objectContaining({ id: 7, opponent: 'OKC' }),
        game: {
          gameId: '0022500584',
          scheduledAt: '2026-01-16T00:30:00.000Z',
          status: { state: 'scheduled', label: 'Scheduled' },
          // Which side is at home, so a Target can name the game the way the
          // Slate row does; and which side it is about, so it can name the
          // pool it filtered.
          away: { tricode: 'LAL' },
          home: { tricode: 'OKC' },
          opponent: { tricode: 'OKC' },
          opposingTeam: { tricode: 'LAL' },
        },
        availability: { status: 'available', source: 'player_pool', unavailableReason: null },
        context: [
          {
            label: 'Corner 3',
            metrics: [
              {
                key: 'Corner 3:FGA',
                label: 'Corner 3 FGA',
                season: {
                  allowedPer48: 9.4,
                  percentVsLeagueAverage: 9.7,
                  sigmaDeviation: 1.2,
                  rank: 27,
                },
                last15: {
                  allowedPer48: 8.1,
                  percentVsLeagueAverage: -4.2,
                  sigmaDeviation: -0.6,
                  rank: 11,
                },
              },
            ],
          },
        ],
        players: [
          {
            canonicalId: 2544,
            name: 'LeBron James',
            tricode: 'LAL',
            seasonScoring: 25.4,
            thin: false,
            shares: [{ share: 0.44, leagueAverageShare: 0.2 }],
          },
        ],
      },
    ],
  });
});

test('an idle Target keeps its record and states that nothing named a pool', () => {
  const { entries } = decodeResolvedTargets(resolvePayload([wireResolvedLive, wireResolvedIdle]));

  // Live first, then idle: the order is the backend's and is not re-sorted.
  expect(entries.map((entry) => entry.target.opponent)).toEqual(['OKC', 'MIA']);
  expect(entries[1]).toMatchObject({
    game: null,
    context: [],
    players: [],
    availability: { status: 'unavailable', source: null, unavailableReason: 'opponent_idle' },
  });
});

test('an unavailable window carries no reading, and a reading under one is refused', () => {
  const playTypesLast15Unavailable = {
    ...wireResolvedLive,
    context: [
      {
        ...wireResolvedLive.context[0],
        availability: {
          season: { status: 'available', unavailable_reason: null },
          last_15: { status: 'unavailable', unavailable_reason: 'provider_unsupported' },
        },
        metrics: [{ ...wireResolvedLive.context[0].metrics[0], opponent: { season: null } }],
      },
    ],
  };

  expect(() => decodeResolvedTargets(resolvePayload([playTypesLast15Unavailable]))).toThrow(
    /invalid response/i,
  );

  const readings = decodeResolvedTargets(
    resolvePayload([
      {
        ...playTypesLast15Unavailable,
        context: [
          {
            ...playTypesLast15Unavailable.context[0],
            metrics: [
              {
                ...wireResolvedLive.context[0].metrics[0],
                opponent: {
                  season: wireResolvedLive.context[0].metrics[0].opponent.season,
                  last_15: null,
                },
              },
            ],
          },
        ],
      },
    ]),
  ).entries[0].context[0].metrics[0];
  expect(readings.season).toEqual({
    allowedPer48: 9.4,
    percentVsLeagueAverage: 9.7,
    sigmaDeviation: 1.2,
    rank: 27,
  });
  expect(readings.last15).toBeNull();

  expect(() =>
    decodeResolvedTargets(
      resolvePayload([
        {
          ...playTypesLast15Unavailable,
          context: [
            {
              ...playTypesLast15Unavailable.context[0],
              metrics: wireResolvedLive.context[0].metrics,
            },
          ],
        },
      ]),
    ),
  ).toThrow(/invalid response/i);
});

test('refuses a resolution the day-scoped surfaces could not render honestly', () => {
  expect(() => decodeResolvedTargets({ success: true, targets: [] })).toThrow(/invalid response/i);
  expect(() =>
    decodeResolvedTargets(resolvePayload([{ ...wireResolvedLive, game: undefined }])),
  ).toThrow(/invalid response/i);

  // The game chip names the sides; a game that does not say which is at home
  // cannot be named the way the Slate row names it.
  expect(() =>
    decodeResolvedTargets(
      resolvePayload([
        { ...wireResolvedLive, game: { ...wireResolvedLive.game, home: undefined } },
      ]),
    ),
  ).toThrow(/invalid response/i);

  // The allowed figure leads every reading, so a row without one is unusable.
  expect(() =>
    decodeResolvedTargets(
      resolvePayload([
        {
          ...wireResolvedLive,
          context: [
            {
              ...wireResolvedLive.context[0],
              metrics: [
                {
                  ...wireResolvedLive.context[0].metrics[0],
                  opponent: {
                    season: {
                      percent_vs_league_average: 9.7,
                      sigma_deviation: 1.2,
                      rank: 27,
                    },
                    last_15: null,
                  },
                },
              ],
              availability: {
                season: { status: 'available', unavailable_reason: null },
                last_15: { status: 'unavailable', unavailable_reason: 'provider_unsupported' },
              },
            },
          ],
        },
      ]),
    ),
  ).toThrow(/invalid response/i);

  // Context is index-parallel with the Qualifiers, so a shorter list would
  // show one Qualifier's readings under another.
  expect(() =>
    decodeResolvedTargets(resolvePayload([{ ...wireResolvedLive, context: [] }])),
  ).toThrow(/invalid response/i);

  // So are a fit's shares, which is what puts one column per Qualifier.
  expect(() =>
    decodeResolvedTargets(
      resolvePayload([
        {
          ...wireResolvedLive,
          players: [{ ...wireResolvedLive.players[0], shares: [] }],
        },
      ]),
    ),
  ).toThrow(/invalid response/i);

  // An unavailable pool listing players would make the explicit unavailable
  // line a lie about the list beside it.
  expect(() =>
    decodeResolvedTargets(
      resolvePayload([
        {
          ...wireResolvedLive,
          availability: {
            status: 'unavailable',
            source: 'player_pool',
            context: 'current',
            unavailable_reason: 'player_pool_unavailable',
          },
        },
      ]),
    ),
  ).toThrow(/invalid response/i);

  expect(() =>
    decodeResolvedTargets(
      resolvePayload([
        {
          ...wireResolvedLive,
          availability: { ...wireResolvedLive.availability, source: 'rotowire' },
        },
      ]),
    ),
  ).toThrow(/invalid response/i);

  // A date the calendar does not have cannot be the day being shown.
  expect(() => decodeResolvedTargets({ slate_date: '2026-02-30', targets: [] })).toThrow(
    /invalid response/i,
  );
});

test('resolves against the Slate date the caller is showing, or the current one', async () => {
  apiClient.get.mockResolvedValue({ data: resolvePayload([]) });

  await expect(fetchResolvedTargets({ date: '2026-01-15' })).resolves.toEqual({
    slateDate: '2026-01-15',
    entries: [],
  });
  expect(apiClient.get).toHaveBeenCalledWith('/api/user/targets/resolve', {
    params: { date: '2026-01-15' },
    signal: undefined,
  });

  await fetchResolvedTargets();
  expect(apiClient.get).toHaveBeenLastCalledWith('/api/user/targets/resolve', {
    params: {},
    signal: undefined,
  });
});

/*
 * The season-to-date backtest: the league-wide players who meet the Qualifiers
 * and have faced the opponent, and their games in the outcome markets the
 * Qualifiers' slices map to.
 */
const wireBacktest = {
  success: true,
  target: wireTarget,
  season: '2025-26',
  proxy: 'Outcomes are box-score proxies; there are no per-game slice splits.',
  stat_columns: ['PTS', '3PM'],
  // The summary is the backend's arithmetic over every listed game, so the
  // saved detail and the Lab read the same numbers: +5.6 and -3.2 in points
  // average +1.2, and one of the two games was over.
  summary: {
    players: 2,
    games: 2,
    columns: {
      PTS: { mean_difference: 1.2, over_average_share: 0.5 },
      '3PM': { mean_difference: 0.5, over_average_share: 0.5 },
    },
  },
  players: [
    {
      canonical_id: 2544,
      name: 'LeBron James',
      team_id: 1610612747,
      tricode: 'LAL',
      season_scoring: 25.4,
      shares: [
        { base: 'shot_zones', slice_key: 'Corner 3', share: 0.44, league_average_share: 0.2 },
      ],
      season_averages: { PTS: 25.4, '3PM': 2 },
      games: [
        {
          game_id: '0022500584',
          game_date: '2026-01-12',
          matchup: 'LAL vs. OKC',
          minutes: 36,
          stats: { PTS: 31, '3PM': 4 },
        },
      ],
    },
    {
      canonical_id: 1628369,
      name: 'Jayson Tatum',
      team_id: 1610612738,
      tricode: 'BOS',
      season_scoring: 27.2,
      shares: [
        { base: 'shot_zones', slice_key: 'Corner 3', share: 0.41, league_average_share: 0.2 },
      ],
      season_averages: { PTS: 27.2, '3PM': 3 },
      games: [
        {
          game_id: '0022500612',
          game_date: '2025-12-19',
          matchup: 'BOS @ OKC',
          minutes: 38,
          stats: { PTS: 24, '3PM': 2 },
        },
      ],
    },
  ],
};

test('decodes the backtest to the rows the table reads, in the backend order', () => {
  expect(decodeBacktest(wireBacktest)).toEqual({
    target: {
      id: 7,
      opponent: 'OKC',
      title: 'OKC vs Corner 3 ≥ 40%',
      note: 'Leaks the corner late.',
      createdAt: '2026-04-08T15:12:00Z',
      qualifiers: [
        { base: 'shot_zones', sliceKey: 'Corner 3', comparator: 'at_or_above', threshold: 0.4 },
      ],
    },
    proxy: 'Outcomes are box-score proxies; there are no per-game slice splits.',
    statColumns: ['PTS', '3PM'],
    summary: {
      players: 2,
      games: 2,
      columns: {
        PTS: { meanDifference: 1.2, overAverageShare: 0.5 },
        '3PM': { meanDifference: 0.5, overAverageShare: 0.5 },
      },
    },
    // The backend orders the players by season scoring; a decoder that sorted
    // or grouped them would put the table in an order nobody chose.
    players: [
      {
        canonicalId: 2544,
        name: 'LeBron James',
        tricode: 'LAL',
        shares: [{ share: 0.44, leagueAverageShare: 0.2 }],
        seasonAverages: { PTS: 25.4, '3PM': 2 },
        games: [{ gameDate: '2026-01-12', stats: { PTS: 31, '3PM': 4 } }],
      },
      {
        canonicalId: 1628369,
        name: 'Jayson Tatum',
        tricode: 'BOS',
        shares: [{ share: 0.41, leagueAverageShare: 0.2 }],
        seasonAverages: { PTS: 27.2, '3PM': 3 },
        games: [{ gameDate: '2025-12-19', stats: { PTS: 24, '3PM': 2 } }],
      },
    ],
  });
  expect(decodeBacktest(wireBacktest).players.map((player) => player.name)).toEqual([
    'LeBron James',
    'Jayson Tatum',
  ]);

  // Nobody qualifying, or nobody having faced the opponent, is a backtest with
  // no players rather than a refusal.
  expect(decodeBacktest({ ...wireBacktest, players: [] }).players).toEqual([]);
});

test('refuses a backtest whose rows would be read under the wrong heading', () => {
  // The columns name every stat a row shows, so a game missing one would put a
  // blank where an outcome belongs.
  expect(() =>
    decodeBacktest({
      ...wireBacktest,
      players: [
        {
          ...wireBacktest.players[0],
          games: [{ ...wireBacktest.players[0].games[0], stats: { PTS: 31 } }],
        },
      ],
    }),
  ).toThrow(/invalid response/i);

  // And the season average every game is read against is in the same columns.
  expect(() =>
    decodeBacktest({
      ...wireBacktest,
      players: [{ ...wireBacktest.players[0], season_averages: { PTS: 25.4 } }],
    }),
  ).toThrow(/invalid response/i);

  // The shares are index-parallel with the Qualifiers, as a fit's are.
  expect(() =>
    decodeBacktest({
      ...wireBacktest,
      players: [{ ...wireBacktest.players[0], shares: [] }],
    }),
  ).toThrow(/invalid response/i);

  // A player is in the backtest because they have faced the opponent, so one
  // with no game is a row the table would silently drop.
  expect(() =>
    decodeBacktest({ ...wireBacktest, players: [{ ...wireBacktest.players[0], games: [] }] }),
  ).toThrow(/invalid response/i);

  // A backtest with no columns has no outcome to report.
  expect(() => decodeBacktest({ ...wireBacktest, stat_columns: [] })).toThrow(/invalid response/i);

  // The note that outcomes are proxies is the response's, never this page's.
  expect(() => decodeBacktest({ ...wireBacktest, proxy: undefined })).toThrow(/invalid response/i);

  // A date the calendar does not have cannot name a game that was played.
  expect(() =>
    decodeBacktest({
      ...wireBacktest,
      players: [
        {
          ...wireBacktest.players[0],
          games: [{ ...wireBacktest.players[0].games[0], game_date: '2026-02-30' }],
        },
      ],
    }),
  ).toThrow(/invalid response/i);

  // The summary is computed by the backend so that the Lab and the saved
  // detail agree; a backtest without one, or one that skips a column the
  // table shows, would leave the strip to guess.
  expect(() => decodeBacktest({ ...wireBacktest, summary: undefined })).toThrow(
    /invalid response/i,
  );
  expect(() =>
    decodeBacktest({
      ...wireBacktest,
      summary: { ...wireBacktest.summary, columns: { PTS: wireBacktest.summary.columns.PTS } },
    }),
  ).toThrow(/invalid response/i);
  // A share of games is a share.
  expect(() =>
    decodeBacktest({
      ...wireBacktest,
      summary: {
        ...wireBacktest.summary,
        columns: {
          ...wireBacktest.summary.columns,
          PTS: { mean_difference: 1.2, over_average_share: 50 },
        },
      },
    }),
  ).toThrow(/invalid response/i);
});

/*
 * A Draft Target is evaluated exactly as a saved one would be, so its preview
 * is the backtest shape with two differences: the Target echoed back is the
 * validated draft with its derived title and no id, and `today` says whether
 * the draft fires on the current Slate date.
 */
const wireDraft = {
  opponent: 'OKC',
  title: 'OKC vs Corner 3 ≥ 40%',
  note: '',
  qualifiers: wireTarget.qualifiers,
};

const wirePreview = {
  ...wireBacktest,
  target: wireDraft,
  today: { game: wireResolvedLive.game, fit_count: 2 },
};

test('decodes a preview to the backtest the Lab reads, plus whether it fires tonight', () => {
  const preview = decodePreview(wirePreview);
  expect(preview.target).toEqual({
    opponent: 'OKC',
    title: 'OKC vs Corner 3 ≥ 40%',
    note: '',
    qualifiers: [
      { base: 'shot_zones', sliceKey: 'Corner 3', comparator: 'at_or_above', threshold: 0.4 },
    ],
  });
  expect(preview.summary).toEqual(decodeBacktest(wireBacktest).summary);
  expect(preview.players).toEqual(decodeBacktest(wireBacktest).players);
  expect(preview.today).toEqual({
    game: {
      gameId: '0022500584',
      scheduledAt: '2026-01-16T00:30:00.000Z',
      status: { state: 'scheduled', label: 'Scheduled' },
      away: { tricode: 'LAL' },
      home: { tricode: 'OKC' },
      opponent: { tricode: 'OKC' },
      opposingTeam: { tricode: 'LAL' },
    },
    fitCount: 2,
  });

  // An opponent with no game on the Slate date has no tonight to speak of.
  expect(decodePreview({ ...wirePreview, today: null }).today).toBeNull();
});

test('refuses a preview that could not honestly say whether the draft fires', () => {
  // A game without a count, or a count without a game, is half an answer.
  expect(() => decodePreview({ ...wirePreview, today: { game: wireResolvedLive.game } })).toThrow(
    /invalid response/i,
  );
  expect(() => decodePreview({ ...wirePreview, today: { game: null, fit_count: 2 } })).toThrow(
    /invalid response/i,
  );
  expect(() => decodePreview({ ...wirePreview, today: undefined })).toThrow(/invalid response/i);
  // The draft's title is the backend's to derive, as a saved Target's is.
  expect(() =>
    decodePreview({ ...wirePreview, target: { ...wireDraft, title: undefined } }),
  ).toThrow(/invalid response/i);
});

test('previews a draft at the documented path with the create body', async () => {
  apiClient.post.mockResolvedValue({ data: wirePreview });
  const controller = new AbortController();

  await expect(
    fetchTargetPreview({
      opponent: 'OKC',
      note: '',
      qualifiers: [
        { base: 'shot_zones', sliceKey: 'Corner 3', comparator: 'at_or_above', threshold: 0.4 },
      ],
      signal: controller.signal,
    }),
  ).resolves.toEqual(expect.objectContaining({ today: expect.objectContaining({ fitCount: 2 }) }));
  expect(apiClient.post).toHaveBeenCalledWith(
    '/api/user/targets/preview',
    {
      opponent: 'OKC',
      note: '',
      qualifiers: [
        { base: 'shot_zones', slice_key: 'Corner 3', comparator: 'at_or_above', threshold: 0.4 },
      ],
    },
    { signal: controller.signal },
  );
});

test("reads one Target's backtest from the documented path", async () => {
  apiClient.get.mockResolvedValue({ data: wireBacktest });
  const controller = new AbortController();

  await expect(fetchTargetBacktest({ id: 7, signal: controller.signal })).resolves.toEqual(
    expect.objectContaining({ statColumns: ['PTS', '3PM'] }),
  );
  expect(apiClient.get).toHaveBeenCalledWith('/api/user/targets/7/backtest', {
    signal: controller.signal,
  });
});

test('league baselines decode shares, preserve absent slices and use authenticated transport', async () => {
  const payload = {
    season: '2025-26',
    captured_at: '2026-04-09T00:00:00Z',
    shares: { shot_zones: { 'Corner 3': 0.23, Unknown: null } },
  };
  expect(decodeDietBaselines(payload).shares).toEqual(payload.shares);
  for (const value of [-1, 1.1, '0.2', Infinity])
    expect(() =>
      decodeDietBaselines({ ...payload, shares: { shot_zones: { bad: value } } }),
    ).toThrow(/invalid response/);
  expect(() => decodeDietBaselines({ shares: [] })).toThrow(/invalid response/);
  apiClient.get.mockResolvedValue({ data: payload });
  await fetchDietBaselines();
  expect(apiClient.get).toHaveBeenCalledWith('/api/diet/baselines', { signal: undefined });
});

test('stat-only PATCH preserves omitted criteria and encodes the preference independently', async () => {
  await updateTarget({ id: 7, statPreferences: { columns: ['PTS/36'], gradedBy: 'PTS/36' } });
  expect(apiClient.patch).toHaveBeenCalledWith('/api/user/targets/7', {
    stat_preferences: { columns: ['PTS/36'], graded_by: 'PTS/36' },
  });
  await updateTarget({ id: 7, statPreferences: null });
  expect(apiClient.patch).toHaveBeenLastCalledWith('/api/user/targets/7', {
    stat_preferences: null,
  });
});

const fullLine = {
  points: 20,
  rebounds: 7,
  assists: 5,
  field_goals_made: 7,
  field_goals_attempted: 14,
  threes_made: 2,
  threes_attempted: 5,
  free_throws_made: 4,
  free_throws_attempted: 4,
  steals: 1,
  blocks: 1,
  turnovers: 2,
  offensive_rebounds: 1,
  defensive_rebounds: 6,
  fouls: 3,
  minutes: 30,
};
test('decodes the full line, season totals and stat preference in saved and preview responses', () => {
  const extended = {
    ...wireBacktest,
    target: {
      ...wireBacktest.target,
      stat_preferences: { columns: ['PTS/36', 'FG%'], graded_by: 'PTS/36' },
    },
    players: [
      {
        ...wireBacktest.players[0],
        season_totals: fullLine,
        season_games: 1,
        games: [{ ...wireBacktest.players[0].games[0], line: fullLine }],
      },
    ],
  };
  const decoded = decodeBacktest(extended);
  expect(decoded.target.statPreferences).toEqual({
    columns: ['PTS/36', 'FG%'],
    gradedBy: 'PTS/36',
  });
  expect(decoded.players[0]).toEqual(
    expect.objectContaining({ seasonTotals: fullLine, seasonGames: 1 }),
  );
  expect(decoded.players[0].games[0].line).toEqual(fullLine);
  expect(decodePreview({ ...extended, today: null }).target.statPreferences).toEqual(
    decoded.target.statPreferences,
  );
  expect(
    decodeTargets({ targets: [{ ...wireTarget, stat_preferences: null }] })[0].statPreferences,
  ).toBeNull();
  expect(() =>
    decodeBacktest({
      ...extended,
      players: [{ ...extended.players[0], season_totals: { ...fullLine, points: '20' } }],
    }),
  ).toThrow(/invalid response/);
  expect(() =>
    decodeBacktest({
      ...extended,
      players: [
        {
          ...extended.players[0],
          games: [{ ...extended.players[0].games[0], line: { ...fullLine, minutes: undefined } }],
        },
      ],
    }),
  ).toThrow(/invalid response/);
});
test.each([
  { columns: [], graded_by: 'PTS' },
  { columns: ['invented'], graded_by: 'invented' },
  { columns: ['PTS'], graded_by: 'AST' },
  { columns: ['PTS', 'PTS'], graded_by: 'PTS' },
])('refuses malformed stat preferences %j', (stat_preferences) => {
  expect(() => decodeTargets({ targets: [{ ...wireTarget, stat_preferences }] })).toThrow(
    /invalid response/,
  );
});
