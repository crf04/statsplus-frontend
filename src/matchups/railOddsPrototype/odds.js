/*
 * PROTOTYPE — throwaway. Reads one stat's sportsbook quote into the line the
 * row talks about and its best prices.
 */
export const price = (p) => (p === null ? '—' : p > 0 ? `+${p}` : `−${Math.abs(p)}`);

// The line most books post; ties go to the one matching the DFS headline,
// then the lower line.
const consensusLine = (books, headline) => {
  const counts = new Map();
  books.forEach((b) => counts.set(b.line, (counts.get(b.line) || 0) + 1));
  return [...counts.entries()].sort(
    (a, b) => b[1] - a[1] || Number(b[0] === headline) - Number(a[0] === headline) || a[0] - b[0],
  )[0][0];
};

const better = (a, b) => (b === null ? a : a === null ? b : Math.max(a, b));
const implied = (p) => (p < 0 ? -p / (-p + 100) : 100 / (p + 100));

export const readQuote = (player, stat, headline) => {
  const quote = player.bookLines?.[stat];
  if (!quote || quote.books.length === 0) return null;
  const line = consensusLine(quote.books, headline);
  const atLine = quote.books.filter((b) => b.line === line);
  const bestOver = atLine.reduce((best, b) => better(best, b.over), null);
  const bestUnder = atLine.reduce((best, b) => better(best, b.under), null);
  const overBooks = atLine.filter((b) => b.over !== null && b.over === bestOver).map((b) => b.book);
  const underBooks = atLine
    .filter((b) => b.under !== null && b.under === bestUnder)
    .map((b) => b.book);
  // No-vig Over share, averaged over books quoting both sides at this line.
  const pairs = atLine.filter((b) => b.over !== null && b.under !== null);
  const overShare = pairs.length
    ? pairs.reduce((sum, b) => {
        const o = implied(b.over);
        return sum + o / (o + implied(b.under));
      }, 0) / pairs.length
    : null;
  return {
    line,
    bestOver,
    bestUnder,
    overBooks,
    underBooks,
    overShare,
    booksAtLine: atLine.length,
    books: quote.books,
    otherLines: [...new Set(quote.books.map((b) => b.line))].filter((l) => l !== line),
  };
};
