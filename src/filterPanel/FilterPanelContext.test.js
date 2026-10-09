import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import FilterPanelContext from './FilterPanelContext';
import { fetchSavedFilterSets } from '../savedFilterSetsApi';

let mockAuthenticated = false;
jest.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    isAuthenticated: mockAuthenticated,
    currentUser: mockAuthenticated ? { uid: 'u1' } : null,
  }),
}));
jest.mock('../savedFilterSetsApi', () => ({
  fetchSavedFilterSets: jest.fn(),
  subscribeSavedFilterSets: () => () => {},
}));
jest.mock('../nextOpponentApi', () => ({
  fetchNextOpponent: jest.fn(() => new Promise(() => {})),
}));

beforeEach(() => {
  mockAuthenticated = false;
  global.ResizeObserver = class {
    observe() {}
    disconnect() {}
  };
  window.matchMedia = () => ({ matches: false });
});

test('the season strip with no typed line classifies games against the season average', () => {
  const panel = { selectedPlayer: 'Jalen Johnson', ensureSeason: jest.fn() };
  const logs = [
    { GAME_DATE: '2026-01-01', MATCHUP: 'ATL vs. BOS', PTS: 21 },
    { GAME_DATE: '2026-01-03', MATCHUP: 'ATL @ NYK', PTS: 19 },
  ];
  // A filtered average of 18 and a season average of 22: the 21 and 19 sit between them.
  const extra = {
    lineType: 'PTS',
    lineValue: '',
    averages: [{ PTS: 18 }, { PTS: 22 }],
    gameLogs: logs,
    seasonGameLogs: logs,
  };

  render(
    <MemoryRouter>
      <FilterPanelContext panel={panel} extra={extra} />
    </MemoryRouter>,
  );

  expect(screen.getByLabelText('2026-01-01 ATL vs. BOS · PTS 21 (under)')).toHaveClass('is-under');
  expect(screen.getByLabelText('2026-01-03 ATL @ NYK · PTS 19 (under)')).toHaveClass('is-under');
});

const failedRequest = (status, headers) =>
  Object.assign(new Error(`Request failed with status code ${status}`), {
    response: { status, headers, data: {} },
  });

test.each([
  [
    500,
    { 'x-request-id': '77070cec-3f5e-4b7a-9d0e-5a1c2b3d4e5f' },
    'Could not load Saved Filter Sets. (ref 77070cec)',
  ],
  [
    400,
    { 'x-request-id': '77070cec-3f5e-4b7a-9d0e-5a1c2b3d4e5f' },
    'Could not load Saved Filter Sets.',
  ],
])('a %i Saved Filter Sets failure with headers %j reads %j', async (status, headers, text) => {
  mockAuthenticated = true;
  fetchSavedFilterSets.mockRejectedValue(failedRequest(status, headers));
  render(
    <MemoryRouter>
      <FilterPanelContext
        panel={{ selectedPlayer: 'Jalen Johnson', ensureSeason: jest.fn() }}
        extra={{ lineType: 'PTS', lineValue: '', averages: [], gameLogs: [], seasonGameLogs: [] }}
      />
    </MemoryRouter>,
  );
  expect((await screen.findByRole('status')).textContent).toBe(text);
});
