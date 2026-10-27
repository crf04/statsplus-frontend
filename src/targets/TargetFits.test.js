import { render, screen, within } from '@testing-library/react';
import { TargetFitTable, TargetTitle } from './TargetFits';

const entry = {
  target: {
    title: 'MEM vs Big, Corner 3 ≥ 40%, 3PA avg ≥ 0.3',
    qualifiers: [
      { base: 'position', groups: ['Big'] },
      { base: 'shot_zones', sliceKey: 'Corner 3', comparator: 'at_or_above', threshold: 0.4 },
      { base: 'season_average', stat: '3PA', comparator: 'at_or_above', threshold: 0.3 },
    ],
  },
  game: { opposingTeam: { tricode: 'MEM' } },
  availability: { status: 'available', source: 'player_pool', unavailableReason: null },
  players: [
    {
      canonicalId: 1,
      name: 'Big Fit',
      tricode: 'MEM',
      position: 'Big',
      seasonScoring: 12.5,
      thin: false,
      shares: [{ share: 0.44, leagueAverageShare: 0.2 }],
    },
    {
      canonicalId: 2,
      name: 'No Label',
      tricode: 'MEM',
      position: null,
      seasonScoring: 9,
      thin: false,
      shares: [{ share: 0.41, leagueAverageShare: 0.2 }],
    },
  ],
};

test('a fit shows his Position beside his name, with one column per diet Qualifier', () => {
  render(<TargetFitTable entry={entry} />);
  const table = screen.getByRole('table', { name: `Fits for ${entry.target.title}` });
  expect(
    within(table)
      .getAllByRole('columnheader')
      .map((cell) => cell.textContent),
  ).toEqual(['Player', 'Corner 3', 'PPG']);
  const rows = within(table).getAllByRole('row').slice(1);
  expect(rows.map((row) => row.textContent)).toEqual([
    'Big FitMEMBig44%lg 20%12.5',
    'No LabelMEM41%lg 20%9.0',
  ]);
});

test('a Target stored as [Diet, Position] reads with the Position first', () => {
  const { container } = render(
    <TargetTitle
      target={{
        opponent: 'MEM',
        qualifiers: [
          { base: 'shot_zones', sliceKey: 'Corner 3', comparator: 'at_or_above', threshold: 0.4 },
          { base: 'position', groups: ['Big'] },
          { base: 'season_average', stat: '3PA', comparator: 'at_or_above', threshold: 0.3 },
        ],
      }}
    />,
  );
  expect(container.textContent).toBe('MEMvsBig & Corner 3 ≥ 40% & 3PA avg ≥ 0.3');
});
