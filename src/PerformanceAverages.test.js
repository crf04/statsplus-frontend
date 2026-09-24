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

  const averages = [
    { MIN: 20, PTS: 10 },
    { MIN: 40, PTS: 20 },
  ];

  test('states the filtered sample against the whole season', () => {
    render(
      <PerformanceAverages
        averages={averages}
        appliedFilters={{}}
        sampleSize={{ filtered: 12, season: 71 }}
      />,
    );
    expect(screen.getByText('12 of 71 games')).toBeVisible();
  });

  test('counts only the filtered games when the season size is unknown', () => {
    render(
      <PerformanceAverages
        averages={averages}
        appliedFilters={{}}
        sampleSize={{ filtered: 1, season: null }}
      />,
    );
    expect(screen.getByText('1 game')).toBeVisible();
  });

  test('states an emptied sample rather than hiding it', () => {
    render(
      <PerformanceAverages
        averages={[]}
        appliedFilters={{}}
        sampleSize={{ filtered: 0, season: 71 }}
      />,
    );
    expect(screen.getByText('0 of 71 games')).toBeVisible();
  });

  test('says nothing about the sample before a result arrives', () => {
    render(<PerformanceAverages averages={averages} appliedFilters={{}} sampleSize={null} />);
    expect(screen.queryByText(/\bgames?\b/)).not.toBeInTheDocument();
  });
});
