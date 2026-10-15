import { act, fireEvent, render, screen } from '@testing-library/react';
import PlayerProfile from './PlayerProfile';
import { apiClient } from './config';

jest.mock('./config', () => ({ apiClient: { get: jest.fn() }, getApiUrl: (key) => key }));
jest.mock('./PlaystyleComparisonChart', () => () => <p>Playtype chart</p>);
jest.mock('./AssistProfileChart', () => () => <p>Assist chart</p>);
jest.mock('./TwoThreeAssistChart', () => () => null);
jest.mock('./ArchetypeGameLogs', () => () => <p>Archetype logs</p>);

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

test('Archetype reads the new opponent and player changes still reload the profile', async () => {
  const { rerender } = render(<PlayerProfile selectedPlayer="LeBron James" selectedTeam="BOS" />);
  await act(async () => {});
  fireEvent.click(screen.getByLabelText('Archetype'));
  await act(async () => {});
  apiClient.get.mockClear();
  rerender(<PlayerProfile selectedPlayer="LeBron James" selectedTeam="NYK" />);
  await act(async () => {});
  expect(apiClient.get).toHaveBeenCalledWith(
    'PLAYER_PROFILE',
    expect.objectContaining({
      params: { player_name: 'LeBron James', category: 'Archetype', opp_team: 'NYK' },
    }),
  );
  rerender(<PlayerProfile selectedPlayer="Stephen Curry" selectedTeam="NYK" />);
  await act(async () => {});
  expect(apiClient.get).toHaveBeenCalledWith(
    'PLAYER_PROFILE',
    expect.objectContaining({ params: expect.objectContaining({ player_name: 'Stephen Curry' }) }),
  );
});

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

test.each([
  ['Archetype', 'Archetype logs'],
  ['Shooting Type', 'Jump Shot'],
])('%s renders without unused comparison requests or failures', async (category, content) => {
  apiClient.get.mockImplementation((url) =>
    url === 'TEAM_STATS'
      ? Promise.reject(new Error('Comparison unavailable'))
      : Promise.resolve({ data: [{ SHOT_TYPE: 'Jump Shot' }] }),
  );
  render(<PlayerProfile selectedPlayer="LeBron James" selectedTeam="BOS" />);
  await act(async () => {});
  apiClient.get.mockClear();
  fireEvent.click(screen.getByLabelText(category));
  await act(async () => {});
  expect(apiClient.get.mock.calls.filter(([url]) => url === 'TEAM_STATS')).toHaveLength(0);
  expect(screen.getByText(content)).toBeVisible();
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
