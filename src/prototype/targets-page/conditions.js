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

/* The editor: one defender line and one window line, each off until set. */
export function ConditionsEditor({ opponent, conditions, onChange }) {
  const team = rosterFor(opponent);
  const defender = conditions.defender;
  const setDefender = (patch) =>
    onChange({ defender: { ...(defender || { comparator: 'under', minutes: 20 }), ...patch } });
  return (
    <div className="pt-cond">
      <span className="target-label">Only games where</span>
      <div className="pt-cond-row">
        <select
          aria-label="Defender"
          className="pt-cond-who"
          value={defender ? String(defender.playerId) : ''}
          onChange={(event) => {
            if (!event.target.value) {
              onChange({ defender: null });
              return;
            }
            const row = team.players.find(([id]) => String(id) === event.target.value);
            setDefender({ playerId: row[0], name: row[1] });
          }}
        >
          <option value="">any {opponent} lineup</option>
          {(team?.players || []).map(([id, name, played, average]) => (
            <option key={id} value={id}>
              {name} · {average} min · {played} gp
            </option>
          ))}
        </select>
        {defender && (
          <>
            <span className="pt-cond-word">plays</span>
            <select
              aria-label="Minutes comparator"
              className="pt-cond-cmp"
              value={defender.comparator}
              onChange={(event) => setDefender({ comparator: event.target.value })}
            >
              <option value="under">under</option>
              <option value="at_least">at least</option>
            </select>
            <span className="pt-cond-min">
              <input
                type="range"
                min="0"
                max="42"
                step="1"
                aria-label="Minutes"
                value={defender.minutes}
                onChange={(event) => setDefender({ minutes: Number(event.target.value) })}
              />
              <b>{defender.minutes} min</b>
            </span>
          </>
        )}
      </div>
      {defender && defender.comparator === 'under' && (
        <small className="pt-cond-note">
          games {defender.name.split(' ').slice(-1)[0]} sat out count as 0 min
        </small>
      )}
      <div className="pt-cond-row">
        <span className="pt-cond-word">between</span>
        <input
          type="date"
          aria-label="From date"
          value={conditions.from}
          onChange={(event) => onChange({ from: event.target.value })}
        />
        <span className="pt-cond-word">and</span>
        <input
          type="date"
          aria-label="To date"
          value={conditions.to}
          onChange={(event) => onChange({ to: event.target.value })}
        />
        {(conditions.from || conditions.to) && (
          <button
            type="button"
            className="pt-cond-clear"
            onClick={() => onChange({ from: '', to: '' })}
          >
            whole season
          </button>
        )}
      </div>
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
