import { OPPONENT_FILTERS, describeRank } from './opponentFilters';
import opponentFilterLabels from './opponentFilterLabels.json';

describe('describeRank', () => {
  test('a position range wider than the league reads as the ranks that exist', () => {
    // Positions 1-40 clip to 1-30, every team, which is ranks 1-30 on the product scale.
    expect(describeRank('1,40')).toBe('ranks 1–30');
    expect(describeRank('25,40')).toBe('ranks 1–6');
  });

  test('a position range past the league names no ranked team', () => {
    expect(describeRank('35,40')).toBe('no ranked team');
  });
});

// The backend draws these labels on link preview cards from its mirror of
// crf04/statsplus docs/contracts/opponent-filter-labels.json.
test('the opponent filter labels contract matches the vocabulary', () => {
  const labels = Object.fromEntries(
    OPPONENT_FILTERS.flatMap(({ items }) => items.map(({ token, label }) => [token, label])),
  );
  expect(opponentFilterLabels).toEqual(labels);
});
