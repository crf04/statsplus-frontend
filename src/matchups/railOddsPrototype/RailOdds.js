/*
 * PROTOTYPE — throwaway. Four ways to show a player's sportsbook Over/Under
 * prices in his Matchup rail row. Each takes the quote read by odds.js.
 */
import { bookMark, bookName } from '../displayConfig';
import { price } from './odds';
import './railOdds.css';

const formatStat = (value) => (Number.isInteger(value) ? String(value) : value.toFixed(1));

const marks = (books) => books.map(bookMark).join(' ');
const lineNote = (quote, headline) =>
  headline !== null && quote.line !== headline ? `books ${formatStat(quote.line)}` : null;

// A — one quiet line under the headline: best Over and Under at the books' line.
export function OddsA({ quote, headline }) {
  const note = lineNote(quote, headline);
  return (
    <span className="ro-a" aria-label="Sportsbook prices">
      {note && <em>{note}</em>}
      <span>
        o <b>{price(quote.bestOver)}</b> <i>{marks(quote.overBooks.slice(0, 1))}</i>
      </span>
      <span>
        u <b>{price(quote.bestUnder)}</b> <i>{marks(quote.underBooks.slice(0, 1))}</i>
      </span>
    </span>
  );
}

// B — a sportsbook-style Over / Under button pair as the row's third column.
export function OddsB({ quote, headline }) {
  const note = lineNote(quote, headline);
  return (
    <div className="ro-b" aria-label="Sportsbook prices">
      {note && <em>{note}</em>}
      <span className="ro-b-cell">
        <small>O {formatStat(quote.line)}</small>
        <b>{price(quote.bestOver)}</b>
        <i>{marks(quote.overBooks.slice(0, 2))}</i>
      </span>
      <span className="ro-b-cell">
        <small>U {formatStat(quote.line)}</small>
        <b>{price(quote.bestUnder)}</b>
        <i>{marks(quote.underBooks.slice(0, 2))}</i>
      </span>
    </div>
  );
}

// C — every book, full width under the row: line, then Over / Under.
export function OddsC({ quote }) {
  return (
    <ul className="ro-c" aria-label="Sportsbook prices by book">
      {quote.books.map((b) => (
        <li key={b.book} title={bookName(b.book)}>
          <i>{bookMark(b.book)}</i>
          <span className="ro-c-line">{formatStat(b.line)}</span>
          <span className={b.bestOver ? 'best' : undefined}>{price(b.over)}</span>
          <span className="ro-c-slash">/</span>
          <span className={b.bestUnder ? 'best' : undefined}>{price(b.under)}</span>
        </li>
      ))}
    </ul>
  );
}

// D — the books' no-vig split as a bar, best prices at each end.
export function OddsD({ quote }) {
  if (quote.overShare === null) return <OddsA quote={quote} headline={null} />;
  const over = Math.round(quote.overShare * 100);
  return (
    <div className="ro-d" aria-label={`Books imply Over ${over}%, Under ${100 - over}%`}>
      <span className="ro-d-side">
        Over {formatStat(quote.line)} <b>{price(quote.bestOver)}</b>
      </span>
      <span className="ro-d-bar" aria-hidden="true">
        <span style={{ width: `${over}%` }}>{over}%</span>
        <span>{100 - over}%</span>
      </span>
      <span className="ro-d-side">
        <b>{price(quote.bestUnder)}</b> Under
      </span>
      <small>
        books imply, vig removed · {quote.booksAtLine} book{quote.booksAtLine === 1 ? '' : 's'}
      </small>
    </div>
  );
}
