import { formatMatchupRating, matchupRatingPercent } from './matchupRating';

test('the rating is the frequency-weighted gap from league, as a signed percent', () => {
  const rows = [
    { frequency: 60, teamDefense: 1.1 },
    { frequency: 40, teamDefense: 0.85 },
  ];
  expect(formatMatchupRating(matchupRatingPercent(rows))).toBe('+0.0%');
  expect(
    formatMatchupRating(
      matchupRatingPercent([
        { frequency: 25.8, teamDefense: 1.03 },
        { frequency: 16.7, teamDefense: 0.919 },
        { frequency: 6.1, teamDefense: 0.9 },
      ]),
    ),
  ).toBe('−2.4%');
});

test('frequencies that do not sum to 100 still weigh as shares', () => {
  expect(
    formatMatchupRating(
      matchupRatingPercent([
        { frequency: 30, teamDefense: 1.1 },
        { frequency: 10, teamDefense: 1.1 },
      ]),
    ),
  ).toBe('+10%');
});

test('no frequency, no rating', () => {
  expect(matchupRatingPercent([])).toBeNull();
});
