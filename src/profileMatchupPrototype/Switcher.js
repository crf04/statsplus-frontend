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
  S4: 'S2 list + coloured court',
};

const Switcher = ({ proto, playerName }) => (
  <div className="pmp-switcher" role="group" aria-label="Prototype switcher">
    {['S4', 'S1', 'S2', 'S3', 'H1', 'H2', 'H3', 'G', 'F'].map((v) => (
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
    {proto.variant === 'S4' &&
      ['W3', 'W', 'W2', 'C1', 'C2', 'C3'].map((c) => (
        <button
          key={c}
          type="button"
          aria-pressed={proto.combo === c}
          onClick={() => proto.setCombo(c)}
          title="Combo market treatment"
        >
          {c}
        </button>
      ))}
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
