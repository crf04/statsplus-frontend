import { render, screen } from '@testing-library/react';
import PlaystyleComparisonChart from './PlaystyleComparisonChart';

jest.mock('./MatchupComboChart', () => ({ rows, renderTooltip }) => (
  <>
    {rows.map((row) => (
      <div key={row.label}>{renderTooltip(row)}</div>
    ))}
  </>
));

// Derrick White's 2026-27 shares against Charlotte's 2026-27 points allowed per
// 48 by play type, the Matchup's Defense Sheet metric. Ranks and % vs league
// are production's (2026-11-06); the per-48 values are illustrative.
const white = { 'Spotup%': 31.3, 'PRBallHandler%': 20, 'Handoff%': 13 };
const charlotte = {
  Handoff: 6.71,
  Handoff_RANK: 27,
  Handoff_vs_avg_pct: 41.91,
  Spotup: 20.42,
  Spotup_RANK: 3,
  Spotup_vs_avg_pct: -16.87,
  PRBallHandler: 14.23,
  PRBallHandler_RANK: 15,
  PRBallHandler_vs_avg_pct: -2.01,
};

test('each play type shows the opponent rank and % vs league in points allowed per 48', () => {
  render(<PlaystyleComparisonChart playerData={white} teamData={charlotte} />);
  expect(screen.getByText('Team Defense: 41.91% (Rank: 27)')).toBeInTheDocument();
  expect(screen.getByText('Team Defense: -16.87% (Rank: 3)')).toBeInTheDocument();
  expect(screen.getByText('Team Defense: -2.01% (Rank: 15)')).toBeInTheDocument();
});

test('the Total Matchup Rating weighs points allowed per 48 by the player mix', () => {
  render(<PlaystyleComparisonChart playerData={white} teamData={charlotte} />);
  // (31.3 × 0.8313 + 20 × 0.9799 + 13 × 1.4191) / 64.3 = 0.9964 of league.
  expect(screen.getByText('−0.4%')).toBeInTheDocument();
});
