/*
 * PROTOTYPE — throwaway. See ./README.md.
 *
 * Conditions: which of the opponent's games count. Two kinds for now — a
 * defender's minutes ("when Gobert plays under 20 min", where a game he sat
 * out is 0 minutes and counts) and a date window. They filter the Backtest's
 * games on the client, so the Lab answers them the way it answers a
 * threshold. Shipping them means the backtest read taking them as input.
 *
 * The minutes come from a capture of every team's game logs for the season;
 * a signed-in build has no such read yet.
 */
import { useState } from 'react';
import rosters from './mock/rosters.json';

export const blankConditions = () => ({ defender: null, from: '', to: '' });

export const rosterFor = (tricode) => rosters.teams[tricode] || null;

/* Minutes a defender played on a date; a game his team played without him
   is 0, and a date his team did not play at all is null. */
export const defenderMinutes = (tricode, date, playerId) => {
  const team = rosterFor(tricode);
  const game = team?.games[date];
  if (!game) return null;
  const line = game.find(([id]) => id === playerId);
  return line ? line[1] : 0;
};

const withinWindow = (date, from, to) => (!from || date >= from) && (!to || date <= to);

const passesDefender = (tricode, date, defender) => {
  if (!defender) return true;
  const minutes = defenderMinutes(tricode, date, defender.playerId);
  if (minutes === null) return true;
  return defender.comparator === 'under' ? minutes < defender.minutes : minutes >= defender.minutes;
};

export const conditionsActive = (conditions) =>
  Boolean(conditions && (conditions.defender || conditions.from || conditions.to));

/* The Backtest with only the games the Conditions allow. Players with no
   game left are dropped; the summary is left for the caller to recompute. */
export const applyConditions = (backtest, conditions) => {
  if (!backtest || !conditionsActive(conditions)) return backtest;
  const tricode = backtest.target.opponent;
  const players = backtest.players
    .map((player) => ({
      ...player,
      games: player.games.filter(
        (game) =>
          withinWindow(game.gameDate, conditions.from, conditions.to) &&
          passesDefender(tricode, game.gameDate, conditions.defender),
      ),
    }))
    .filter((player) => player.games.length > 0);
  return { ...backtest, players };
};

/* How many of the opponent's games the Conditions keep, for the line under
   the summary: "Gobert under 20 min · 9 of 78 games". */
export const describeConditions = (tricode, conditions) => {
  if (!conditionsActive(conditions)) return null;
  const team = rosterFor(tricode);
  const dates = team ? Object.keys(team.games).sort() : [];
  const kept = dates.filter(
    (date) =>
      withinWindow(date, conditions.from, conditions.to) &&
      passesDefender(tricode, date, conditions.defender),
  );
  const parts = [];
  if (conditions.defender) {
    const sat = kept.filter(
      (date) => defenderMinutes(tricode, date, conditions.defender.playerId) === 0,
    ).length;
    parts.push(
      `${conditions.defender.name} ${conditions.defender.comparator === 'under' ? 'under' : 'at least'} ${conditions.defender.minutes} min` +
        (conditions.defender.comparator === 'under' && sat ? ` (${sat} sat out)` : ''),
    );
  }
  if (conditions.from || conditions.to) {
    parts.push(`${conditions.from || 'season start'} → ${conditions.to || 'now'}`);
  }
  return { text: parts.join(' · '), kept: kept.length, total: dates.length };
};

const PRESETS = [
  ['', 'Whole season'],
  ['2026-01-01', 'Since Jan 1'],
  ['2026-02-01', 'Since Feb 1'],
  ['2026-03-01', 'Since Mar 1'],
  ['custom', 'Custom dates'],
];

/*
 * The editor, drawn the way a Qualifier is drawn: a row per Condition with a
 * quiet label and a loud pick on the first line, the bound on the second,
 * and the card's own "+ and" to add one. A Condition not yet added is not a
 * row, so the card reads as exactly what it filters by.
 */
export function ConditionsEditor({ opponent, conditions, onChange, addSlot = null }) {
  const team = rosterFor(opponent);
  const defender = conditions.defender;
  const [windowOpen, setWindowOpen] = useState(false);
  const hasWindow = windowOpen || Boolean(conditions.from || conditions.to);
  const setDefender = (patch) =>
    onChange({ defender: { ...(defender || { comparator: 'under', minutes: 20 }), ...patch } });
  const preset =
    PRESETS.some(([value]) => value === conditions.from) && !conditions.to
      ? conditions.from
      : 'custom';
  const under = !defender || defender.comparator === 'under';
  return (
    <div className="pt-cond">
      {defender && (
        <div className="pt-qualifier is-slider is-cond">
          <div className="pt-q-slice">
            <span className="pt-q-base is-static">Defender</span>
            <select
              aria-label="Defender"
              className="pt-q-key"
              value={String(defender.playerId)}
              onChange={(event) => {
                const row = team.players.find(([id]) => String(id) === event.target.value);
                setDefender({ playerId: row[0], name: row[1] });
              }}
            >
              {(team?.players || []).map(([id, name, played, average]) => (
                <option key={id} value={id}>
                  {name} · {average} min · {played} gp
                </option>
              ))}
            </select>
            <button
              type="button"
              className="pt-remove"
              aria-label="Remove the defender Condition"
              onClick={() => onChange({ defender: null })}
            >
              ×
            </button>
          </div>
          <div className="pt-q-slider">
            <button
              type="button"
              className="pt-q-flip is-word"
              aria-label={under ? 'Under; press for at least' : 'At least; press for under'}
              onClick={() => setDefender({ comparator: under ? 'at_least' : 'under' })}
            >
              {under ? 'under' : 'at least'}
            </button>
            <span className="pt-q-range">
              <i
                className="pt-q-fill"
                style={
                  under
                    ? { left: 0, width: `${(defender.minutes / 42) * 100}%` }
                    : { left: `${(defender.minutes / 42) * 100}%`, right: 0 }
                }
              />
              <input
                type="range"
                min="0"
                max="42"
                step="1"
                aria-label="Minutes"
                value={defender.minutes}
                onChange={(event) => setDefender({ minutes: Number(event.target.value) })}
              />
              <b className="pt-q-value" style={{ left: `${(defender.minutes / 42) * 100}%` }}>
                {defender.minutes} min
              </b>
            </span>
            <span className="pt-q-unit">{under ? 'incl. sat out' : 'on the floor'}</span>
          </div>
        </div>
      )}
      {hasWindow && (
        <div className="pt-qualifier is-slider is-cond">
          <div className="pt-q-slice">
            <span className="pt-q-base is-static">Window</span>
            <select
              aria-label="Date window"
              className="pt-q-key"
              value={preset}
              onChange={(event) => {
                if (event.target.value === 'custom') {
                  setWindowOpen(true);
                  return;
                }
                onChange({ from: event.target.value, to: '' });
              }}
            >
              {PRESETS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="pt-remove"
              aria-label="Remove the date window"
              onClick={() => {
                setWindowOpen(false);
                onChange({ from: '', to: '' });
              }}
            >
              ×
            </button>
          </div>
          <div className="pt-cond-dates">
            <input
              type="date"
              aria-label="From date"
              value={conditions.from}
              onChange={(event) => onChange({ from: event.target.value })}
            />
            <span className="pt-q-unit">to</span>
            <input
              type="date"
              aria-label="To date"
              value={conditions.to}
              onChange={(event) => onChange({ to: event.target.value })}
            />
          </div>
        </div>
      )}
      {addSlot &&
        addSlot({
          canDefender: !defender,
          canWindow: !hasWindow,
          addDefender: () => {
            const [id, name] = team?.players[0] || [];
            if (id) setDefender({ playerId: id, name });
          },
          addWindow: () => setWindowOpen(true),
        })}
    </div>
  );
}

export function ConditionChips({ opponent, conditions }) {
  const described = describeConditions(opponent, conditions);
  if (!described) return null;
  return (
    <span className="pt-cond-chip">
      {described.text}
      <small>
        {described.kept} of {described.total} games
      </small>
    </span>
  );
}
