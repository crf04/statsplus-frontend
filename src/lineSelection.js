import { useState } from 'react';
import { formatNumber, toFiniteNumber } from './numberUtils';
import { lineSourceId, postedLineFor } from './gameLogsApi';
import { parseLine } from './filterUtils';

/**
 * What the user picked as the line for one player and Line Type (`key`):
 *   { key, link, mode: 'default' }            the posted default, else the season average
 *   { key, link, mode: 'source', sourceId }   a posted source, while it posts the market
 *   { key, link, mode: 'typed', typed }       the Line Value as typed
 * `link` is the URL's `line` the selection last agreed with.
 */
const fromLink = (key, link) =>
  link === null ? { key, link, mode: 'default' } : { key, link, mode: 'typed', typed: link };

// The Line Value and the posted source it is drawn from (null for a typed value
// or the season average), read from the current data on every render.
const resolveLine = (selection, postedLine, lineType, averages) => {
  if (selection.mode === 'typed') return { lineValue: selection.typed, lineSource: null };
  const posted =
    (selection.mode === 'source' && postedLineFor(postedLine, lineType, selection.sourceId)) ||
    postedLineFor(postedLine, lineType);
  if (posted) return { lineValue: formatNumber(posted.line, 1), lineSource: lineSourceId(posted) };
  const average = toFiniteNumber(averages?.[1]?.[lineType]);
  return { lineValue: average === null ? '' : formatNumber(average, 1), lineSource: null };
};

// The `line` a URL carries for this selection: the shown value whenever it is
// not the default line, else null. Undefined while a chosen source waits for
// a pending load, since a load clears posted lines and the source returns with them.
const linkFor = (selection, { lineValue, lineSource }, postedLine, lineType, averages, pending) => {
  if (selection.mode === 'source' && pending) return undefined;
  const link = parseLine(lineValue);
  const fallback = resolveLine({ mode: 'default' }, postedLine, lineType, averages);
  if (selection.mode === 'typed') return link === parseLine(fallback.lineValue) ? null : link;
  return lineSource === fallback.lineSource ? null : link;
};

/**
 * `link` is the URL's `line`, parsed, and `pending` is true while a load that
 * brings posted lines is in flight. The selection starts from `link`, and starts
 * over from it whenever the URL changes to a line this selection would not
 * write, so the caller writes the returned `link` back and the two never
 * disagree for longer than that write.
 */
export const useLineSelection = ({
  player,
  lineType,
  postedLine,
  averages,
  link = null,
  pending = false,
}) => {
  const key = `${player}|${lineType}`;
  const [selection, setSelection] = useState(() => fromLink(key, link));
  const read = (candidate) => {
    const resolved = resolveLine(candidate, postedLine, lineType, averages);
    return {
      ...resolved,
      link: linkFor(candidate, resolved, postedLine, lineType, averages, pending),
    };
  };
  // Another player or Line Type, or a URL line from elsewhere (a link, Back,
  // a Saved Filter Set), replaces the selection in the render that brings it.
  let current = selection;
  if (current.key !== key) current = fromLink(key, link);
  else if (current.link !== link) {
    current = read(current).link === link ? { ...current, link } : fromLink(key, link);
  }
  if (current !== selection) setSelection(current);
  return {
    ...read(current),
    chooseSource: (sourceId) => setSelection({ ...current, mode: 'source', sourceId }),
    typeLineValue: (typed) => setSelection({ ...current, mode: 'typed', typed }),
  };
};
