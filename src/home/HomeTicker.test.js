import { render, screen } from '@testing-library/react';
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
