import { describeRank } from './opponentFilters';

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
