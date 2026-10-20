import { useState } from 'react';
import { formatNumber, toFiniteNumber } from './numberUtils';
import { lineSourceId, postedLineFor } from './gameLogsApi';

/**
 * What the user picked as the line for one player and Line Type (`key`):
 *   { key, mode: 'default' }            the posted default, else the season average
 *   { key, mode: 'source', sourceId }   a posted source, while it posts the market
 *   { key, mode: 'typed', typed }       the Line Value as typed
 */
const defaultSelection = (key) => ({ key, mode: 'default' });

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

export const useLineSelection = ({ player, lineType, postedLine, averages }) => {
  const key = `${player}|${lineType}`;
  const [selection, setSelection] = useState(() => defaultSelection(key));
  // Another player or Line Type replaces the selection in the render that
  // brings it, before any of its data arrives.
  const current = selection.key === key ? selection : defaultSelection(key);
  if (current !== selection) setSelection(current);
  return {
    ...resolveLine(current, postedLine, lineType, averages),
    chooseSource: (sourceId) => setSelection({ key, mode: 'source', sourceId }),
    typeLineValue: (typed) => setSelection({ key, mode: 'typed', typed }),
  };
};
