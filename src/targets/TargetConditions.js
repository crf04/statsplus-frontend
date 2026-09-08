import { useState } from 'react';
import { isCalendarDate } from '../calendarDate';
import { useSeasonMinutes } from './useTargets';
import { useBacktestSample } from './backtestSample';

// The track's first stop, left of every real floor, meaning no floor at all.
const NO_FLOOR = -1;
const FLOOR_CEILING = 48;

export const emptyConditions = () => ({
  defender: null,
  from: null,
  to: null,
  playerMinutes: null,
});
export const normalizeConditions = (conditions) => {
  if (!conditions) return null;
  const normalized = {
    defender: conditions.defender,
    from: conditions.from || null,
    to: conditions.to || null,
  };
  if (conditions.playerMinutes !== null && conditions.playerMinutes !== undefined)
    normalized.playerMinutes = conditions.playerMinutes;
  return normalized.defender ||
    normalized.from ||
    normalized.to ||
    normalized.playerMinutes !== undefined
    ? normalized
    : null;
};
export const validConditions = (conditions) => {
  if (!conditions) return true;
  const { defender, from, to, playerMinutes } = conditions;
  return (
    (!defender ||
      (Number.isInteger(defender.playerId) &&
        defender.playerId > 0 &&
        ['under', 'at_least'].includes(defender.comparator) &&
        typeof defender.minutes === 'number' &&
        Number.isFinite(defender.minutes) &&
        defender.minutes >= 0 &&
        defender.minutes <= 48)) &&
    (playerMinutes === null ||
      playerMinutes === undefined ||
      (Number.isInteger(playerMinutes) && playerMinutes >= 0 && playerMinutes <= 48)) &&
    (!from || isCalendarDate(from)) &&
    (!to || isCalendarDate(to)) &&
    (!from || !to || from <= to)
  );
};

export function TargetAddMenu({ conditions, onQualifier, onChange }) {
  const [open, setOpen] = useState(false);
  const hasWindow = conditions && (conditions.from !== null || conditions.to !== null);
  const choose = (callback) => {
    callback();
    setOpen(false);
  };
  return (
    <div className="target-add-menu">
      <button
        type="button"
        className="target-add"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        + and
      </button>
      {open && (
        <div className="target-add-options">
          <button type="button" onClick={() => choose(onQualifier)}>
            a Qualifier
          </button>
          {!conditions?.defender && (
            <button
              type="button"
              onClick={() =>
                choose(() =>
                  onChange({
                    ...emptyConditions(),
                    ...conditions,
                    defender: { playerId: null, comparator: 'under', minutes: 10 },
                  }),
                )
              }
            >
              a defender’s minutes
            </button>
          )}
          {!hasWindow && (
            <button
              type="button"
              onClick={() =>
                choose(() => onChange({ ...emptyConditions(), ...conditions, from: '', to: '' }))
              }
            >
              a date window
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function TargetConditionRows({ opponent, conditions, onChange }) {
  const needsRoster =
    conditions && (conditions.defender || conditions.from !== null || conditions.to !== null);
  const roster = useSeasonMinutes(needsRoster ? opponent : null);
  const [customWindow, setCustomWindow] = useState(false);
  if (!conditions) return null;
  const patch = (change) => onChange({ ...conditions, ...change });
  const defender = conditions.defender;
  const hasWindow = conditions.from !== null || conditions.to !== null;
  const endYear = roster.season ? Number(roster.season.slice(0, 4)) + 1 : null;
  const preset = conditions.to
    ? 'custom'
    : !conditions.from
      ? 'whole'
      : ['01', '02', '03'].find((month) => conditions.from === `${endYear}-${month}-01`) ||
        'custom';
  return (
    <>
      {defender && (
        <div className="target-condition">
          <div className="target-condition-head">
            <span className="target-label">Defender</span>
            <select
              aria-label="Defender"
              value={defender.playerId ?? ''}
              onChange={(event) =>
                patch({
                  defender: {
                    ...defender,
                    playerId: event.target.value ? Number(event.target.value) : null,
                  },
                })
              }
            >
              <option value="">Choose a defender</option>
              {defender.playerId &&
                !roster.players.some((player) => player.playerId === defender.playerId) && (
                  <option value={defender.playerId}>
                    Player {defender.playerId} · roster unavailable
                  </option>
                )}
              {roster.players.map((player) => (
                <option key={player.playerId} value={player.playerId}>
                  {player.name} · {player.averageMinutes.toFixed(1)} min · {player.gamesPlayed}{' '}
                  games
                </option>
              ))}
            </select>
            <button
              type="button"
              className="target-remove"
              aria-label="Remove defender Condition"
              onClick={() => patch({ defender: null })}
            >
              ×
            </button>
          </div>
          {roster.status === 'loading' && <p role="status">Loading {opponent} roster…</p>}
          {roster.status === 'error' && (
            <p role="alert">
              {roster.error}{' '}
              <button type="button" onClick={roster.reload}>
                Retry roster
              </button>
            </p>
          )}
          {roster.status === 'ready' && !roster.players.length && (
            <p>No season roster available for {opponent}.</p>
          )}
          <div
            className={`target-slider-row ${defender.comparator === 'under' ? 'is-at-or-below' : 'is-at-or-above'}`}
          >
            <button
              type="button"
              className="target-comparator-toggle"
              aria-label={
                defender.comparator === 'under'
                  ? 'Under; switch to at least'
                  : 'At least; switch to under'
              }
              onClick={() =>
                patch({
                  defender: {
                    ...defender,
                    comparator: defender.comparator === 'under' ? 'at_least' : 'under',
                  },
                })
              }
            >
              {defender.comparator === 'under' ? 'under' : 'at least'}
            </button>
            <div
              className="target-slider-track"
              style={{
                '--threshold-position': `${(defender.minutes / Math.max(42, defender.minutes)) * 100}%`,
              }}
            >
              <output className="target-slider-value">{defender.minutes} min</output>
              <input
                type="range"
                min="0"
                max={Math.max(42, defender.minutes)}
                step="1"
                value={defender.minutes}
                aria-label="Defender minutes"
                onChange={(event) =>
                  patch({ defender: { ...defender, minutes: Number(event.target.value) } })
                }
              />
            </div>
            <small className="target-slider-unit">
              {defender.comparator === 'under' ? 'incl. sat out' : 'on the floor'}
            </small>
          </div>
          <small>Games he sat out count as 0 min.</small>
        </div>
      )}
      {hasWindow && (
        <div className="target-condition">
          {roster.status === 'error' && !defender && (
            <p role="alert">
              {roster.error}{' '}
              <button type="button" onClick={roster.reload}>
                Retry roster
              </button>
            </p>
          )}
          <div className="target-condition-head">
            <span className="target-label">Window</span>
            <select
              aria-label="Window preset"
              value={customWindow ? 'custom' : preset}
              onChange={(event) => {
                const value = event.target.value;
                setCustomWindow(value === 'custom');
                if (value === 'whole') patch({ from: '', to: '' });
                else if (value === 'custom')
                  patch({ from: conditions.from || '', to: conditions.to || '' });
                else patch({ from: `${endYear}-${value}-01`, to: '' });
              }}
            >
              <option value="whole">Whole season</option>
              <option value="01" disabled={!endYear}>
                Since Jan 1
              </option>
              <option value="02" disabled={!endYear}>
                Since Feb 1
              </option>
              <option value="03" disabled={!endYear}>
                Since Mar 1
              </option>
              <option value="custom">Custom dates</option>
            </select>
            <button
              type="button"
              className="target-remove"
              aria-label="Remove window Condition"
              onClick={() => patch({ from: null, to: null })}
            >
              ×
            </button>
          </div>
          <div className="target-date-window">
            <label>
              From
              <input
                type="date"
                value={conditions.from || ''}
                onChange={(event) => {
                  setCustomWindow(true);
                  patch({ from: event.target.value });
                }}
              />
            </label>
            <label>
              Through
              <input
                type="date"
                value={conditions.to || ''}
                onChange={(event) => {
                  setCustomWindow(true);
                  patch({ to: event.target.value });
                }}
              />
            </label>
          </div>
          {!endYear && (
            <small>Season presets become available when the roster read returns its season.</small>
          )}
        </div>
      )}
    </>
  );
}

/*
 * The Backtest section. The Qualifiers and Conditions above say which opponent
 * games a Target is read against; this says which of the player's appearances
 * in those games count. It is always on screen because it always applies —
 * empty simply means no floor, which is the answer for most Targets.
 */
export function TargetBacktestRows({ conditions, onChange }) {
  const playerMinutes = conditions?.playerMinutes ?? null;
  const sample = useBacktestSample();
  /*
   * The floor is only ever a minimum, so the track needs no comparator to flip
   * and no upper handle. Its first stop is left of zero and means no floor at
   * all, which keeps that apart from a floor of zero — the one that drops the
   * games a player was listed for but did not play.
   */
  const position = playerMinutes ?? NO_FLOOR;
  return (
    <div className="target-minutes-row">
      <span className="target-minutes-mark" aria-hidden="true">
        &gt;
      </span>
      <div
        className="target-slider-track"
        style={{
          '--threshold-position': `${((position - NO_FLOOR) / (FLOOR_CEILING - NO_FLOOR)) * 100}%`,
        }}
      >
        <output className="target-slider-value">
          {playerMinutes === null ? 'any' : `${playerMinutes} min`}
        </output>
        <input
          type="range"
          min={NO_FLOOR}
          max={FLOOR_CEILING}
          step="1"
          aria-label="Player game minutes"
          aria-valuetext={playerMinutes === null ? 'any' : `over ${playerMinutes} minutes`}
          value={position}
          onChange={(event) => {
            const value = Number(event.target.value);
            onChange({
              ...emptyConditions(),
              ...conditions,
              playerMinutes: value === NO_FLOOR ? null : value,
            });
          }}
        />
      </div>
      <small className="target-slider-unit">per game</small>
      {sample?.appearances !== null && sample?.appearances !== undefined && (
        <small className={`target-minutes-kept${sample.stale ? ' is-stale' : ''}`}>
          {sample.appearances} appearances kept
        </small>
      )}
    </div>
  );
}

/*
 * The minutes floor scopes which appearances the Backtest counts rather than
 * describing the Target itself, so it reads as a note on the Backtest line and
 * stays out of the Condition chip.
 */
export const backtestMinutesNote = (target) => {
  const playerMinutes = normalizeConditions(target.conditions)?.playerMinutes;
  return playerMinutes === null || playerMinutes === undefined
    ? null
    : `excludes games ≤ ${playerMinutes} min`;
};

export function TargetConditionSummary({ target }) {
  const conditions = normalizeConditions(target.conditions);
  const roster = useSeasonMinutes(conditions?.defender ? target.opponent : null);
  if (!conditions) return null;
  const { defender, from, to } = conditions;
  const player = roster.players.find((player) => player.playerId === defender?.playerId);
  // Each Condition reads as a name and the threshold it holds to, so the card
  // can set the threshold apart the way a Qualifier's share is set apart.
  const parts = [
    defender && {
      label: `${player?.name || `Player ${defender.playerId}`} ${defender.comparator === 'under' ? 'under' : 'at least'}`,
      value: `${defender.minutes} min`,
      tail: ' (sat out = 0)',
    },
    from && { label: 'from', value: from, tail: '' },
    to && { label: 'through', value: to, tail: '' },
  ].filter(Boolean);
  if (parts.length === 0) return null;
  return (
    <p className="target-condition-chip">
      {parts.map((part) => (
        <span key={part.label}>
          {part.label} <b>{part.value}</b>
          {part.tail}
        </span>
      ))}
    </p>
  );
}
