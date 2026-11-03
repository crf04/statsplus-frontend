import { useEffect, useRef, useState } from 'react';
import { getTodaySlateDate } from '../../calendarDate';
import { TEAM_CODES } from '../../targets/opponentContextApi';

/* Controls the card pickers share (crf04/statsplus#382). */

/*
 * One read keyed by what it reads: `{status: 'idle' | 'loading' | 'ready' |
 * 'failed', data}`. A null key reads nothing; a new key aborts the last read.
 */
export const useRead = (key, load) => {
  const loadRef = useRef(load);
  loadRef.current = load;
  const [state, setState] = useState({ key: null, status: 'idle', data: null });
  useEffect(() => {
    if (key === null) return undefined;
    const controller = new AbortController();
    loadRef.current(controller.signal).then(
      (data) => {
        if (!controller.signal.aborted) setState({ key, status: 'ready', data });
      },
      () => {
        if (!controller.signal.aborted) setState({ key, status: 'failed', data: null });
      },
    );
    return () => controller.abort();
  }, [key]);
  if (key === null) return { status: 'idle', data: null };
  return state.key === key ? state : { status: 'loading', data: null };
};

export const TEAMS = Object.entries(TEAM_CODES)
  .map(([name, tricode]) => ({ name, tricode }))
  .sort((a, b) => a.name.localeCompare(b.name));

export const PickerField = ({ id, label, children }) => (
  <div className="report-pick-field">
    <label htmlFor={id}>{label}</label>
    {children}
  </div>
);

export const TeamSelect = ({ id, label = 'Team', value, onChange, empty = 'Choose a team' }) => (
  <PickerField id={id} label={label}>
    <select id={id} value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="">{empty}</option>
      {TEAMS.map(({ name, tricode }) => (
        <option key={tricode} value={tricode}>
          {name}
        </option>
      ))}
    </select>
  </PickerField>
);

export const DateField = ({ id, label = 'Date', value, onChange }) => (
  <PickerField id={id} label={label}>
    <input id={id} type="date" required value={value} onChange={(e) => onChange(e.target.value)} />
  </PickerField>
);

/* Today's Slate date, US Eastern, as the card tools read a date. */
export const slateToday = () => getTodaySlateDate(new Date(Date.now()));

/* A game as the MCP tools name it: 'DET @ CHA'. */
export const gameName = (game) => `${game.away.tricode} @ ${game.home.tricode}`;

/* Why a read shows nothing yet, or null once it has data. */
export const ReadNote = ({ read, loading, failed }) => {
  if (read.status === 'loading') {
    return (
      <p className="report-edit-help" role="status">
        {loading}
      </p>
    );
  }
  if (read.status === 'failed') {
    return (
      <p className="report-edit-error" role="alert">
        {failed}
      </p>
    );
  }
  return null;
};

/* A request as one string that ignores key order, so equal choices compare equal. */
const sortedKeys = (value) => {
  if (Array.isArray(value)) return value.map(sortedKeys);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, sortedKeys(value[key])]),
  );
};
export const requestKey = (request) => JSON.stringify(sortedKeys(request));

/*
 * Tells the Card pane the picker's request each time it changes, or null while
 * the choices make none, with `lacking` saying what they lack
 * (crf04/statsplus#406).
 */
export const useReportRequest = (request, onRequest, lacking = null) => {
  const latest = useRef(request);
  latest.current = request;
  const key = request ? requestKey(request) : null;
  const need = request ? null : lacking;
  useEffect(() => {
    onRequest(latest.current, need);
  }, [key, need, onRequest]);
  // A picker part that goes away takes its request with it.
  useEffect(() => () => onRequest(null), [onRequest]);
};
