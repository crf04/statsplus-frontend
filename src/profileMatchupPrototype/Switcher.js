/*
 * PROTOTYPE (throwaway). Deliberately not styled like the app.
 */
import { SAMPLES, goToPlayer } from './mode';

const NAMES = {
  F: 'full MCP card',
  G: 'trimmed, market = Line Type',
  H1: 'wider bars + delta',
  H2: 'dumbbell',
  H3: 'mix strip + list',
  S1: 'one list',
  S2: 'court + one table',
  S3: 'drivers only',
};

const Switcher = ({ proto, playerName }) => (
  <div className="pmp-switcher" role="group" aria-label="Prototype switcher">
    {['S1', 'S2', 'S3', 'H1', 'H2', 'H3', 'G', 'F'].map((v) => (
      <button
        key={v}
        type="button"
        aria-pressed={proto.variant === v}
        onClick={() => proto.setVariant(v)}
      >
        {v}
      </button>
    ))}
    <span>{NAMES[proto.variant]}</span>
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
