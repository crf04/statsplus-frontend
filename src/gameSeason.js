// The NBA season a Matchups page is about (crf04/statsplus#348).

const twoDigits = (year) => String(year % 100).padStart(2, '0');

/** A season starts in October: 2026-10-20 is 2026-27, 2027-04-12 is 2026-27. */
export const seasonOfDate = (date) => {
  const year = Number(date.slice(0, 4));
  const start = Number(date.slice(5, 7)) >= 10 ? year : year - 1;
  return `${start}-${twoDigits(start + 1)}`;
};

/** `0022600003` is 2026-27; an id in another shape names no season. */
export const seasonOfGameId = (gameId) => {
  const match = /^00\d(\d{2})\d{5}$/.exec(gameId ?? '');
  if (!match) return null;
  const start = 2000 + Number(match[1]);
  return `${start}-${twoDigits(start + 1)}`;
};
