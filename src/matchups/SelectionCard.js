import { useEffect, useMemo, useRef, useState } from 'react';
import {
  bookMark,
  bookName,
  categoryLabel,
  formatScorePercent as formatPercent,
  orderCategories,
} from './displayConfig';
import ErrorMessage from '../feedback/ErrorMessage';
import HelpTip from '../help/HelpTip';

const BASE_ORDER = [
  'shotTypes',
  'shotZones',
  'playTypes',
  'assistLocations',
  'traditional',
  'reboundTypes',
];
const BASE_LABELS = {
  playTypes: 'Play types',
  shotZones: 'Shot zones',
  shotTypes: 'Shot types',
  assistLocations: 'Assist locations',
  traditional: 'Traditional',
  reboundTypes: 'Rebound types',
};
const BOOKS_SHOWN = 4;
const WINDOW_LABELS = { season: 'Season', last15: 'Last 15' };

const formatDelta = (value) => `${value > 0 ? '+' : ''}${value.toFixed(3)}`;
const signClass = (value) => {
  if (value > 0) return 'delta-up';
  if (value < 0) return 'delta-down';
  return 'delta-flat';
};
// A cell's wash is the score: greener up, redder down, nothing for a flat or
// absent score. Alpha is capped so a large score stays legible.
const washStyle = (component) => {
  if (!component || Math.round(component.value * 100) === 0) return undefined;
  const alpha = Math.min(0.55, Math.abs(component.value) * 3);
  const family = component.value > 0 ? 'hit' : 'miss';
  return {
    background: `rgb(var(--ct-${family}-bg-rgb) / calc(${alpha.toFixed(2)} * var(--ct-k-accent-bg)))`,
  };
};

// The tip time is the schedule's own time in the reader's zone.
const gameWhen = (game) => {
  const when = new Date(game.scheduledAt);
  if (Number.isNaN(when.getTime())) return null;
  const day = when.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  const time = when.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return `${day}, ${time}`;
};

const formatPrice = (price) => (price === null ? '—' : price > 0 ? `+${price}` : `${price}`);
const asOfTime = (stamp) => {
  const when = new Date(stamp);
  if (Number.isNaN(when.getTime())) return null;
  return when.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
};

// Sportsbook quotes for the selected stat. The best price is the backend's
// call (equal lines only); this table only marks it, with a star as well as
// weight so colour is not the only signal.
function BookLines({ market, quote }) {
  const [expanded, setExpanded] = useState(false);
  const hidden = quote.books.length - BOOKS_SHOWN;
  const shown = expanded || hidden <= 0 ? quote.books : quote.books.slice(0, BOOKS_SHOWN);
  const time = asOfTime(quote.asOf);
  const price = (value, best) => (
    <td className={best ? 'book-best' : undefined}>
      {formatPrice(value)}
      {best && (
        <span role="img" aria-label="best price">
          {' '}
          ★
        </span>
      )}
    </td>
  );
  return (
    <section className="selection-panel selection-panel-books" aria-label="Sportsbooks">
      <h3>
        Sportsbooks · {market}
        <span className="book-stamp">
          {quote.closing ? 'Closing' : time ? `as of ${time}` : null}
        </span>
      </h3>
      <div className="selection-table-wrap">
        <table aria-label={`${market} sportsbook lines`} className="selection-books">
          <thead>
            <tr>
              <th scope="col">Book</th>
              <th scope="col">Line</th>
              <th scope="col">Over</th>
              <th scope="col">Under</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((entry) => (
              <tr key={entry.book}>
                <th scope="row">{bookName(entry.book)}</th>
                <td>{entry.line}</td>
                {price(entry.over, entry.bestOver)}
                {price(entry.under, entry.bestUnder)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {hidden > 0 && (
        <button
          type="button"
          className="book-more"
          aria-expanded={expanded}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? 'Show fewer' : `+${hidden} more`}
        </button>
      )}
    </section>
  );
}

// Every app and market that numbers the stat, priced or not: the rail shows
// one line, so this is where the others are read.
const APP_ORDER = ['prizepicks', 'underdog', 'dabble', 'novig', 'kalshi', 'polymarket'];

const appQuotes = (player, market) =>
  Object.keys(player.lines ?? {})
    .filter((provider) => typeof player.lines[provider]?.[market] === 'number')
    .sort((a, b) => {
      const rank = (provider) =>
        APP_ORDER.includes(provider) ? APP_ORDER.indexOf(provider) : APP_ORDER.length;
      return rank(a) - rank(b) || a.localeCompare(b);
    })
    .map((provider) => ({
      provider,
      line: player.lines[provider][market],
      over: player.linePrices?.[provider]?.[market]?.over ?? null,
      under: player.linePrices?.[provider]?.[market]?.under ?? null,
    }));

// Renders nothing when no app numbers the stat, whatever the books quote.
function DfsLines({ player, market }) {
  const quotes = appQuotes(player, market);
  if (quotes.length === 0) return null;
  return (
    <section className="selection-panel selection-panel-books" aria-label="Apps">
      <h3>Apps · {market}</h3>
      <div className="selection-table-wrap">
        <table aria-label={`${market} app lines`} className="selection-books">
          <thead>
            <tr>
              <th scope="col">App</th>
              <th scope="col">Line</th>
              <th scope="col">Over</th>
              <th scope="col">Under</th>
            </tr>
          </thead>
          <tbody>
            {quotes.map((entry) => (
              <tr key={entry.provider}>
                <th scope="row">{bookName(entry.provider)}</th>
                <td>{entry.line}</td>
                <td>{formatPrice(entry.over)}</td>
                <td>{formatPrice(entry.under)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Cell({ component }) {
  if (!component) return <span className="score-none">—</span>;
  return (
    <>
      {formatPercent(component.value)}
      {component.thin && <span className="thin-flag">thin</span>}
    </>
  );
}

function Sparkline({ values }) {
  if (values.length < 2) return null;
  const max = Math.max(...values, 1);
  const points = values
    .map((value, index) => `${(index / (values.length - 1)) * 60},${18 - (value / max) * 16}`)
    .join(' ');
  return (
    <svg className="selection-strip-sparkline" viewBox="0 0 60 18" aria-hidden="true">
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

// The strip is the stat selector. A completed game shows its box score; an
// upcoming game has none yet, so it shows minutes to date and which books post
// each market. The MIN tile is context, not a choice.
// The strip's choices are the DFS categories plus any category only sportsbooks
// quote. The extras feed the Sportsbooks table alone: they are not DFS
// provenance, have no score row and are never Target candidates.
const statChoices = (statCategories, bookLines = {}) =>
  orderCategories([
    ...new Set([
      ...statCategories,
      ...Object.keys(bookLines).filter((m) => bookLines[m].books.length),
    ]),
  ]);

function StatStrip({ player, categories, activeStat, onPick }) {
  const line = player.focalGameLine;
  const minutes = player.last10Minutes;
  const minutesAverage = minutes.length
    ? minutes.reduce((sum, value) => sum + value, 0) / minutes.length
    : null;
  return (
    <div className="selection-strip" role="group" aria-label="Selection log stat">
      <div className="selection-strip-tile selection-strip-minutes">
        <span>{line ? 'MIN' : 'MIN, last 10'}</span>
        <b>
          {line
            ? line.minutes.toFixed(1)
            : minutesAverage === null
              ? '—'
              : minutesAverage.toFixed(1)}
          {!line && <Sparkline values={minutes} />}
        </b>
      </div>
      {categories.map((category) => {
        const providers = line
          ? []
          : Object.entries(player.provenance)
              .filter(([, markets]) => markets.includes(category))
              .map(([provider]) => provider);
        const books = providers.map(bookMark);
        return (
          <button
            type="button"
            key={category}
            className="selection-strip-tile"
            aria-label={categoryLabel(category)}
            aria-describedby={`selection-strip-${category}`}
            aria-pressed={activeStat === category}
            onClick={() => onPick(category)}
          >
            <span aria-hidden="true">{category}</span>
            {line ? (
              <b id={`selection-strip-${category}`}>{line.stats[category].toFixed(1)}</b>
            ) : (
              <b className="selection-strip-books">
                <span className="selection-visually-hidden" id={`selection-strip-${category}`}>
                  {providers.length
                    ? `Posted by ${providers.map(bookName).join(' and ')}`
                    : player.bookLines?.[category]
                      ? 'Quoted by sportsbooks only'
                      : 'Not posted'}
                </span>
                {(books.length || !player.bookLines?.[category]
                  ? books
                  : player.bookLines[category].books.map((entry) => bookMark(entry.book))
                ).map((mark) => (
                  <i key={mark} aria-hidden="true">
                    {mark}
                  </i>
                ))}
              </b>
            )}
          </button>
        );
      })}
    </div>
  );
}

function OpponentLog({ table, market, excludesFocalGame }) {
  const games = table.rows.filter((row) => !row.average);
  const average = table.rows.find((row) => row.average);
  if (games.length === 0) {
    return <p className="honest-empty">No games vs this opponent data is available.</p>;
  }
  const opponent = games[0].matchup.replace(/^.*(?:vs\.|@)\s*/, '');
  return (
    <>
      {average && (
        <p className="selection-average">
          <b>{average.stats[market].toFixed(1)}</b>
          <span>
            {market} avg <em>in {average.minutes.toFixed(1)} min</em>
          </span>
          <span className={signClass(average.deltas[market])}>
            {formatDelta(average.deltas[market])} /min
          </span>
        </p>
      )}
      <p className="selection-log-kicker">
        vs {opponent}, {games.length} {games.length === 1 ? 'game' : 'games'}
        {excludesFocalGame ? ' before this one' : ''}
        {table.thin && <span className="thin-flag">thin</span>}
      </p>
      {table.thin && <p className="thin-note">Thin sample — interpret cautiously.</p>}
      <div className="selection-table-wrap">
        <table className="selection-log-table">
          <thead>
            <tr>
              <th scope="col">Game</th>
              <th scope="col">MIN</th>
              <th scope="col">{market}</th>
              <th scope="col">±/MIN</th>
            </tr>
          </thead>
          <tbody>
            {games.map((row) => (
              <tr key={row.date}>
                <th scope="row">
                  {row.date} · <small>{row.matchup}</small>
                </th>
                <td>{row.minutes.toFixed(1)}</td>
                <td className="selection-log-stat">{row.stats[market].toFixed(1)}</td>
                <td className={signClass(row.deltas[market])}>{formatDelta(row.deltas[market])}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default function SelectionCard({
  player,
  game,
  selection,
  status,
  error,
  windowKey,
  windowName = WINDOW_LABELS[windowKey],
  sheetMarket,
  whyRelevant,
  historical,
  onClose,
}) {
  const panelRef = useRef(null);
  const previousPlayerId = useRef(player.id);
  const previousSheetMarket = useRef(sheetMarket);
  const categories = orderCategories(player.statCategories);
  const stats = useMemo(
    () => statChoices(player.statCategories, player.bookLines),
    [player.statCategories, player.bookLines],
  );
  const [activeStat, setActiveStat] = useState(
    stats.includes(sheetMarket) ? sheetMarket : stats[0],
  );
  useEffect(() => panelRef.current?.focus(), [player.id]);
  useEffect(() => {
    const playerChanged = previousPlayerId.current !== player.id;
    const sheetMarketChanged = previousSheetMarket.current !== sheetMarket;
    const ordered = stats;
    setActiveStat((current) => {
      if (playerChanged) {
        return ordered.includes(sheetMarket) ? sheetMarket : ordered[0];
      }
      if (sheetMarketChanged && sheetMarket !== 'All' && ordered.includes(sheetMarket)) {
        return sheetMarket;
      }
      return ordered.includes(current) ? current : ordered[0];
    });
    previousPlayerId.current = player.id;
    previousSheetMarket.current = sheetMarket;
  }, [player.id, stats, sheetMarket]);
  const rows = categories
    .filter((market) => Object.hasOwn(player.scores, market))
    .map((market) => ({ market, score: player.scores[market][windowKey] }));
  const unscored = categories.filter((market) => !Object.hasOwn(player.scores, market));
  const baseRank = (base) => {
    const index = BASE_ORDER.indexOf(base);
    return index === -1 ? BASE_ORDER.length : index;
  };
  const bases = [...new Set(rows.flatMap(({ score }) => Object.keys(score.components)))].sort(
    (a, b) => baseRank(a) - baseRank(b),
  );
  const hasBlend = rows.some(({ score }) => score.blend);
  const line = player.focalGameLine;
  return (
    <section
      ref={panelRef}
      id="matchup-selection-card"
      className="selection-card"
      aria-labelledby="selection-heading"
      tabIndex="-1"
      onKeyDown={(event) => {
        if (event.key === 'Escape') onClose();
      }}
    >
      <div className="selection-card-heading">
        <div>
          <h2 id="selection-heading">{player.name}</h2>
          <p className="selection-game">
            {line
              ? `${line.matchup}, ${line.gameDate}.`
              : `${[`${game.away.tricode} @ ${game.home.tricode}`, gameWhen(game)]
                  .filter(Boolean)
                  .join(', ')}. Markets posted by ${Object.keys(player.provenance)
                  .map(bookName)
                  .join(' and ')}.`}
          </p>
        </div>
        <button
          type="button"
          className="selection-close"
          aria-label="Close selection card"
          onClick={onClose}
        >
          ×
        </button>
      </div>
      <StatStrip
        player={player}
        categories={stats}
        activeStat={activeStat}
        onPick={setActiveStat}
      />
      <div className="selection-panels">
        <section className="selection-panel" aria-label="Score Matrix">
          <div className="help-tip-heading">
            <h3>Score Matrix</h3>
            <HelpTip tip="scoreMatrix" />
          </div>
          {rows.length > 0 && (
            <div className="selection-table-wrap">
              <table aria-label={`${player.name} Score Matrix`} className="selection-matrix">
                <thead>
                  <tr>
                    <th scope="col">{historical ? 'Category' : 'Market'}</th>
                    {bases.map((base) => (
                      <th scope="col" key={base}>
                        {BASE_LABELS[base] || base}
                      </th>
                    ))}
                    {hasBlend && (
                      <th scope="col" className="blend-col">
                        Blend
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ market, score }) => (
                    <tr
                      key={market}
                      className={market === activeStat ? 'active-market-row' : undefined}
                      onClick={() => setActiveStat(market)}
                    >
                      <th scope="row">
                        <button
                          type="button"
                          className="selection-matrix-pick"
                          aria-pressed={market === activeStat}
                          onClick={(event) => {
                            event.stopPropagation();
                            setActiveStat(market);
                          }}
                        >
                          {market}
                        </button>
                      </th>
                      {bases.map((base) => (
                        <td key={base} style={washStyle(score.components[base])}>
                          <Cell component={score.components[base]} />
                        </td>
                      ))}
                      {hasBlend && (
                        <td className="blend-col" style={washStyle(score.blend)}>
                          <Cell component={score.blend} />
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {unscored.length > 0 && (
            <p className="honest-empty">No Matchup Score is computed for {unscored.join(', ')}.</p>
          )}
        </section>
        <section
          className="selection-panel selection-panel-log"
          aria-label="Games vs this opponent"
        >
          <h3>Games vs this opponent</h3>
          {status === 'loading' && <p role="status">Loading selection logs…</p>}
          {status === 'error' && (
            <p role="alert">
              <ErrorMessage message={error} />
            </p>
          )}
          {status === 'ready' && !categories.includes(activeStat) && (
            <p className="honest-empty">No games vs this opponent log is kept for {activeStat}.</p>
          )}
          {status === 'ready' && categories.includes(activeStat) && (
            <OpponentLog
              table={selection.h2h}
              market={activeStat}
              excludesFocalGame={Boolean(selection.experience?.samples.excludesFocalGame)}
            />
          )}
        </section>
      </div>
      {player.bookLines?.[activeStat]?.books.length > 0 && (
        // Keyed so a new player or stat starts collapsed again.
        <BookLines
          key={`${player.id}:${activeStat}`}
          market={activeStat}
          quote={player.bookLines[activeStat]}
        />
      )}
      <DfsLines player={player} market={activeStat} />
      {rows
        .filter(({ score }) => Object.keys(score.components).length === 0 && score.blend === null)
        .map(({ market }) => (
          <p className="honest-empty" key={`degraded-${market}`}>
            No score components were computable for {market} in {windowName}.
          </p>
        ))}
      {/* Component evidence can survive a score the contract could not
          complete, so the card names what that score was missing. */}
      {rows
        .filter(({ score }) => score.blend === null && score.missingInputs.length > 0)
        .map(({ market, score }) => (
          <p className="honest-empty" key={`withheld-${market}`}>
            {market} Matchup Score unavailable in {windowName}: missing{' '}
            {score.missingInputs.join(', ')}.
          </p>
        ))}
      <p className="selection-explainer">
        {whyRelevant
          ? 'Highlighted Defense Sheet rows show displayed Season Diet Share inputs.'
          : 'This player is not opposing the viewed Defense Sheet, so no why rows are highlighted.'}{' '}
        Scores and deltas are delivered by the API.
        {historical ? ' The Score Matrix reflects completed-season context.' : ''}
      </p>
    </section>
  );
}
