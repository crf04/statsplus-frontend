import { render, screen } from '@testing-library/react';
import AppliedFilters from './AppliedFilters';

test('renders an explicit default-valued parameter as a badge', () => {
  render(<AppliedFilters filters={{ location_filter: 'Both', minutes_filter: '0,48' }} />);

  expect(screen.getByText('Location: Both')).toBeVisible();
  expect(screen.getByText('0 <= MIN <= 48')).toBeVisible();
});

test('names the one opponent a Filter Set is fixed to', () => {
  render(<AppliedFilters filters={{ opponent_tricode: 'OKC' }} />);

  expect(screen.getByText('vs OKC')).toBeVisible();
});

test('renders one badge per recognised parameter', () => {
  render(
    <AppliedFilters
      filters={{ player_name: 'LeBron James', playstyle_RTG_min: 75, playstyle_RTG_max: 125 }}
    />,
  );

  expect(screen.getByText('Player: LeBron James')).toBeVisible();
  expect(screen.getByText('75 <= PLAYTYPE_RTG <= 125')).toBeVisible();
  expect(screen.getAllByText(/PLAYTYPE_RTG/)).toHaveLength(1);
});
