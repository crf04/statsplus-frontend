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

test.each(['Playtypes', 'Assists', 'Shooting Type', 'Zone Shooting'])(
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
    expect(apiClient.get).toHaveBeenCalledWith(
      'TEAM_STATS',
      expect.objectContaining({ params: expect.objectContaining({ team: 'NYK' }) }),
    );
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
