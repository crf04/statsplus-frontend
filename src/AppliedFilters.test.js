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

test('an opponent rank reads as league ranks, never a bare sign', () => {
  render(
    <AppliedFilters
      filters={{
        'teams_against[]': ['OPP_PTS', 'Transition', 'Isolation', 'OPP_REB'],
        'rank_filter[]': ['5', '-10', '12,20', '10'],
      }}
    />,
  );

  expect(screen.getByText('Points Allowed (ranks 26–30)')).toBeVisible();
  expect(screen.getByText('Transition (ranks 1–10)')).toBeVisible();
  expect(screen.getByText('Isolation (ranks 11–19)')).toBeVisible();
  expect(screen.getByText('Rebounds Allowed (ranks 21–30)')).toBeVisible();
});

test('a Defense Sheet row filter reads as its label, never its token', () => {
  render(
    <AppliedFilters
      filters={{
        'teams_against[]': [
          'sheet:shot_zones:Restricted Area:FGM',
          'sheet:shot_types:Pullups:FG3A',
        ],
        'rank_filter[]': ['10', '-5'],
      }}
    />,
  );

  expect(screen.getByText('Restricted Area Makes (ranks 21–30)')).toBeVisible();
  expect(screen.getByText('Pull-Up 3PA (ranks 1–5)')).toBeVisible();
  expect(screen.queryByText(/sheet:/)).not.toBeInTheDocument();
});

test('a retired Play type volume filter still reads as its label', () => {
  render(
    <AppliedFilters
      filters={{
        'teams_against[]': ['sheet:play_types:PRRollMan:POSS'],
        'rank_filter[]': ['11,20'],
      }}
    />,
  );

  expect(screen.getByText('P&R Roll-Man Possessions (ranks 11–20)')).toBeVisible();
  expect(screen.queryByText(/sheet:/)).not.toBeInTheDocument();
});

test('shows the start and end of a date range as separate badges', () => {
  render(<AppliedFilters filters={{ date_filter: '2026-01-01', date_to: '2026-01-31' }} />);

  expect(screen.getByText('Date >= 2026-01-01')).toBeVisible();
  expect(screen.getByText('Date <= 2026-01-31')).toBeVisible();
});
