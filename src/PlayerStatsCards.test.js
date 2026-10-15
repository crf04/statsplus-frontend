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
