import { fireEvent, render, screen } from '@testing-library/react';
import PlayerStatsCards from './PlayerStatsCards';

const averages = [
  { PTS: 25, REB: 7, AST: 8 },
  { PTS: 24, REB: 7, AST: 7 },
];

describe('PlayerStatsCards headshot', () => {
  test("shows the player's NBA headshot for their person id", () => {
    render(<PlayerStatsCards averages={averages} selectedPlayer="LeBron James" playerId={2544} />);

    expect(screen.getByRole('img', { name: 'LeBron James' })).toHaveAttribute(
      'src',
      'https://cdn.nba.com/headshots/nba/latest/260x190/2544.png',
    );
    expect(screen.queryByText('LJ')).not.toBeInTheDocument();
  });

  test('shows initials without a person id', () => {
    render(<PlayerStatsCards averages={averages} selectedPlayer="LeBron James" playerId={null} />);

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText('LJ')).toBeVisible();
  });

  test('falls back to initials when the headshot fails to load', () => {
    render(
      <PlayerStatsCards averages={averages} selectedPlayer="Cooper Flagg" playerId={1642843} />,
    );

    fireEvent.error(screen.getByRole('img', { name: 'Cooper Flagg' }));

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText('CF')).toBeVisible();
  });

  test('retries the headshot for the next player after one fails', () => {
    const { rerender } = render(
      <PlayerStatsCards averages={averages} selectedPlayer="Cooper Flagg" playerId={1642843} />,
    );
    fireEvent.error(screen.getByRole('img', { name: 'Cooper Flagg' }));

    rerender(
      <PlayerStatsCards averages={averages} selectedPlayer="LeBron James" playerId={2544} />,
    );

    expect(screen.getByRole('img', { name: 'LeBron James' })).toBeVisible();
  });
});

// The comparison reads "+2.0 vs Season" to a screen reader; " vs Season" is
// visually hidden, so match the whole text across both nodes.
const comparison = (text) =>
  screen.getByText(
    (_, element) => element.matches('.stat-comparison') && element.textContent === text,
  );

describe('PlayerStatsCards season comparison', () => {
  test('shows each filtered average with its difference from the season', () => {
    render(
      <PlayerStatsCards
        averages={[
          { PTS: 29, FG_PCT: 0.52, TOV: 3.1 },
          { PTS: 27, FG_PCT: 0.5, TOV: 3.1 },
        ]}
        selectedPlayer="LeBron James"
      />,
    );

    expect(screen.getByText('29.0')).toBeVisible();
    expect(comparison('+2.0 vs Season')).toBeVisible();
    expect(screen.getByText('52.0%')).toBeVisible();
    expect(comparison('+2.0% vs Season')).toBeVisible();
    expect(comparison('0.0 vs Season')).toBeVisible();
  });

  test('marks fewer turnovers as better and fewer points as worse', () => {
    render(
      <PlayerStatsCards
        averages={[
          { PTS: 20, TOV: 2 },
          { PTS: 25, TOV: 3 },
        ]}
        selectedPlayer="LeBron James"
      />,
    );

    expect(comparison('-1.0 vs Season')).toHaveClass('is-better');
    expect(comparison('-5.0 vs Season')).toHaveClass('is-worse');
  });
});
