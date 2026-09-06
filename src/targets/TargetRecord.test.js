import { render, screen, within } from '@testing-library/react';
import TargetRecord from './TargetRecord';
const backtest = {
  target: { opponent: 'OKC' },
  statColumns: ['PTS'],
  proxy: 'Box-score proxies',
  players: [
    {
      canonicalId: 1,
      name: 'Player One',
      tricode: 'LAL',
      seasonAverages: { PTS: 20 },
      games: [
        { gameDate: '2026-03-01', stats: { PTS: 28 } },
        { gameDate: '2026-01-01', stats: { PTS: 18 } },
        { gameDate: '2026-02-01', stats: { PTS: 20 } },
      ],
    },
  ],
};
test('the record grades all games oldest first and states games, hit rate and mean margin', () => {
  render(<TargetRecord backtest={backtest} />);
  const summary = screen.getByRole('list', { name: 'Backtest summary' });
  expect(within(summary).getByRole('listitem', { name: 'Games' })).toHaveTextContent('3');
  expect(within(summary).getByRole('listitem', { name: 'PTS' })).toHaveTextContent('33%');
  expect(within(summary).getByRole('listitem', { name: 'PTS' })).toHaveTextContent('+2.0');
  expect(within(summary).queryByRole('listitem', { name: 'Players' })).not.toBeInTheDocument();
  const cells = within(screen.getByRole('list', { name: /oldest to newest/ })).getAllByRole(
    'listitem',
  );
  expect(cells[0]).toHaveAttribute('title', expect.stringContaining('2026-01-01'));
  expect(cells[0]).toHaveClass('grade-miss-1');
  expect(cells[1]).toHaveClass('grade-neutral');
  expect(cells[2]).toHaveClass('grade-hit-4');
  expect(cells[2]).toHaveAttribute('title', expect.stringContaining('Player One'));
  expect(screen.getByText(/PTS vs the player/)).toBeVisible();
  expect(screen.queryByRole('table')).not.toBeInTheDocument();
});
