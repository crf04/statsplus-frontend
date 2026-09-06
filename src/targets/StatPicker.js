import { useState } from 'react';
import { STAT_GROUPS } from './statValues';

export default function StatPicker({ columns, gradedBy, onChange }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="target-stat-picker">
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)}>
        stats ▾
      </button>
      {open && (
        <div className="target-stat-options" aria-label="Stats picker" role="group">
          {Object.entries(STAT_GROUPS).map(([group, keys]) => (
            <fieldset key={group}>
              <legend>{group}</legend>
              {keys.map((key) => (
                <label key={key}>
                  <input
                    type="checkbox"
                    checked={columns.includes(key)}
                    disabled={columns.length === 1 && columns.includes(key)}
                    onChange={() => {
                      const next = columns.includes(key)
                        ? columns.filter((column) => column !== key)
                        : [...columns, key];
                      onChange({
                        columns: next,
                        gradedBy: next.includes(gradedBy) ? gradedBy : next[0],
                      });
                    }}
                  />
                  {key}
                </label>
              ))}
            </fieldset>
          ))}
        </div>
      )}
    </div>
  );
}

export function StatSaveStatus({ state }) {
  return state.error ? (
    <p role="alert">
      {state.error}{' '}
      <button type="button" onClick={state.retry}>
        Retry saving stats
      </button>
    </p>
  ) : state.status === 'pending' || state.status === 'saving' ? (
    <p className="target-stat-save">Saving stats…</p>
  ) : null;
}
