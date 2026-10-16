import { signedPercent } from './homeFormat';

test('signs a percent and never shows −0%', () => {
  expect(signedPercent(0.0823)).toBe('+8%');
  expect(signedPercent(-0.0823)).toBe('−8%');
  expect(signedPercent(-0.004)).toBe('0%');
  expect(signedPercent(0.0674, 1)).toBe('+6.7%');
});
