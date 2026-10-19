/*
 * The best Over and Under price for one player's stat on the Matchup rail.
 * Sources are the sportsbooks (book_lines) and the DFS and prediction-market
 * providers that price an individual pick (line_prices), each priced at the
 * line it posts. Prices are American; the highest wins.
 */

// Providers whose price sits on one pick, in the order they win a tie after
// the sportsbooks.
export const PRICED_PROVIDERS = Object.freeze(['underdog', 'novig', 'polymarket', 'kalshi']);

export const formatPrice = (price) => (price > 0 ? `+${price}` : `−${Math.abs(price)}`);

const sourcesFor = (player, stat) => {
  const books = (player.bookLines?.[stat]?.books ?? []).map((entry) => ({
    provider: entry.book,
    line: entry.line,
    over: entry.over,
    under: entry.under,
    sportsbook: true,
  }));
  const priced = PRICED_PROVIDERS.flatMap((provider) => {
    const quote = player.linePrices?.[provider]?.[stat];
    const line = player.lines?.[provider]?.[stat];
    if (!quote || line === undefined) return [];
    return [{ provider, line, over: quote.over, under: quote.under, sportsbook: false }];
  });
  return [...books, ...priced].filter((source) => source.over !== null || source.under !== null);
};

// The line most sportsbooks post; ties go to the lower line.
const sportsbookLine = (sources) => {
  const counts = new Map();
  for (const source of sources.filter((s) => s.sportsbook)) {
    counts.set(source.line, (counts.get(source.line) ?? 0) + 1);
  }
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0]);
  return ranked.length ? ranked[0][0] : null;
};

// The first source in order holds a tie, so only a strictly higher price replaces it.
const bestSide = (sources, side) =>
  sources.reduce(
    (best, source) =>
      source[side] !== null && (best === null || source[side] > best.price)
        ? { price: source[side], provider: source.provider }
        : best,
    null,
  );

/*
 * { line, offHeadline, over, under } where over and under are
 * { price, provider } or null, or null when no source prices either side.
 * offHeadline is true when no priced source quotes the headline line, so the
 * row says whose line the prices are for.
 */
export const bestPrices = (player, stat, headline) => {
  const sources = sourcesFor(player, stat);
  const atHeadline = headline !== null && sources.some((source) => source.line === headline);
  const line = atHeadline ? headline : sportsbookLine(sources);
  if (line === null) return null;
  const atLine = sources.filter((source) => source.line === line);
  return {
    line,
    offHeadline: !atHeadline,
    over: bestSide(atLine, 'over'),
    under: bestSide(atLine, 'under'),
  };
};
