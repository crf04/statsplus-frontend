import { render, screen } from '@testing-library/react';
import FilterPanelContext from './FilterPanelContext';

jest.mock('react-router-dom', () => ({ useNavigate: () => jest.fn() }), { virtual: true });
jest.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ isAuthenticated: false, currentUser: null }),
}));

beforeEach(() => {
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

  render(<FilterPanelContext panel={panel} extra={extra} />);

  expect(screen.getByLabelText('2026-01-01 ATL vs. BOS · PTS 21 (under)')).toHaveClass('is-under');
  expect(screen.getByLabelText('2026-01-03 ATL @ NYK · PTS 19 (under)')).toHaveClass('is-under');
});
