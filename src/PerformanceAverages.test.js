import { render, screen, within } from '@testing-library/react';
import PerformanceAverages from './PerformanceAverages';

describe('PerformanceAverages', () => {
  test('renders FG_PCT as an unscaled percentage while counts stay per 36', () => {
    render(
      <PerformanceAverages
        averages={[
          { MIN: 20, FG_PCT: 0.5, PTS: 10 },
          { MIN: 40, FG_PCT: 0.6, PTS: 20 },
        ]}
        appliedFilters={{}}
      />,
    );

    const fgPctCard = screen.getByText('FG_PCT').closest('.compact-stat-card');
    expect(within(fgPctCard).getByText('50.0%')).toBeVisible();
    expect(within(fgPctCard).getByText('60.0%')).toBeVisible();
    expect(within(fgPctCard).getByText('↘')).toBeVisible();
    expect(within(fgPctCard).getByText('50.0%')).toHaveStyle({ color: '#c24e4e' });

    const pointsCard = screen.getByText('PTS').closest('.compact-stat-card');
    expect(within(pointsCard).getAllByText('18.0')).toHaveLength(2);
  });
});
