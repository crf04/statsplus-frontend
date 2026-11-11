import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal } from 'react-bootstrap';
import { bookMark, bookName, categoryLabel, orderCategories } from './displayConfig';
import { ROTATION_SOURCE } from './matchupApi';
import ErrorMessage from '../feedback/ErrorMessage';
import { useFeedback } from '../feedback/useFeedback';
import HelpTip from '../help/HelpTip';
import { MarketReading, ScorePill, tone } from '../profileMatchup/ProfileMatchupCard';
import { readMatchup, scoreText } from '../profileMatchup/matchupReading';

const BOOKS_SHOWN = 4;
const WINDOW_LABELS = { season: 'Season', last15: 'Last 15' };
const RESPONSE_WINDOWS = { season: 'season', last15: 'last_15' };

const formatDelta = (value) => `${value > 0 ? '+' : ''}${value.toFixed(3)}`;
const signClass = (value) => {
  if (value > 0) return 'delta-up';
  if (value < 0) return 'delta-down';
  return 'delta-flat';
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

// Every app and market that numbers the stat, priced or not, then every
// sportsbook quoting it. The rail shows one line, so this is where the others
// are read. The best price is the backend's call (books on equal lines only).
// This table only marks it, with a star as well as weight so colour is not the
// only signal.
const APP_ORDER = ['prizepicks', 'underdog', 'dabble', 'novig', 'kalshi', 'polymarket'];
const SOURCES = [
  { source: 'app', label: 'Apps' },
  { source: 'book', label: 'Sportsbooks' },
];

const lineRows = (player, market) => [
  ...Object.keys(player.lines ?? {})
    .filter((provider) => typeof player.lines[provider]?.[market] === 'number')
    .sort((a, b) => {
      const rank = (provider) =>
        APP_ORDER.includes(provider) ? APP_ORDER.indexOf(provider) : APP_ORDER.length;
      return rank(a) - rank(b) || a.localeCompare(b);
    })
    .map((provider) => ({
      source: 'app',
      name: provider,
      line: player.lines[provider][market],
      over: player.linePrices?.[provider]?.[market]?.over ?? null,
      under: player.linePrices?.[provider]?.[market]?.under ?? null,
      best: { over: false, under: false },
    })),
  ...(player.bookLines?.[market]?.books ?? []).map((entry) => ({
    source: 'book',
    name: entry.book,
    line: entry.line,
    over: entry.over,
    under: entry.under,
    best: { over: entry.bestOver, under: entry.bestUnder },
  })),
];

function Lines({ market, rows, quote, noLine }) {
  const [expanded, setExpanded] = useState(false);
  const books = rows.filter((row) => row.source === 'book').length;
  const hidden = books - BOOKS_SHOWN;
  const time = asOfTime(quote?.asOf);
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
    <section className="selection-panel selection-panel-books" aria-label="Lines">
      <h3>
        Lines · {market}
        <span className="book-stamp">
          {/* The stamp dates the sportsbook quote, so apps alone carry none. */}
          {books > 0 && (quote.closing ? 'Closing' : time && `as of ${time}`)}
        </span>
      </h3>
      {noLine && <p className="honest-empty">No line in CourtAI’s books.</p>}
      {rows.length > 0 && (
        <div className="selection-table-wrap">
          <table aria-label={`${market} lines`} className="selection-books">
            <thead>
              <tr>
                <th scope="col">Source</th>
                <th scope="col">Line</th>
                <th scope="col">Over</th>
                <th scope="col">Under</th>
              </tr>
            </thead>
            {SOURCES.map(({ source, label }) => {
              const group = rows.filter((row) => row.source === source);
              if (group.length === 0) return null;
              const visible = source === 'book' && !expanded ? group.slice(0, BOOKS_SHOWN) : group;
              return (
                <tbody key={source}>
                  <tr className="selection-books-group">
                    <th scope="colgroup" colSpan={4}>
                      {label}
                    </th>
                  </tr>
                  {visible.map((row) => (
                    <tr key={row.name}>
                      <th scope="row">{bookName(row.name)}</th>
                      <td>{row.line}</td>
                      {price(row.over, row.best.over)}
                      {price(row.under, row.best.under)}
                    </tr>
                  ))}
                </tbody>
              );
            })}
          </table>
        </div>
      )}
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

// The strip is the stat selector, and each tab carries its market's Matchup
// Score for the window. A completed game shows its box score; an upcoming game
// has none yet, so it shows minutes to date and which books post each market.
// The MIN tile is context, not a choice.
// The strip's choices are the DFS categories, any category only sportsbooks
// quote, and any market the Matchup scores with no line (statsplus#457). The
// sportsbook extras feed the lines table alone: they are not DFS
// provenance and are never Target candidates.
const statChoices = (statCategories, bookLines = {}, scores = {}) =>
  orderCategories([
    ...new Set([
      ...statCategories,
      ...Object.keys(bookLines).filter((m) => bookLines[m].books.length),
      ...Object.keys(scores),
    ]),
  ]);

function StripScore({ id, market, windowName }) {
  if (market?.score == null) {
    return (
      <small className="selection-strip-score" id={id}>
        <span aria-hidden="true">—</span>
        <span className="selection-visually-hidden">No {windowName} Matchup Score</span>
      </small>
    );
  }
  return (
    <small className={`selection-strip-score ${tone(market.score)}`} id={id}>
      {scoreText(market.score)}
      <span className="selection-visually-hidden"> {windowName} Matchup Score</span>
    </small>
  );
}

function StatStrip({ player, categories, reading, windowName, activeStat, onPick }) {
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
            aria-describedby={`selection-strip-${category} selection-strip-score-${category}`}
            aria-pressed={activeStat === category}
            onClick={() => onPick(category)}
          >
            <span aria-hidden="true">{category}</span>
            {line ? (
              <b id={`selection-strip-${category}`}>{line.stats[category]?.toFixed(1) ?? '—'}</b>
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
                {!books.length && !player.bookLines?.[category] && (
                  <em className="selection-strip-no-line" aria-hidden="true">
                    no line
                  </em>
                )}
              </b>
            )}
            <StripScore
              id={`selection-strip-score-${category}`}
              market={reading.markets[category]}
              windowName={windowName}
            />
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
  response,
  sheetMarket,
  whyRelevant,
  historical,
  onClose,
}) {
  const previousPlayerId = useRef(player.id);
  const previousSheetMarket = useRef(sheetMarket);
  const categories = orderCategories(player.statCategories);
  const stats = useMemo(
    () => statChoices(player.statCategories, player.bookLines, player.scores),
    [player.statCategories, player.bookLines, player.scores],
  );
  const opponent = player.teamId === game.home.teamId ? game.away.tricode : game.home.tricode;
  const reading = useMemo(
    () =>
      readMatchup(response, opponent, {
        playerId: player.id,
        window: RESPONSE_WINDOWS[windowKey],
      }),
    [response, opponent, player.id, windowKey],
  );
  const [activeStat, setActiveStat] = useState(
    stats.includes(sheetMarket) ? sheetMarket : stats[0],
  );
  useEffect(() => {
    const playerChanged = previousPlayerId.current !== player.id;
    const sheetMarketChanged = previousSheetMarket.current !== sheetMarket;
    setActiveStat((current) => {
      if (playerChanged) {
        return stats.includes(sheetMarket) ? sheetMarket : stats[0];
      }
      if (sheetMarketChanged && sheetMarket !== 'All' && stats.includes(sheetMarket)) {
        return sheetMarket;
      }
      return stats.includes(current) ? current : stats[0];
    });
    previousPlayerId.current = player.id;
    previousSheetMarket.current = sheetMarket;
  }, [player.id, stats, sheetMarket]);
  const rows = orderCategories(Object.keys(player.scores)).map((market) => ({
    market,
    score: player.scores[market][windowKey],
  }));
  const line = player.focalGameLine;
  const lines = lineRows(player, activeStat);
  const noLine = player.playerSource === ROTATION_SOURCE;
  // Feedback opened from the page before the sheet sits outside it; trapping focus
  // would keep the reader from typing in it.
  const feedback = useFeedback();
  const feedbackOutside = Boolean(feedback?.panel && !feedback.panel.container);
  // The URL owns whether the dialog is open, and the page hands focus back to
  // the rail when it closes.
  return (
    <Modal
      show
      onHide={onClose}
      id="matchup-selection-card"
      centered
      scrollable
      size="xl"
      fullscreen="md-down"
      restoreFocus={false}
      enforceFocus={!feedbackOutside}
      className="selection-layer"
      backdropClassName="selection-backdrop"
      aria-labelledby="selection-heading"
      contentClassName="selection-card"
    >
      <div className="selection-card-heading">
        <div>
          <h2 id="selection-heading">{player.name}</h2>
          <p className="selection-game">
            {line
              ? `${line.matchup}, ${line.gameDate}.`
              : `${[`${game.away.tricode} @ ${game.home.tricode}`, gameWhen(game)]
                  .filter(Boolean)
                  .join(', ')}. ${
                  noLine
                    ? 'No line in CourtAI’s books.'
                    : `Markets posted by ${Object.keys(player.provenance)
                        .map(bookName)
                        .join(' and ')}.`
                }`}
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
      <Modal.Body className="selection-card-body">
        <StatStrip
          player={player}
          categories={stats}
          reading={reading}
          windowName={windowName}
          activeStat={activeStat}
          onPick={setActiveStat}
        />
        <section className="selection-panel selection-panel-score" aria-label="Matchup Score">
          <div className="selection-score-heading">
            <div className="help-tip-heading">
              <h3>{activeStat} Matchup Score</h3>
              <HelpTip tip="matchupScore" />
            </div>
            <span className="selection-score-pill">
              <ScorePill
                market={reading.markets[activeStat]}
                title={`${activeStat} ${windowName} Matchup Score`}
              />
            </span>
          </div>
          <div className="pmc">
            <MarketReading reading={reading} name={activeStat} windowName={windowName} />
          </div>
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
            <p className="honest-empty">
              Games vs this opponent covers the markets with a line in CourtAI’s books, so it has no{' '}
              {activeStat} log.
            </p>
          )}
          {status === 'ready' && categories.includes(activeStat) && (
            <OpponentLog
              table={selection.h2h}
              market={activeStat}
              excludesFocalGame={Boolean(selection.experience?.samples.excludesFocalGame)}
            />
          )}
        </section>
        {(lines.length > 0 || noLine) && (
          // Keyed so a new player or stat starts collapsed again.
          <Lines
            key={`${player.id}:${activeStat}`}
            market={activeStat}
            rows={lines}
            quote={player.bookLines?.[activeStat]}
            noLine={noLine}
          />
        )}
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
          {historical ? ' Matchup Scores reflect completed-season context.' : ''}
        </p>
      </Modal.Body>
    </Modal>
  );
}
