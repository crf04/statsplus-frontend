import { render, screen } from '@testing-library/react';
import ShotZoneCourt, { ordinal, zoneFill } from './ShotZoneCourt';

const zone = (share, rank, percentVsLeague, leagueShare = 0.2) => ({
  share,
  leagueShare,
  rank,
  percentVsLeague,
});
const matchup = {
  opponent: 'CHA',
  zones: {
    'Restricted Area': zone(0.313, 18, -0.3),
    'In The Paint (Non-RA)': zone(0.294, 14, -1.4),
    'Mid-Range': zone(0.116, 9, -6.7),
    'Corner 3': zone(0.02, 2, -18.6),
    'Above the Break 3': zone(0.257, 19, 2.3),
  },
};

const labels = (container) =>
  [...container.querySelectorAll('.ps-court .ps-region')].map((label) => label.textContent);

test('every region reads his share, then the opponent rank and percent vs league', () => {
  const { container } = render(<ShotZoneCourt matchup={matchup} />);
  expect(screen.getByText('Shot zones · vs CHA')).toBeVisible();
  expect(labels(container)).toEqual([
    '31%18th · −0.3%',
    '29%14th · −1.4%',
    '12%9th · −6.7%',
    '26%19th · +2.3%',
    // Both corner strips carry the merged Corner 3 slice on one line.
    '2%· 2nd · −18.6%',
    '2%· 2nd · −18.6%',
  ]);
  // Fill: what the opponent allows in made shots, green for more, red for less.
  const fills = [...container.querySelectorAll('svg [fill]')].map((shape) =>
    shape.getAttribute('fill'),
  );
  expect(fills.slice(0, 10)).toEqual([
    'var(--ct-surface)',
    'rgba(76, 175, 125, 0.20)', // above the break, +2.3%
    'rgba(194, 78, 78, 0.78)', // left corner, -18.6%
    'rgba(194, 78, 78, 0.78)', // right corner
    'var(--ct-surface)',
    'rgba(194, 78, 78, 0.36)', // mid-range, -6.7%
    'var(--ct-surface)',
    'rgba(194, 78, 78, 0.17)', // paint, -1.4%
    'var(--ct-surface)',
    'rgba(194, 78, 78, 0.13)', // restricted area, -0.3%
  ]);
  // The key reads his largest zone.
  expect(container.querySelector('.ps-key-cell').textContent).toBe('31%18th · −0.3%');
  expect(screen.queryByText('No data for this zone')).not.toBeInTheDocument();
});

test('a zone with no opponent row is untinted and the key says so', () => {
  const { container } = render(
    <ShotZoneCourt
      matchup={{ ...matchup, zones: { ...matchup.zones, 'Mid-Range': zone(0.116, null, null) } }}
    />,
  );
  expect(labels(container)[2]).toBe('12%– · –');
  const midRange = container.querySelectorAll('svg [fill]')[5];
  expect(midRange.getAttribute('fill')).toBe('var(--ps-untinted)');
  expect(screen.getByText('No data for this zone')).toBeVisible();
});

test('fill is green when the opponent allows more, red when less, deeper further from league', () => {
  expect(zoneFill(2.3)).toBe('rgba(76, 175, 125, 0.20)');
  expect(zoneFill(-18.6)).toBe('rgba(194, 78, 78, 0.78)');
  expect(zoneFill(-40)).toBe('rgba(194, 78, 78, 0.80)');
  expect(zoneFill(null)).toBe('var(--ps-untinted)');
});

test.each([
  [1, '1st'],
  [2, '2nd'],
  [3, '3rd'],
  [11, '11th'],
  [12, '12th'],
  [13, '13th'],
  [21, '21st'],
  [22, '22nd'],
  [30, '30th'],
])('rank %i reads %s', (rank, text) => {
  expect(ordinal(rank)).toBe(text);
});
