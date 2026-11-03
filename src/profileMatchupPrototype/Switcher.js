/*
 * PROTOTYPE (throwaway). Deliberately not styled like the app.
 */
import { SAMPLES, goToPlayer } from './mode';

const Switcher = ({ playerName }) => (
  <div className="pmp-switcher" role="group" aria-label="Prototype sample player">
    <span>E · MCP card port</span>
    <select
      value={playerName}
      onChange={(e) => goToPlayer(e.target.value)}
      aria-label="Sample player"
    >
      {!SAMPLES.some((s) => s.name === playerName) && (
        <option value={playerName}>{playerName}</option>
      )}
      {SAMPLES.map((s) => (
        <option key={s.name} value={s.name}>
          {s.name} vs {s.opponent}
        </option>
      ))}
    </select>
  </div>
);

export default Switcher;
