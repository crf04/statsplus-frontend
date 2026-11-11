/*
 * PROTOTYPE — throwaway. Everything one bar's hover card can say about its
 * game, read from the game-log row the chart already has. No new requests.
 */
import { formatNumber, toFiniteNumber } from '../numberUtils';
import { bookName } from '../matchups/displayConfig';
import { ordinal } from '../profileMatchup/matchupReading';

const count = (key, label = key) => ({ kind: 'count', key, label });
const split = (made, att, label) => ({ kind: 'split', made, att, label });
const pct = (key, label) => ({ kind: 'pct', key, label });

const MIN = count('MIN');
const USG = pct('USG_PCT', 'USG');
const FG = split('FGM', 'FGA', 'FG');
const FG2 = split('FG2M', 'FG2A', '2P');
const FG3 = split('FG3M', 'FG3A', '3P');
const FT = split('FTM', 'FTA', 'FT');

// What moved the charted stat in this game: its volume and opportunity.
const DRIVERS = {
  PTS: [MIN, USG, FG, FG3, FT],
  REB: [MIN, count('REB_CHANCES', 'Chances'), count('OREB'), count('DREB')],
  AST: [MIN, count('POTENTIAL_AST', 'Potential'), USG, count('TOV')],
  FG3M: [MIN, FG3, count('FGA'), USG],
  FG3A: [MIN, FG3, count('FGA'), USG],
  PRA: [MIN, USG, count('PTS'), count('REB'), count('AST')],
  PR: [MIN, USG, count('PTS'), count('REB')],
  PA: [MIN, USG, count('PTS'), count('AST')],
  RA: [MIN, count('REB'), count('AST'), count('REB_CHANCES', 'Reb chances')],
  STL: [MIN, count('STL'), count('BLK'), count('PF')],
  BLK: [MIN, count('BLK'), count('STL'), count('PF')],
  STKS: [MIN, count('STL'), count('BLK'), count('PF')],
  FTM: [MIN, FT, FG, USG],
  FTA: [MIN, FT, FG, USG],
  FGM: [MIN, FG, FG2, FG3, USG],
  FGA: [MIN, FG, FG2, FG3, USG],
  FG2M: [MIN, FG2, FG3, USG],
  FG2A: [MIN, FG2, FG3, USG],
  TOV: [MIN, USG, count('AST'), count('TOV')],
  FD_PTS: [MIN, count('PTS'), count('REB'), count('AST'), count('STKS', 'STL+BLK'), count('TOV')],
};

// The full box line D shows, charted stat highlighted.
export const BOX = [
  ['MIN', 'MIN'],
  ['PTS', 'PTS'],
  ['REB', 'REB'],
  ['AST', 'AST'],
  ['FG3M', '3PM'],
  ['STL', 'STL'],
  ['BLK', 'BLK'],
  ['TOV', 'TOV'],
];

export const STAT_NAME = {
  FG3M: '3PM',
  FG3A: '3PA',
  FG2M: '2PM',
  FG2A: '2PA',
  FD_PTS: 'FD pts',
  STKS: 'STL+BLK',
};
export const statName = (lineType) => STAT_NAME[lineType] || lineType;

const one = (value) => formatNumber(value, Number.isInteger(value) ? 0 : 1);

export const longDate = (iso) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso));
  if (!m) return String(iso || '');
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
};

const driverReading = (driver, log, avg) => {
  if (driver.kind === 'split') {
    const made = toFiniteNumber(log?.[driver.made]);
    const att = toFiniteNumber(log?.[driver.att]);
    if (made === null || att === null) return null;
    const avgAtt = toFiniteNumber(avg?.[driver.att]);
    return {
      label: driver.label,
      text: `${made}/${att}`,
      sub: att > 0 ? `${Math.round((made / att) * 100)}%` : '—',
      value: att,
      avg: avgAtt,
      avgText: avgAtt === null ? null : `${one(avgAtt)} att`,
      unit: 'att',
    };
  }
  const value = toFiniteNumber(log?.[driver.key]);
  if (value === null) return null;
  const average = toFiniteNumber(avg?.[driver.key]);
  const isPct = driver.kind === 'pct';
  return {
    label: driver.label,
    text: isPct ? `${Math.round(value)}%` : one(value),
    value,
    avg: average,
    avgText: average === null ? null : isPct ? `${Math.round(average)}%` : one(average),
  };
};

/**
 * One game, read for a hover card. `line` is the number the chart draws
 * (tonight's posted line, a typed line, or the season average).
 */
export const gameFacts = ({ log, lineType, line, lineSource, opponentRanks, average }) => {
  const matchup = typeof log?.MATCHUP === 'string' ? log.MATCHUP : '';
  const opponent = matchup.split(' ')[2] || 'N/A';
  const home = matchup.includes('vs.');
  const value = toFiniteNumber(log?.[lineType]) ?? 0;
  const ranking = opponentRanks?.[lineType];
  const rank = ranking?.ranks?.[opponent] ?? null;
  const closingRaw =
    log?.closing_lines?.[lineType] ?? (lineType === 'PTS' ? log?.closing_line : null);
  const closingValue = toFiniteNumber(closingRaw?.value);
  const closing =
    closingValue === null
      ? null
      : {
          value: closingValue,
          book: bookName(closingRaw.book),
          margin: value - closingValue,
          over: value > closingValue,
        };
  const hasLine = Number.isFinite(line) && line > 0;
  const drivers = (DRIVERS[lineType] || [MIN, USG])
    .map((driver) => driverReading(driver, log, average))
    .filter(Boolean);
  const statAvg = toFiniteNumber(average?.[lineType]);
  return {
    date: longDate(log?.GAME_DATE),
    iso: log?.GAME_DATE,
    opponent,
    home,
    where: home ? 'vs' : '@',
    stat: statName(lineType),
    value,
    statAvg,
    line: hasLine
      ? { value: line, source: lineSource, margin: value - line, over: value > line }
      : null,
    closing,
    rank:
      rank === null
        ? null
        : {
            rank,
            text: ordinal(rank),
            label: ranking.label,
            // 30 = allows the most: a soft matchup for this stat.
            tone: rank >= 21 ? 'soft' : rank <= 10 ? 'tough' : 'mid',
          },
    drivers,
  };
};

export const signed = (n, digits = 1) =>
  `${n > 0 ? '+' : n < 0 ? '−' : '±'}${formatNumber(Math.abs(n), Number.isInteger(n) ? 0 : digits)}`;
