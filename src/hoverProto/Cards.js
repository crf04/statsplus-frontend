/* PROTOTYPE — throwaway. The HTML hover cards for variants B, C and D. */
import { useLayoutEffect, useRef, useState } from 'react';
import { formatNumber } from '../numberUtils';
import { BOX, signed, statName } from './gameFacts';
import './proto.css';

export const tone = (over) => (over ? 'is-over' : 'is-under');

export const Verdict = ({ margin, over, against }) => (
  <span className={`hv-pill ${tone(over)}`}>
    {over ? 'Over' : 'Under'} {against} {signed(margin)}
  </span>
);

export const RankMeter = ({ rank, opponent, stat }) => (
  <div className={`hv-rank is-${rank.tone}`}>
    <div className="hv-rank-text">
      <b>{opponent}</b> {rank.text} of 30 in {rank.label.toLowerCase()}
    </div>
    <div className="hv-rank-track" aria-hidden="true">
      <span style={{ left: `${((rank.rank - 1) / 29) * 100}%` }} />
    </div>
    <div className="hv-rank-ends">
      <span>allows fewest {stat}</span>
      <span>most</span>
    </div>
  </div>
);

export const Delta = ({ value, avg, unit }) => {
  if (avg === null || avg === undefined) return null;
  const d = value - avg;
  if (Math.abs(d) < 0.05) return <span className="hv-delta">=</span>;
  return (
    <span className={`hv-delta ${d > 0 ? 'up' : 'down'}`}>
      {d > 0 ? '▲' : '▼'}
      {formatNumber(Math.abs(d), 1)}
      {unit ? ` ${unit}` : ''}
    </span>
  );
};

/** Floating wrapper: beside the hovered bar, kept inside the chart. */
export const Floating = ({ tip, width, children }) => {
  const ref = useRef(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (el && (el.offsetWidth !== size.w || el.offsetHeight !== size.h))
      setSize({ w: el.offsetWidth, h: el.offsetHeight });
  });
  if (!tip) return null;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(v, hi));
  const right = tip.x > width / 2;
  const beside = right ? tip.x - 14 - size.w : tip.x + 14;
  const left = clamp(beside, 4, width - size.w - 4);
  const top = clamp(tip.y - 30, 4, tip.height - size.h - 4);
  return (
    <div
      ref={ref}
      className="hv-float"
      style={{ left, top, visibility: size.w ? 'visible' : 'hidden' }}
    >
      {children}
    </div>
  );
};

/** B — a small card: the result first, then the lines, the opponent, the drivers. */
export const MiniCard = ({ f }) => (
  <div className="hv-card hv-mini">
    <div className="hv-head">
      <span>{f.date}</span>
      <span>
        {f.where} <b>{f.opponent}</b>
      </span>
    </div>
    <div className="hv-hero">
      <span className={`hv-big ${f.closing ? tone(f.closing.over) : ''}`}>
        {formatNumber(f.value, 0)}
      </span>
      <span className="hv-big-stat">{f.stat}</span>
      {f.closing ? (
        <Verdict margin={f.closing.margin} over={f.closing.over} against="close" />
      ) : f.line ? (
        <Verdict margin={f.line.margin} over={f.line.over} against="line" />
      ) : null}
    </div>
    <div className="hv-lines">
      {f.closing && (
        <span>
          Closed <b>{formatNumber(f.closing.value, 1)}</b> {f.closing.book}
        </span>
      )}
      {f.line && (
        <span>
          {f.line.source} <b>{formatNumber(f.line.value, 1)}</b> {signed(f.line.margin)}
        </span>
      )}
    </div>
    {f.rank && <RankMeter rank={f.rank} opponent={f.opponent} stat={f.stat} />}
    <div className="hv-grid">
      {f.drivers.map((d) => (
        <div key={d.label}>
          <span className="hv-k">{d.label}</span>
          <span className="hv-v">
            {d.text}
            {d.sub && <small> {d.sub}</small>}
          </span>
          <Delta value={d.value} avg={d.avg} unit={d.unit} />
        </div>
      ))}
    </div>
    <div className="hv-foot">▲▼ vs his average in these games</div>
  </div>
);

/** C — this game beside his average, row by row, with the biggest swing named. */
export const VersusCard = ({ f }) => {
  const rows = [
    { label: f.stat, text: formatNumber(f.value, 0), value: f.value, avg: f.statAvg, main: true },
    ...f.drivers.map((d) => ({
      label: d.label,
      text: d.sub ? `${d.text} (${d.sub})` : d.text,
      value: d.value,
      avg: d.avg,
      avgText: d.avgText,
      unit: d.unit,
    })),
  ];
  const swing = f.drivers
    .filter((d) => d.avg)
    .map((d) => ({ ...d, rel: (d.value - d.avg) / d.avg }))
    .sort((a, b) => Math.abs(b.rel) - Math.abs(a.rel))[0];
  return (
    <div className="hv-card hv-versus">
      <div className="hv-head">
        <span>
          {f.date} · {f.where} <b>{f.opponent}</b>
        </span>
        {f.rank && (
          <span className={`hv-chip is-${f.rank.tone}`}>
            {f.rank.text} {f.stat} allowed
          </span>
        )}
      </div>
      <table>
        <thead>
          <tr>
            <th />
            <th>Game</th>
            <th>Avg</th>
            <th>Δ</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className={r.main ? 'is-main' : ''}>
              <th>{r.label}</th>
              <td>{r.text}</td>
              <td>{r.avgText ?? (r.avg === null ? '—' : formatNumber(r.avg, 1))}</td>
              <td>
                <Delta value={r.value} avg={r.avg} unit={r.unit} />
              </td>
            </tr>
          ))}
          {f.closing && (
            <tr className="is-line">
              <th>Closed</th>
              <td>{formatNumber(f.closing.value, 1)}</td>
              <td className="hv-dim">{f.closing.book}</td>
              <td>
                <span className={`hv-delta ${f.closing.over ? 'up' : 'down'}`}>
                  {signed(f.closing.margin)}
                </span>
              </td>
            </tr>
          )}
        </tbody>
      </table>
      {swing && Math.abs(swing.rel) >= 0.1 && (
        <div className="hv-foot">
          Biggest swing: <b>{swing.label}</b> {swing.rel > 0 ? 'up' : 'down'}{' '}
          {Math.round(Math.abs(swing.rel) * 100)}% on his average
        </div>
      )}
    </div>
  );
};

/** D — a strip under the chart; hovering or tapping a bar picks the game. */
export const GameStrip = ({ f, log, lineType, index, total, onStep }) => (
  <div className="hv-strip">
    <div className="hv-strip-nav">
      <button
        type="button"
        onClick={() => onStep(-1)}
        disabled={index <= 0}
        aria-label="Previous game"
      >
        ‹
      </button>
      <div>
        <div className="hv-strip-date">{f.date}</div>
        <div className="hv-dim">
          {f.where} <b className="hv-text">{f.opponent}</b> · game {index + 1} of {total}
        </div>
      </div>
      <button
        type="button"
        onClick={() => onStep(1)}
        disabled={index >= total - 1}
        aria-label="Next game"
      >
        ›
      </button>
    </div>
    <div className="hv-strip-result">
      <span className={`hv-big ${f.closing ? tone(f.closing.over) : ''}`}>
        {formatNumber(f.value, 0)}
      </span>
      <span className="hv-big-stat">{f.stat}</span>
      <div className="hv-strip-lines">
        {f.closing && (
          <div>
            Closed {formatNumber(f.closing.value, 1)} {f.closing.book}{' '}
            <span className={`hv-delta ${f.closing.over ? 'up' : 'down'}`}>
              {signed(f.closing.margin)}
            </span>
          </div>
        )}
        {f.line && (
          <div>
            {f.line.source} {formatNumber(f.line.value, 1)}{' '}
            <span className={`hv-delta ${f.line.over ? 'up' : 'down'}`}>
              {signed(f.line.margin)}
            </span>
          </div>
        )}
        {f.rank && (
          <div>
            {f.opponent} <span className={`hv-chip is-${f.rank.tone}`}>{f.rank.text}</span> {f.stat}{' '}
            allowed
          </div>
        )}
      </div>
    </div>
    <div className="hv-strip-box">
      {BOX.map(([key, label]) => (
        <div key={key} className={key === lineType ? 'is-main' : ''}>
          <span className="hv-k">{label}</span>
          <span className="hv-v">{formatNumber(Number(log?.[key]) || 0, 0)}</span>
        </div>
      ))}
      {f.drivers
        .filter(
          (d) => d.sub || d.label === 'USG' || d.label === 'Chances' || d.label === 'Potential',
        )
        .map((d) => (
          <div key={d.label}>
            <span className="hv-k">{d.label}</span>
            <span className="hv-v">{d.text}</span>
          </div>
        ))}
    </div>
  </div>
);

export { statName };
