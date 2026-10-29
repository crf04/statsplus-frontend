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

/* Asks the server to draw the Card for `request`; disabled until the choices make one. */
export const PreviewButton = ({ request, busy, onPreview }) => (
  <button
    type="button"
    className="report-listing-button"
    disabled={busy || !request}
    onClick={() => onPreview(request)}
  >
    {busy ? 'Drawing…' : 'Preview card'}
  </button>
);
