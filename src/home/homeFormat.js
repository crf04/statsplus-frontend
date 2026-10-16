/*
 * Small formatting shared by the home page's ticker and Tonight row.
 */
// A value that rounds to zero reads "0%", never "−0%".
export const signedPercent = (value, digits = 0) => {
  const shown = Math.abs(value * 100).toFixed(digits);
  const sign = Number(shown) === 0 ? '' : value > 0 ? '+' : '−';
  return `${sign}${shown}%`;
};

const SUFFIXES = new Set(['Jr.', 'Sr.', 'II', 'III', 'IV']);

/* "Wendell Carter Jr." reads "Carter" in a ticker cell. */
export const lastName = (name) => {
  const parts = name.split(' ');
  while (parts.length > 1 && SUFFIXES.has(parts.at(-1))) parts.pop();
  return parts.at(-1);
};

const ordinal = (n) => {
  const teen = n % 100 >= 11 && n % 100 <= 13;
  return `${n}${teen ? 'th' : { 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th'}`;
};

/* Rank 30 allows the most of a slice and rank 1 the fewest. */
export const rankPhrase = (rank) =>
  rank >= 16 ? `allow the ${ordinal(31 - rank)} most` : `allow the ${ordinal(rank)} fewest`;

/* The ticker's day label: "Fri, Apr 10". */
export const shortSlateDay = (date) =>
  new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T12:00:00Z`));
