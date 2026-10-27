import { act, fireEvent, render, screen } from '@testing-library/react';
import PlayerProfile from './PlayerProfile';
import { apiClient } from './config';
import { publishedOnlySeasons, unpublishedSeasons } from './seasonChoicesFixture';

jest.mock('./config', () => ({ apiClient: { get: jest.fn() }, getApiUrl: (key) => key }));
jest.mock('./PlaystyleComparisonChart', () => () => <p>Playtype chart</p>);
jest.mock('./AssistProfileChart', () => () => <p>Assist chart</p>);
jest.mock('./TwoThreeAssistChart', () => () => null);

beforeEach(() => {
  jest.clearAllMocks();
  apiClient.get.mockResolvedValue({ data: [{ SHOT_TYPE: 'Jump Shot' }] });
});

test.each(['Playtypes', 'Assists', 'Shooting Type'])(
  '%s keeps the player read when the opponent changes',
  async (category) => {
    const { rerender } = render(<PlayerProfile selectedPlayer="LeBron James" selectedTeam="BOS" />);
    await act(async () => {});
    fireEvent.click(screen.getByLabelText(category));
    await act(async () => {});
    apiClient.get.mockClear();
    rerender(<PlayerProfile selectedPlayer="LeBron James" selectedTeam="NYK" />);
    await act(async () => {});
    expect(apiClient.get.mock.calls.filter(([url]) => url === 'PLAYER_PROFILE')).toHaveLength(0);
    if (category === 'Playtypes' || category === 'Assists') {
      expect(apiClient.get).toHaveBeenCalledWith(
        'TEAM_STATS',
        expect.objectContaining({ params: expect.objectContaining({ team: 'NYK' }) }),
      );
    } else {
      expect(apiClient.get).not.toHaveBeenCalled();
    }
  },
);

test('late comparison results are ignored while the pending player read stays usable', async () => {
  let resolvePlayer;
  let resolveOldTeam;
  apiClient.get.mockImplementation((url, { params }) => {
    if (url === 'PLAYER_PROFILE')
      return new Promise((resolve) => {
        resolvePlayer = resolve;
      });
    if (params.team === 'BOS')
      return new Promise((resolve) => {
        resolveOldTeam = resolve;
      });
    return Promise.resolve({ data: [{ value: 2 }] });
  });
  const { rerender } = render(<PlayerProfile selectedPlayer="LeBron James" selectedTeam="BOS" />);
  const oldTeamSignal = apiClient.get.mock.calls.find(([url]) => url === 'TEAM_STATS')[1].signal;
  rerender(<PlayerProfile selectedPlayer="LeBron James" selectedTeam="NYK" />);
  await act(async () => {});
  expect(screen.getByText('Loading data...')).toBeVisible();
  await act(async () => resolvePlayer({ data: [{ value: 1 }] }));
  expect(screen.getByText('Playtype chart')).toBeVisible();
  expect(oldTeamSignal.aborted).toBe(true);
  await act(async () => resolveOldTeam({ data: null }));
  expect(screen.getByText('Playtype chart')).toBeVisible();
  expect(screen.queryByText(/No data available for this team/)).not.toBeInTheDocument();
});

test('changing comparison cannot clear a player failure', async () => {
  apiClient.get.mockImplementation((url) =>
    url === 'PLAYER_PROFILE'
      ? Promise.reject(new Error('Failed player'))
      : Promise.resolve({ data: [{ value: 1 }] }),
  );
  const { rerender } = render(<PlayerProfile selectedPlayer="LeBron James" selectedTeam="BOS" />);
  await act(async () => {});
  expect(screen.getByText('Failed to fetch data. Please try again.')).toBeVisible();
  rerender(<PlayerProfile selectedPlayer="LeBron James" selectedTeam="NYK" />);
  await act(async () => {});
  expect(screen.getByText('Failed to fetch data. Please try again.')).toBeVisible();
});

test.each([
  ['rejected', 'Failed to fetch data. Please try again.'],
  ['empty', 'Failed to fetch data. Please try again. No data available for this team'],
])('player failure and %s comparison show clear failure messages', async (comparison, message) => {
  apiClient.get.mockImplementation((url) =>
    url === 'TEAM_STATS' && comparison === 'empty'
      ? Promise.resolve({ data: null })
      : Promise.reject(new Error('Offline')),
  );
  render(<PlayerProfile selectedPlayer="LeBron James" selectedTeam="BOS" />);
  await act(async () => {});
  expect(screen.getByText(message, { exact: true })).toBeVisible();
});

test('Shooting Type renders without unused comparison requests or failures', async () => {
  apiClient.get.mockImplementation((url) =>
    url === 'TEAM_STATS'
      ? Promise.reject(new Error('Comparison unavailable'))
      : Promise.resolve({ data: [{ SHOT_TYPE: 'Jump Shot' }] }),
  );
  render(<PlayerProfile selectedPlayer="LeBron James" selectedTeam="BOS" />);
  await act(async () => {});
  apiClient.get.mockClear();
  fireEvent.click(screen.getByLabelText('Shooting Type'));
  await act(async () => {});
  expect(apiClient.get.mock.calls.filter(([url]) => url === 'TEAM_STATS')).toHaveLength(0);
  expect(screen.getByText('Jump Shot')).toBeVisible();
  expect(screen.queryByText(/Failed to fetch/)).not.toBeInTheDocument();
});

const failedRequest = (status) =>
  Object.assign(new Error(`Request failed with status code ${status}`), {
    response: { status, headers: { 'x-request-id': '77070cec-3f5e-4b7a-9d0e-5a1c2b3d4e5f' } },
  });

test.each([
  ['PLAYER_PROFILE', 500, 'Failed to fetch data. Please try again. (ref 77070cec)'],
  ['TEAM_STATS', 500, 'Failed to fetch data. Please try again. (ref 77070cec)'],
  ['PLAYER_PROFILE', 400, 'Failed to fetch data. Please try again.'],
])('a %s read refused with %i shows %j', async (failing, status, text) => {
  apiClient.get.mockImplementation((url) =>
    url === failing
      ? Promise.reject(failedRequest(status))
      : Promise.resolve({ data: [{ value: 1 }] }),
  );
  render(<PlayerProfile selectedPlayer="LeBron James" selectedTeam="BOS" />);
  await act(async () => {});
  expect(screen.getByText(text)).toBeVisible();
});

const zoneMatchup = (opponent) => ({
  players: [
    {
      diet_shares: {
        shot_zones: [
          { key: 'Restricted Area', season: { share: 0.313, league_average_share: 0.276 } },
        ],
      },
    },
  ],
  teams: [
    {
      tricode: opponent,
      defense_sheet: {
        shot_zones: [
          { key: 'Restricted Area:FGM', season: { rank: 18, percent_vs_league_average: -0.3 } },
        ],
      },
    },
  ],
});

test('Zone Shooting reads the Matchup court against the page opponent and follows it', async () => {
  apiClient.get.mockImplementation((url, { params }) =>
    url === 'MATCHUP_UNSCHEDULED'
      ? Promise.resolve({ data: zoneMatchup(params.opponent) })
      : Promise.resolve({ data: [{ value: 1 }] }),
  );
  const { rerender } = render(
    <PlayerProfile selectedPlayer="LeBron James" selectedTeam="Boston Celtics" />,
  );
  await act(async () => {});
  apiClient.get.mockClear();
  fireEvent.click(screen.getByLabelText('Zone Shooting'));
  await act(async () => {});
  expect(apiClient.get.mock.calls.map(([url, { params }]) => [url, params])).toEqual([
    ['MATCHUP_UNSCHEDULED', { player_name: 'LeBron James', opponent: 'BOS' }],
  ]);
  expect(screen.getByText('Shot zones · vs BOS')).toBeVisible();
  expect(screen.getAllByText('31%')[0]).toBeVisible();

  apiClient.get.mockClear();
  rerender(<PlayerProfile selectedPlayer="LeBron James" selectedTeam="New York Knicks" />);
  await act(async () => {});
  expect(apiClient.get.mock.calls.map(([url, { params }]) => [url, params])).toEqual([
    ['MATCHUP_UNSCHEDULED', { player_name: 'LeBron James', opponent: 'NYK' }],
  ]);
  expect(screen.getByText('Shot zones · vs NYK')).toBeVisible();
});

test('Zone Shooting without an opponent asks for one and reads nothing', async () => {
  render(<PlayerProfile selectedPlayer="LeBron James" selectedTeam="" />);
  await act(async () => {});
  apiClient.get.mockClear();
  fireEvent.click(screen.getByLabelText('Zone Shooting'));
  await act(async () => {});
  expect(apiClient.get).not.toHaveBeenCalled();
  expect(
    screen.getByText('Pick an opponent in the Opposing Team card to see his zones against them.'),
  ).toBeVisible();
});

test('a refused Zone Shooting read shows the failure with its reference', async () => {
  apiClient.get.mockImplementation((url) =>
    url === 'MATCHUP_UNSCHEDULED'
      ? Promise.reject(failedRequest(500))
      : Promise.resolve({ data: [{ value: 1 }] }),
  );
  render(<PlayerProfile selectedPlayer="LeBron James" selectedTeam="Boston Celtics" />);
  await act(async () => {});
  fireEvent.click(screen.getByLabelText('Zone Shooting'));
  await act(async () => {});
  expect(screen.getByText('Failed to fetch data. Please try again. (ref 77070cec)')).toBeVisible();
});

test('Shooting Type reads the league baselines beside the profile', async () => {
  apiClient.get.mockImplementation((url) =>
    url === 'DIET_BASELINES'
      ? Promise.resolve({ data: { shares: { shot_types: { 'Catch and Shoot': 0.324 } } } })
      : Promise.resolve({ data: [{ SHOT_TYPE: 'C&S', FGA_FREQUENCY: 0.203 }] }),
  );
  render(<PlayerProfile selectedPlayer="LeBron James" selectedTeam="Boston Celtics" />);
  await act(async () => {});
  fireEvent.click(screen.getByLabelText('Shooting Type'));
  await act(async () => {});
  expect(screen.getByText('Catch & shoot')).toBeVisible();
  expect(screen.getByText('lg 32%')).toBeVisible();
});

test('a late answer for an earlier opponent cannot replace the current court or its readiness', async () => {
  const pending = {};
  apiClient.get.mockImplementation((url, { params }) =>
    url === 'MATCHUP_UNSCHEDULED'
      ? new Promise((resolve, reject) => {
          pending[params.opponent] = { resolve, reject };
        })
      : Promise.resolve({ data: [{ value: 1 }] }),
  );
  const onSettled = jest.fn();
  const view = (team) => (
    <PlayerProfile selectedPlayer="LeBron James" selectedTeam={team} onSettled={onSettled} />
  );
  const { rerender } = render(view('Boston Celtics'));
  await act(async () => {});
  fireEvent.click(screen.getByLabelText('Zone Shooting'));
  await act(async () => pending.BOS.resolve({ data: zoneMatchup('BOS') }));
  expect(screen.getByText('Shot zones · vs BOS')).toBeVisible();

  // A new opponent: the Boston court is not shown for it and it is not ready.
  rerender(view('New York Knicks'));
  await act(async () => {});
  expect(screen.queryByText('Shot zones · vs BOS')).not.toBeInTheDocument();
  expect(screen.getByText('Loading data...')).toBeVisible();
  expect(onSettled).not.toHaveBeenCalledWith('LeBron James', 'New York Knicks');
  await act(async () => pending.NYK.resolve({ data: zoneMatchup('NYK') }));
  expect(screen.getByText('Shot zones · vs NYK')).toBeVisible();
  expect(onSettled).toHaveBeenLastCalledWith('LeBron James', 'New York Knicks');

  // An answer for an abandoned opponent landing after the current one changes nothing.
  rerender(view('Los Angeles Lakers'));
  await act(async () => {});
  rerender(view('Miami Heat'));
  await act(async () => pending.MIA.resolve({ data: zoneMatchup('MIA') }));
  await act(async () => pending.LAL.resolve({ data: zoneMatchup('LAL') }));
  expect(screen.getByText('Shot zones · vs MIA')).toBeVisible();
  expect(screen.queryByText('Loading data...')).not.toBeInTheDocument();

  rerender(view('Dallas Mavericks'));
  await act(async () => {});
  rerender(view('Denver Nuggets'));
  await act(async () => pending.DEN.resolve({ data: zoneMatchup('DEN') }));
  await act(async () => pending.DAL.reject(failedRequest(500)));
  expect(screen.getByText('Shot zones · vs DEN')).toBeVisible();
  expect(screen.queryByText(/Failed to fetch/)).not.toBeInTheDocument();
  expect(onSettled).toHaveBeenLastCalledWith('LeBron James', 'Denver Nuggets');
});

test('a player the backend cannot score reads as missing data, not a failure', async () => {
  apiClient.get.mockImplementation((url) =>
    url === 'MATCHUP_UNSCHEDULED'
      ? Promise.reject(
          Object.assign(new Error('Request failed with status code 404'), {
            response: {
              status: 404,
              data: {
                error: { code: 'resource_not_found', details: { reason: 'no_player_diet' } },
              },
            },
          }),
        )
      : Promise.resolve({ data: [{ value: 1 }] }),
  );
  render(<PlayerProfile selectedPlayer="Cooper Flagg" selectedTeam="Boston Celtics" />);
  await act(async () => {});
  fireEvent.click(screen.getByLabelText('Zone Shooting'));
  await act(async () => {});
  expect(screen.getByText('No shot zone matchup for Cooper Flagg this season.')).toBeVisible();
});

// An explicit Evidence season (crf04/statsplus#330) is named on the profile
// and its league baselines; the default never is.
test('an Evidence season is named on the profile and baselines reads, the default never', async () => {
  apiClient.get.mockImplementation((url) =>
    url === 'DIET_BASELINES'
      ? Promise.resolve({ data: { shares: { shot_types: {} } } })
      : Promise.resolve({ data: [{ SHOT_TYPE: 'C&S', FGA_FREQUENCY: 0.2 }] }),
  );
  const { rerender } = render(<PlayerProfile selectedPlayer="LeBron James" selectedTeam="BOS" />);
  await act(async () => {});
  fireEvent.click(screen.getByLabelText('Shooting Type'));
  await act(async () => {});
  const reads = () =>
    apiClient.get.mock.calls
      .filter(([url]) => url !== 'TEAM_STATS')
      .map(([url, { params }]) => [url, params]);
  expect(reads()).toEqual([
    ['PLAYER_PROFILE', { player_name: 'LeBron James', category: 'Playtypes' }],
    ['PLAYER_PROFILE', { player_name: 'LeBron James', category: 'Shooting Type' }],
    ['DIET_BASELINES', undefined],
  ]);

  apiClient.get.mockClear();
  rerender(
    <PlayerProfile
      selectedPlayer="LeBron James"
      selectedTeam="BOS"
      seasonChoice={unpublishedSeasons.choices[0]}
    />,
  );
  await act(async () => {});
  expect(reads()).toEqual([
    [
      'PLAYER_PROFILE',
      { player_name: 'LeBron James', category: 'Shooting Type', season: '2026-27' },
    ],
    ['DIET_BASELINES', { season: '2026-27' }],
  ]);
});

test('a refused Evidence season says it is not available yet', async () => {
  const refusal = Object.assign(new Error('Request failed with status code 503'), {
    response: {
      status: 503,
      headers: {},
      data: {
        error: {
          code: 'season_unavailable',
          message: 'Refused.',
          details: { selected_season: '2026-27', published_season: '2025-26' },
        },
      },
    },
  });
  apiClient.get.mockImplementation((url) =>
    url === 'PLAYER_PROFILE' ? Promise.reject(refusal) : Promise.resolve({ data: [{}] }),
  );
  render(
    <PlayerProfile
      selectedPlayer="LeBron James"
      selectedTeam="BOS"
      seasonChoice={unpublishedSeasons.choices[0]}
    />,
  );
  await act(async () => {});
  expect(screen.getByText("2026-27 isn't available yet.")).toBeVisible();
});

// Zone Shooting reads the Unscheduled Matchup for the Evidence season and
// labels the court with that season and its sample.
const early = unpublishedSeasons.choices[0];
const selectedZones = (opponent) => {
  const body = zoneMatchup(opponent);
  body.players[0].diet_shares.shot_zones[0].season.share = 0.12;
  return {
    ...body,
    season_context: { selected_season: '2026-27', published_season: '2025-26' },
    trailing: [
      {
        family: 'team_defense',
        serving_season: '2025-26',
        rule: 'every team has played 10 games',
        team_games: { min: 82, max: 82 },
      },
    ],
  };
};

test('Zone Shooting reads the Evidence season and names its season and sample', async () => {
  apiClient.get.mockImplementation((url, { params }) =>
    url === 'MATCHUP_UNSCHEDULED'
      ? Promise.resolve({
          data: params.season ? selectedZones(params.opponent) : zoneMatchup(params.opponent),
        })
      : Promise.resolve({ data: [{ value: 1 }] }),
  );
  render(
    <PlayerProfile
      selectedPlayer="LeBron James"
      selectedTeam="Boston Celtics"
      seasonChoice={early}
    />,
  );
  await act(async () => {});
  apiClient.get.mockClear();
  fireEvent.click(screen.getByLabelText('Zone Shooting'));
  await act(async () => {});
  expect(apiClient.get.mock.calls.map(([url, { params }]) => [url, params])).toEqual([
    ['MATCHUP_UNSCHEDULED', { player_name: 'LeBron James', opponent: 'BOS', season: '2026-27' }],
  ]);
  expect(screen.getAllByText('12%')[0]).toBeVisible();
  expect(screen.queryByText('31%')).not.toBeInTheDocument();
  expect(screen.getByText('Evidence season 2026-27 · early, 2–4 games per team')).toBeVisible();
  expect(
    screen.getByText(
      'Zones use 2025-26 team defense (82 games per team) until every team has played 10 games.',
    ),
  ).toBeVisible();
});

test('Zone Shooting on the default season names no season and adds no label', async () => {
  apiClient.get.mockImplementation((url, { params }) =>
    url === 'MATCHUP_UNSCHEDULED'
      ? Promise.resolve({ data: zoneMatchup(params.opponent) })
      : Promise.resolve({ data: [{ value: 1 }] }),
  );
  render(
    <PlayerProfile
      selectedPlayer="LeBron James"
      selectedTeam="Boston Celtics"
      seasonChoice={null}
    />,
  );
  await act(async () => {});
  fireEvent.click(screen.getByLabelText('Zone Shooting'));
  await act(async () => {});
  expect(apiClient.get).toHaveBeenLastCalledWith('MATCHUP_UNSCHEDULED', {
    params: { player_name: 'LeBron James', opponent: 'BOS' },
    signal: expect.anything(),
  });
  expect(screen.getAllByText('31%')[0]).toBeVisible();
  expect(screen.queryByText(/Evidence season|Zones use/)).not.toBeInTheDocument();
});

const refused = (status, error) =>
  Object.assign(new Error(`Request failed with status code ${status}`), {
    response: { status, headers: {}, data: { error } },
  });

test.each([
  [
    'a backend that does not take season there',
    () =>
      Promise.reject(
        refused(400, {
          code: 'invalid_input',
          message: 'Unknown parameter: season.',
          details: { parameters: ['season'] },
        }),
      ),
    "Zone Shooting can't read 2026-27 evidence yet.",
  ],
  [
    'a backend that ignores it',
    () => Promise.resolve({ data: zoneMatchup('BOS') }),
    "Zone Shooting can't read 2026-27 evidence yet.",
  ],
  [
    'a season not offered',
    () =>
      Promise.reject(
        refused(503, {
          code: 'season_unavailable',
          message: 'Refused.',
          details: { selected_season: '2026-27', published_season: '2025-26' },
        }),
      ),
    "2026-27 isn't available yet.",
  ],
])(
  'Zone Shooting under 2026-27 from %s refuses, never the default numbers',
  async (_, answer, text) => {
    apiClient.get.mockImplementation((url) =>
      url === 'MATCHUP_UNSCHEDULED' ? answer() : Promise.resolve({ data: [{ value: 1 }] }),
    );
    render(
      <PlayerProfile
        selectedPlayer="LeBron James"
        selectedTeam="Boston Celtics"
        seasonChoice={early}
      />,
    );
    await act(async () => {});
    fireEvent.click(screen.getByLabelText('Zone Shooting'));
    await act(async () => {});
    expect(screen.getByText(text)).toBeVisible();
    expect(screen.queryByText('31%')).not.toBeInTheDocument();
  },
);

test('a retained Evidence season is named on the Zone Shooting read', async () => {
  apiClient.get.mockImplementation((url, { params }) =>
    url === 'MATCHUP_UNSCHEDULED'
      ? Promise.resolve({
          data: {
            ...zoneMatchup(params.opponent),
            season_context: { selected_season: '2024-25', published_season: '2025-26' },
            trailing: [],
          },
        })
      : Promise.resolve({ data: [{ value: 1 }] }),
  );
  render(
    <PlayerProfile
      selectedPlayer="LeBron James"
      selectedTeam="Boston Celtics"
      seasonChoice={publishedOnlySeasons.choices[1]}
    />,
  );
  await act(async () => {});
  fireEvent.click(screen.getByLabelText('Zone Shooting'));
  await act(async () => {});
  expect(apiClient.get).toHaveBeenLastCalledWith('MATCHUP_UNSCHEDULED', {
    params: { player_name: 'LeBron James', opponent: 'BOS', season: '2024-25' },
    signal: expect.anything(),
  });
  expect(screen.getByText('Evidence season 2024-25')).toBeVisible();
});

// Under a selection the league tick names the season its own base serves, and
// the profile names each family it trails on.
const synergyTrailing = {
  family: 'synergy',
  serving_season: '2025-26',
  rule: 'NBA has published the season and every team has played 10 games',
  team_games: { min: 82, max: 82 },
};
const dietsTrailing = {
  family: 'player_diets',
  serving_season: '2025-26',
  rule: 'every team has played 10 games',
  team_games: { min: 80, max: 82 },
};
const selectedBaselines = (shotTypesSeason, trailing) => ({
  season_context: { selected_season: '2026-27', published_season: '2025-26' },
  season: '2026-27',
  bases: {
    shot_types: { family: 'player_diets', season: shotTypesSeason },
    play_types: { family: 'synergy', season: '2026-27' },
  },
  trailing,
  shares: { shot_types: { 'Catch and Shoot': 0.32 } },
});

test.each([
  ['trails', '2025-26', [dietsTrailing], 'League averages from 2025-26 (80–82 games per team)'],
  ['serves the selection', '2026-27', [], 'League averages from 2026-27 (2–4 games per team)'],
])(
  'the Shooting Type league tick names the season its base %s',
  async (_, shotTypesSeason, trailing, label) => {
    apiClient.get.mockImplementation((url) =>
      url === 'DIET_BASELINES'
        ? Promise.resolve({ data: selectedBaselines(shotTypesSeason, trailing) })
        : Promise.resolve({
            data: {
              data: [{ SHOT_TYPE: 'C&S', FGA_FREQUENCY: 0.2 }],
              season_context: { selected_season: '2026-27', published_season: '2025-26' },
              trailing: [],
            },
          }),
    );
    render(<PlayerProfile selectedPlayer="LeBron James" selectedTeam="BOS" seasonChoice={early} />);
    await act(async () => {});
    fireEvent.click(screen.getByLabelText('Shooting Type'));
    await act(async () => {});
    expect(screen.getByText(label)).toBeVisible();
    expect(screen.queryAllByText(/League averages from/)).toHaveLength(1);
  },
);

test('the profile names each family it trails on with its season and sample', async () => {
  apiClient.get.mockImplementation((url) =>
    url === 'PLAYER_PROFILE'
      ? Promise.resolve({
          data: {
            data: [{ PLAY_TYPE: 'Isolation', FREQ: 0.2 }],
            season_context: { selected_season: '2026-27', published_season: '2025-26' },
            trailing: [synergyTrailing],
          },
        })
      : Promise.resolve({ data: [{ value: 1 }] }),
  );
  render(<PlayerProfile selectedPlayer="LeBron James" selectedTeam="BOS" seasonChoice={early} />);
  await act(async () => {});
  expect(
    screen.getByText(
      'Profile numbers use 2025-26 play types (82 games per team) until NBA has published the season and every team has played 10 games.',
    ),
  ).toBeVisible();
});

test('the default profile names no trailing family', async () => {
  render(<PlayerProfile selectedPlayer="LeBron James" selectedTeam="BOS" />);
  await act(async () => {});
  expect(screen.queryByText(/Profile numbers use|League averages from/)).not.toBeInTheDocument();
});
