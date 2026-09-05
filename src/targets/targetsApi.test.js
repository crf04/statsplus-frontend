import { apiClient } from '../config';
import {
  createTarget,
  decodeResolvedTargets,
  decodeTargets,
  deleteTarget,
  fetchResolvedTargets,
  fetchTargets,
  updateTarget,
} from './targetsApi';

jest.mock('../config', () => ({
  apiClient: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() },
  getApiUrl: (name) => `/api/user/${name.toLowerCase()}`,
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

test('creates a Target with the wire shape of its Qualifiers', async () => {
  apiClient.post.mockResolvedValue({ data: { success: true } });

  await createTarget({
    opponent: 'OKC',
    note: 'Leaks the corner late.',
    qualifiers: [
      { base: 'shot_zones', sliceKey: 'Corner 3', comparator: 'at_or_above', threshold: 0.4 },
    ],
  });

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
                season: { percentVsLeagueAverage: 9.7, sigmaDeviation: 1.2, rank: 27 },
                last15: { percentVsLeagueAverage: -4.2, sigmaDeviation: -0.6, rank: 11 },
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
  expect(readings.season.rank).toBe(27);
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
