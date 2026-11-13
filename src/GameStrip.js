import { formatNumber, numericOrZero, toFiniteNumber } from './numberUtils';
import { bookName } from './matchups/displayConfig';
import { shortSlateDay } from './home/homeFormat';
import { ordinal } from './profileMatchup/matchupReading';

// Line types whose code is not what a reader calls the stat.
const STAT_NAMES = {
  FG3M: '3PM',
  FG3A: '3PA',
  FG2M: '2PM',
  FG2A: '2PA',
  STKS: 'STL+BLK',
  FD_PTS: 'FD pts',
};

// A whole number as is, anything else to one decimal (fantasy points).
const wholeOrTenth = (value) => formatNumber(value, Number.isInteger(value) ? 0 : 1);

const signed = (value) =>
  `${value > 0 ? '+' : value < 0 ? '−' : '±'}${wholeOrTenth(Math.abs(value))}`;

// Each column reads its text from the game's row, or null when the row lacks it.
const count = (key, label = key) => ({
  key,
  label,
  read: (row) => formatNumber(row?.[key], 0, null),
});
const shooting = (made, attempts, label) => ({
  label,
  read: (row) => {
    const madeCount = toFiniteNumber(row?.[made]);
    const attemptCount = toFiniteNumber(row?.[attempts]);
    return madeCount === null || attemptCount === null ? null : `${madeCount}/${attemptCount}`;
  },
});
const USG = {
  label: 'USG',
  read: (row) => {
    const usage = toFiniteNumber(row?.USG_PCT);
    return usage === null ? null : `${Math.round(usage)}%`;
  },
};
const FG = shooting('FGM', 'FGA', 'FG');
const FG2 = shooting('FG2M', 'FG2A', '2P');
const FG3 = shooting('FG3M', 'FG3A', '3P');
const FT = shooting('FTM', 'FTA', 'FT');
const CHANCES = count('REB_CHANCES', 'Chances');

// The box line every game shows; the charted stat's column is gold.
const BOX = [
  count('MIN'),
  count('PTS'),
  count('REB'),
  count('AST'),
  count('FG3M', '3PM'),
  count('STL'),
  count('BLK'),
  count('TOV'),
];

// What sits behind the charted stat: its volume, chances and usage.
const SUPPORTING = {
  PTS: [USG, FG, FG3, FT],
  REB: [CHANCES],
  AST: [count('POTENTIAL_AST', 'Potential'), USG],
  FG3M: [FG3, USG],
  FG3A: [FG3, USG],
  FGM: [FG, FG2, FG3, USG],
  FGA: [FG, FG2, FG3, USG],
  FG2M: [FG2, FG3, USG],
  FG2A: [FG2, FG3, USG],
  FTM: [FT, FG, USG],
  FTA: [FT, FG, USG],
  PRA: [USG],
  PR: [USG],
  PA: [USG],
  TOV: [USG],
  RA: [CHANCES],
};

// "Wed, Nov 4", from an ISO date or an epoch-millisecond date.
const gameDay = (date) => {
  const iso =
    /^\d{4}-\d{2}-\d{2}/.exec(String(date))?.[0] ??
    (/^\d{12,}$/.test(String(date)) ? new Date(Number(date)).toISOString().slice(0, 10) : null);
  return iso ? shortSlateDay(iso) : String(date ?? '');
};

// The sportsbook's closing line for this game and market; points also read
// the older single `closing_line`.
const closingLine = (row, lineType) => {
  const close = row?.closing_lines?.[lineType] ?? (lineType === 'PTS' ? row?.closing_line : null);
  const value = toFiniteNumber(close?.value);
  if (value === null) return null;
  return {
    value,
    book: typeof close.book === 'string' && close.book ? bookName(close.book) : null,
  };
};

// 30 allows the most of the stat, a soft matchup; 1 allows the fewest.
const rankTone = (rank) => (rank >= 21 ? 'is-soft' : rank <= 10 ? 'is-tough' : '');

/**
 * One game of the chart, picked by hovering or tapping its bar or stepping
 * with ‹ ›: its result against the sportsbook close, the opponent's rank in
 * the charted stat, and the box line behind it.
 */
const GameStrip = ({ gameLogs, index, lineType, opponentRanks, onPick }) => {
  const row = gameLogs[index];
  const matchup = typeof row?.MATCHUP === 'string' ? row.MATCHUP : '';
  const opponent = matchup.split(' ')[2] || '';
  const stat = STAT_NAMES[lineType] || lineType;
  const value = numericOrZero(row?.[lineType]);
  const close = closingLine(row, lineType);
  const over = close && value > close.value;
  const ranking = opponentRanks?.[lineType];
  const rank = ranking?.ranks?.[opponent];
  // The charted stat's code stands in for the label's stat words.
  const verb = ranking?.label.match(/ (Allowed|Forced)$/)?.[1]?.toLowerCase();
  const columns = [
    ...BOX.map((column) => ({ ...column, charted: column.key === lineType })),
    ...(SUPPORTING[lineType] || []),
  ]
    .map((column) => ({ ...column, text: column.read(row) }))
    .filter((column) => column.text !== null);

  return (
    <section className="game-strip" aria-label="Picked game">
      <div className="game-strip-header">
        <button
          type="button"
          aria-label="Previous game"
          disabled={index <= 0}
          onClick={() => onPick(index - 1)}
        >
          ‹
        </button>
        <div>
          <div className="game-strip-date">{gameDay(row?.GAME_DATE)}</div>
          <div>
            {/ vs\.? /.test(matchup) ? 'vs' : '@'} <b>{opponent}</b> · game {index + 1} of{' '}
            {gameLogs.length}
          </div>
        </div>
        <button
          type="button"
          aria-label="Next game"
          disabled={index >= gameLogs.length - 1}
          onClick={() => onPick(index + 1)}
        >
          ›
        </button>
      </div>
      <div className="game-strip-result">
        <span className={`game-strip-value${close ? (over ? ' is-over' : ' is-under') : ''}`}>
          {wholeOrTenth(value)}
        </span>
        <span className="game-strip-stat">{stat}</span>
        <div className="game-strip-lines">
          {close && (
            <div className="game-strip-close">
              Closed {formatNumber(close.value, 1)}
              {close.book && ` ${close.book}`}{' '}
              <span className={over ? 'is-over' : 'is-under'}>{signed(value - close.value)}</span>
            </div>
          )}
          {rank && (
            <div className="game-strip-rank">
              {opponent}{' '}
              <span className={`game-strip-chip ${rankTone(rank)}`}>{ordinal(rank)}</span> {stat}
              {verb && ` ${verb}`}
            </div>
          )}
        </div>
      </div>
      <dl className="game-strip-box">
        {columns.map((column) => (
          <div key={column.label} className={column.charted ? 'is-charted' : undefined}>
            <dt>{column.label}</dt>
            <dd>{column.text}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
};

export default GameStrip;
