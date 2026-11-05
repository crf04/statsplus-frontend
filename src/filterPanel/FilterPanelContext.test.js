import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import FilterPanelContext from './FilterPanelContext';

let mockAuthenticated = false;
jest.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    isAuthenticated: mockAuthenticated,
    currentUser: mockAuthenticated ? { uid: 'u1' } : null,
  }),
}));

beforeEach(() => {
  mockAuthenticated = false;
  global.ResizeObserver = class {
    observe() {}
    disconnect() {}
  };
  window.matchMedia = () => ({ matches: false });
});

describe('the next-opponent read passed down by the Workspace', () => {
  const panel = { selectedPlayer: 'Jalen Johnson', ensureSeason: jest.fn() };
  const nextOpponent = {
    next_game: {
      game_id: '1',
      date: '2026-01-05',
      opponent: 'CHA',
      opponent_name: 'Charlotte Hornets',
      home: false,
    },
    opponent_ranks: [
      {
        group: 'Traditional',
        label: 'Points allowed',
        unit: 'count',
        value: 120.5,
        most_rank: 2,
        ranked_teams: 30,
        team_filter: null,
        vs_league_pct: 5,
      },
    ],
  };
  const renderContext = (extra) =>
    render(
      <MemoryRouter>
        <FilterPanelContext panel={panel} extra={extra} />
      </MemoryRouter>,
    );

  test('shows the opponent extremes it was given and reports settled once the read is for this player', () => {
    mockAuthenticated = true;
    const onContextSettled = jest.fn();
    renderContext({ onContextSettled, nextOpponent, nextOpponentFor: 'Jalen Johnson' });

    expect(screen.getByText('Next: @ CHA · Jan 5')).toBeVisible();
    expect(screen.getByText('1 most · 0 fewest')).toBeVisible();
    expect(onContextSettled).toHaveBeenLastCalledWith('Jalen Johnson');
  });

  test('the header and more counts follow the rows that bear on the selected stat', () => {
    window.matchMedia = () => ({ matches: true });
    const rank = (label, family, markets, mostRank) => ({
      ...nextOpponent.opponent_ranks[0],
      label,
      family,
      markets,
      most_rank: mostRank,
    });
    const opponent = {
      ...nextOpponent,
      opponent_ranks: [
        rank('Points allowed', 'points', ['PTS'], 6),
        rank('Inside 10 ft 2PA', 'inside', ['PTS'], 1),
        rank('Inside 10 ft attempts', 'inside', ['PTS'], 1),
        rank('Rebounds', 'rebounds', ['REB'], 2),
        rank('Off. rebounds', 'rebounds', ['REB'], 4),
        rank('Assists', 'assists', ['AST'], 28),
        rank('Blocks', 'steals-blocks', ['BLK'], 30),
        rank('Transition', 'play-type:transition', ['PTS'], 4),
      ],
    };
    const { rerender } = renderContext({ lineType: 'None', nextOpponent: opponent });

    expect(screen.getByText('4 most · 2 fewest')).toBeVisible();
    expect(screen.getByRole('button', { name: '+ 1 more' })).toBeVisible();

    rerender(
      <MemoryRouter>
        <FilterPanelContext panel={panel} extra={{ lineType: 'REB', nextOpponent: opponent }} />
      </MemoryRouter>,
    );

    expect(screen.getByText('1 most · 0 fewest')).toBeVisible();
    expect(screen.getByText('Rebounds')).toBeVisible();
    expect(screen.queryByText('Off. rebounds')).toBeNull();
    expect(screen.queryByRole('button', { name: /more$/ })).toBeNull();
  });

  test.each([
    ['has not finished', null],
    ['finished for the previous player', 'Trae Young'],
  ])('is not settled while the read %s', (_label, nextOpponentFor) => {
    mockAuthenticated = true;
    const onContextSettled = jest.fn();
    renderContext({ onContextSettled, nextOpponent: null, nextOpponentFor });

    expect(onContextSettled).toHaveBeenLastCalledWith(null);
  });
});
