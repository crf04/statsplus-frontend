/**
 * Small, shared guards for values that come from the API.
 *
 * API responses are not always consistent about whether a statistic is a
 * number or a numeric string. Keeping the coercion here prevents a malformed
 * value from turning a render into a `toFixed is not a function` exception.
 */
export const toFiniteNumber = (value, fallback = null) => {
  if (
    value === null ||
    value === undefined ||
    typeof value === 'boolean' ||
    Array.isArray(value) ||
    (typeof value === 'string' && value.trim() === '')
  ) {
    return fallback;
  }

  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) ? number : fallback;
};

export const numericOrZero = (value) => toFiniteNumber(value, 0);

export const formatNumber = (value, digits = 2, fallback = 'N/A') => {
  const number = toFiniteNumber(value);
  return number === null ? fallback : number.toFixed(digits);
};

export const formatPercent = (value, digits = 1, fallback = 'N/A') => {
  const number = toFiniteNumber(value);
  return number === null ? fallback : `${(number * 100).toFixed(digits)}%`;
};
