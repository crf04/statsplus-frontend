import { formatNumber, numericOrZero, toFiniteNumber } from './numberUtils';

describe('numberUtils', () => {
  test('accepts finite numbers and numeric strings', () => {
    expect(toFiniteNumber(12.5)).toBe(12.5);
    expect(toFiniteNumber('12.5')).toBe(12.5);
    expect(formatNumber('12.5', 1)).toBe('12.5');
  });

  test('does not turn missing or non-scalar values into zero', () => {
    [null, undefined, true, false, [], [12]].forEach((value) => {
      expect(toFiniteNumber(value)).toBeNull();
      expect(numericOrZero(value)).toBe(0);
      expect(formatNumber(value)).toBe('N/A');
    });
  });

  test('rejects blank and non-finite values', () => {
    expect(toFiniteNumber('')).toBeNull();
    expect(toFiniteNumber('   ')).toBeNull();
    expect(toFiniteNumber('not a number')).toBeNull();
    expect(toFiniteNumber(Infinity)).toBeNull();
  });
});
