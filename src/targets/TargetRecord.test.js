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
  // The prototype colors by mean margin, even when fewer than half the games hit.
  expect(within(summary).getByText('33%')).toHaveClass('is-hit');
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

test('grades intermediate margins against the record’s p90, without letting an outlier flatten them', () => {
  // Eleven absolute margins: 0,1,2,3,3,4,5,6,7,8,40. P90 is 8,
  // so +3 and -3 occupy step 2 (not floor's step 1); max scaling
  // would also incorrectly flatten both to step 1.
  const points = [20, 21, 22, 23, 17, 24, 25, 26, 27, 28, 60];
  render(
    <TargetRecord
      backtest={{
        ...backtest,
        players: [
          {
            ...backtest.players[0],
            games: points.map((PTS, index) => ({
              gameDate: `2026-01-${String(index + 1).padStart(2, '0')}`,
              stats: { PTS },
            })),
          },
        ],
      }}
    />,
  );
  expect(screen.getByRole('listitem', { name: /2026-01-04/ })).toHaveClass('grade-hit-2');
  expect(screen.getByRole('listitem', { name: /2026-01-05/ })).toHaveClass('grade-miss-2');
  expect(screen.getByRole('listitem', { name: /2026-01-07/ })).toHaveClass('grade-hit-3');
  expect(screen.getByRole('listitem', { name: /2026-01-11/ })).toHaveClass('grade-hit-4');
});

test('a zero-minute game is absent from per36 arithmetic and never graded as zero production', () => {
  render(
    <TargetRecord
      columns={['PTS/36']}
      gradedBy="PTS/36"
      backtest={{
        ...backtest,
        players: [
          {
            ...backtest.players[0],
            seasonTotals: { points: 30, minutes: 60 },
            seasonGames: 2,
            games: [
              { gameDate: '2026-01-01', line: { points: 12, minutes: 24 } },
              { gameDate: '2026-01-02', line: { points: 0, minutes: 0 } },
            ],
          },
        ],
      }}
    />,
  );
  const summary = screen.getByRole('listitem', { name: 'PTS/36' });
  expect(summary).toHaveTextContent('0% hit');
  expect(summary).toHaveTextContent('0.0 avg');
  const absent = screen.getByRole('listitem', { name: /2026-01-02/ });
  expect(absent).toHaveClass('grade-unavailable');
  expect(absent).toHaveAttribute('title', expect.stringContaining('— PTS/36'));
});
