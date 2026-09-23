import { frequencyAxisStep } from './MatchupComboChart';

// The frequency axis keeps the five "nice" ticks the player profile charts
// have always shown, e.g. 0/8/16/24/32 for a 31.4% maximum.
test.each([
  [31.4, 8],
  [34.2, 9],
  [53.3, 15],
  [4, 1],
  [0.6, 0.15],
  [120, 30],
])('a %s%% maximum steps the frequency axis by %s', (max, step) => {
  expect(frequencyAxisStep(max)).toBe(step);
  expect(4 * frequencyAxisStep(max)).toBeGreaterThanOrEqual(max);
});

test('an empty maximum falls back to a unit step', () => {
  expect(frequencyAxisStep(0)).toBe(1);
});
