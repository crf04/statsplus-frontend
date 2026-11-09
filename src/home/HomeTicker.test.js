import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import HomeTicker from './HomeTicker';

const game = {
  gameId: '0022600144',
  scheduledAt: '2026-10-29T23:00:00Z',
  away: { tricode: 'CLE' },
  home: { tricode: 'ATL' },
  effects: [
    { canonicalId: 1630700, name: 'Dyson Daniels', value: -0.06, thin: true },
    { canonicalId: 1628386, name: 'Jarrett Allen', value: 0.04, thin: false },
  ],
};

test('a thin Matchup effect is marked as a thin sample, as on the Matchup rail', () => {
  render(
    <MemoryRouter>
      <HomeTicker slateDate="2026-10-29" games={[game]} />
    </MemoryRouter>,
  );

  const cell = screen.getByRole('link', { name: /CLE at ATL Matchup/ });
  expect(cell.getAttribute('aria-label')).toMatch(/, Daniels −6% thin sample, Allen \+4%$/);
  expect(screen.getByTitle('Thin sample')).toHaveTextContent('−6%');
  expect(screen.getByText('+4%')).not.toHaveAttribute('title');
});

const renderTicker = (games) =>
  render(
    <MemoryRouter>
      <HomeTicker slateDate="2026-11-09" games={games} />
    </MemoryRouter>,
  );

const lalAtAtl = {
  gameId: '0022600201',
  scheduledAt: '2026-11-10T00:00:00Z',
  away: { tricode: 'LAL' },
  home: { tricode: 'ATL' },
  effects: [{ canonicalId: 1630559, name: 'Austin Reaves', value: 0.09, thin: false }],
};

test('a game with leaders lists each row with its stat tag and names the stat aloud', () => {
  renderTicker([
    {
      ...lalAtAtl,
      leaders: [
        { canonicalId: 1629029, name: 'Luka Dončić', market: '3PM', value: -0.18, thin: false },
        { canonicalId: 1630559, name: 'Austin Reaves', market: 'REB', value: 0.12, thin: true },
        { canonicalId: 1628983, name: 'Jalen Johnson', market: 'FG3A', value: 0.1, thin: false },
      ],
    },
  ]);

  const cell = screen.getByRole('link', { name: /LAL at ATL Matchup/ });
  expect(cell.getAttribute('aria-label')).toMatch(
    /, Dončić 3PM −18%, Reaves REB \+12% thin sample, Johnson FG3A \+10%$/,
  );
  const rows = within(cell).getAllByRole('listitem');
  expect(rows.map((row) => row.textContent)).toEqual([
    'Dončić3PM−18%',
    'ReavesREB+12%',
    'JohnsonFG3A+10%',
  ]);
  expect(within(rows[0]).getByText('3PM')).toHaveClass('home-tick-stat');
  expect(within(rows[0]).getByText('−18%')).toHaveClass('is-down');
  expect(within(rows[1]).getByText('+12%')).toHaveAttribute('title', 'Thin sample');
});

test('a game without leaders (null) shows its PTS effects untagged, as before', () => {
  renderTicker([{ ...lalAtAtl, leaders: null }]);

  const cell = screen.getByRole('link', { name: /LAL at ATL Matchup/ });
  expect(cell.getAttribute('aria-label')).toMatch(/, Reaves \+9%$/);
  expect(
    within(cell)
      .getAllByRole('listitem')
      .map((row) => row.textContent),
  ).toEqual(['Reaves+9%']);
});
