/* PROTOTYPE — throwaway. Smaller layouts for the Log Workspace stat header. */
import { useState } from 'react';
import './proto.css';

const STATS = [
  { key: 'PTS', short: 'PTS', label: 'Points' },
  { key: 'REB', short: 'REB', label: 'Rebounds' },
  { key: 'AST', short: 'AST', label: 'Assists' },
  { key: 'STKS', short: 'STK', label: 'Stocks' },
  { key: 'MIN', short: 'MIN', label: 'Minutes' },
  { key: 'FG_PCT', short: 'FG%', label: 'FG%', pct: true },
  { key: 'FD_PTS', short: 'FPTS', label: 'Fantasy' },
  { key: 'TOV', short: 'TOV', label: 'Turnovers', lowerIsBetter: true },
];

const value = (v, pct) =>
  typeof v !== 'number' ? '--' : pct ? `${(v * 100).toFixed(1)}%` : v.toFixed(1);

// Signed difference from the season average, with a tone for colour.
const delta = (filtered, season, stat) => {
  if (typeof filtered !== 'number' || typeof season !== 'number') return { text: '', tone: '' };
  const diff = (filtered - season) * (stat.pct ? 100 : 1);
  const rounded = Number(diff.toFixed(1));
  if (rounded === 0) return { text: '±0.0', tone: 'flat' };
  const good = stat.lowerIsBetter ? rounded < 0 : rounded > 0;
  return { text: `${rounded > 0 ? '+' : ''}${rounded.toFixed(1)}`, tone: good ? 'up' : 'down' };
};

const Avatar = ({ playerId, name, size }) => {
  const [failed, setFailed] = useState(false);
  return (
    <span className="sh-avatar" style={{ width: size, height: size }}>
      {playerId && !failed ? (
        <img
          src={`https://cdn.nba.com/headshots/nba/latest/260x190/${playerId}.png`}
          alt={name}
          onError={() => setFailed(true)}
        />
      ) : (
        <span style={{ fontSize: size * 0.36 }}>
          {(name || 'PL')
            .split(' ')
            .map((n) => n[0])
            .join('')}
        </span>
      )}
    </span>
  );
};

const rows = (filtered, season) =>
  STATS.map((stat) => ({
    ...stat,
    value: value(filtered[stat.key], stat.pct),
    delta: delta(filtered[stat.key], season[stat.key], stat),
  }));

// A — one row of eight small tiles beside a small avatar.
export const VariantA = ({ filtered, season, name, playerId }) => (
  <div className="sh-a">
    <div className="sh-a-who">
      <Avatar playerId={playerId} name={name} size={44} />
      <span className="sh-name">{name}</span>
    </div>
    <div className="sh-a-tiles">
      {rows(filtered, season).map((s) => (
        <div key={s.key} className="sh-a-tile">
          <span className="sh-label">{s.short}</span>
          <span className="sh-a-value">{s.value}</span>
          <span className={`sh-delta ${s.delta.tone}`}>{s.delta.text}</span>
        </div>
      ))}
    </div>
  </div>
);

// B — a single line: name, then stats separated by hairlines. Scrolls on phone.
export const VariantB = ({ filtered, season, name, playerId }) => (
  <div className="sh-b">
    <div className="sh-b-who">
      <Avatar playerId={playerId} name={name} size={30} />
      <span className="sh-name">{name}</span>
    </div>
    <div className="sh-b-stats">
      {rows(filtered, season).map((s) => (
        <span key={s.key} className="sh-b-stat">
          <span className="sh-label">{s.short}</span>
          <strong>{s.value}</strong>
          <span className={`sh-delta ${s.delta.tone}`}>{s.delta.text}</span>
        </span>
      ))}
    </div>
  </div>
);

// C — a box-score line: label row, filtered row, vs-season row.
export const VariantC = ({ filtered, season, name, playerId }) => {
  const data = rows(filtered, season);
  return (
    <div className="sh-c">
      <div className="sh-c-who">
        <Avatar playerId={playerId} name={name} size={36} />
        <span className="sh-name">{name}</span>
      </div>
      <div className="sh-c-scroll">
        <table className="sh-c-table">
          <thead>
            <tr>
              <th aria-label="Row" />
              {data.map((s) => (
                <th key={s.key}>{s.short}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <th>Filtered</th>
              {data.map((s) => (
                <td key={s.key} className="sh-c-value">
                  {s.value}
                </td>
              ))}
            </tr>
            <tr>
              <th>vs Season</th>
              {data.map((s) => (
                <td key={s.key} className={`sh-delta ${s.delta.tone}`}>
                  {s.delta.text}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

// D — the four headline stats lead; the rest drop to small chips.
export const VariantD = ({ filtered, season, name, playerId }) => {
  const data = rows(filtered, season);
  const lead = data.filter((s) => ['PTS', 'REB', 'AST', 'MIN'].includes(s.key));
  const rest = data.filter((s) => !lead.includes(s));
  return (
    <div className="sh-d">
      <div className="sh-d-who">
        <Avatar playerId={playerId} name={name} size={52} />
        <span className="sh-name">{name}</span>
      </div>
      <div className="sh-d-body">
        <div className="sh-d-lead">
          {lead.map((s) => (
            <div key={s.key} className="sh-d-stat">
              <span className="sh-label">{s.label}</span>
              <span className="sh-d-value">{s.value}</span>
              <span className={`sh-delta ${s.delta.tone}`}>{s.delta.text} vs szn</span>
            </div>
          ))}
        </div>
        <div className="sh-d-chips">
          {rest.map((s) => (
            <span key={s.key} className="sh-d-chip">
              <span className="sh-label">{s.short}</span>
              <strong>{s.value}</strong>
              <span className={`sh-delta ${s.delta.tone}`}>{s.delta.text}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

export const PROTO_VARIANTS = { A: VariantA, B: VariantB, C: VariantC, D: VariantD };
