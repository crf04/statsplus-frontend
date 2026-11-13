/* PROTOTYPE — throwaway. Round 2: three takes on D, the picked-game strip. */
import { formatNumber } from '../numberUtils';
import { BOX, signed } from './gameFacts';
import { Delta, RankMeter, Verdict, tone } from './Cards';
import './proto.css';

const Nav = ({ f, index, total, onStep, compact }) => (
  <div className={`hv-nav ${compact ? 'is-compact' : ''}`}>
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
        {f.where} <b className="hv-text">{f.opponent}</b>
        {!compact && ` · ${index + 1} of ${total}`}
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
);

const Hero = ({ f }) => (
  <div className="hv-hero2">
    <span className={`hv-big ${f.line ? tone(f.line.over) : ''}`}>{formatNumber(f.value, 0)}</span>
    <span className="hv-big-stat">{f.stat}</span>
  </div>
);

// Box-line stats the drivers do not already show.
const restOfBox = (f, log, lineType) => {
  const shown = new Set(f.drivers.map((d) => d.label));
  return BOX.filter(([key, label]) => key !== lineType && !shown.has(label) && !shown.has(key)).map(
    ([key, label]) => ({ label, value: formatNumber(Number(log?.[key]) || 0, 0) }),
  );
};

/** E — two rows: the result, its lines and the opponent; then the drivers vs his average. */
export const StripDetail = ({ f, log, lineType, index, total, onStep }) => (
  <div className="hv-e">
    <div className="hv-e-top">
      <Nav f={f} index={index} total={total} onStep={onStep} />
      <div className="hv-e-result">
        <Hero f={f} />
        <div className="hv-e-pills">
          {f.closing && (
            <span>
              <Verdict margin={f.closing.margin} over={f.closing.over} against="close" />
              <small>
                {formatNumber(f.closing.value, 1)} {f.closing.book}
              </small>
            </span>
          )}
          {f.line && (
            <span>
              <Verdict margin={f.line.margin} over={f.line.over} against={f.line.source} />
              <small>{formatNumber(f.line.value, 1)}</small>
            </span>
          )}
        </div>
      </div>
      {f.rank && (
        <div className="hv-e-rank">
          <RankMeter rank={f.rank} opponent={f.opponent} stat={f.stat} />
        </div>
      )}
    </div>
    <div className="hv-e-bottom">
      {f.drivers.map((d) => (
        <div key={d.label} className="hv-cell">
          <span className="hv-k">{d.label}</span>
          <span className="hv-v">
            {d.text}
            {d.sub && <small> {d.sub}</small>}
          </span>
          <Delta value={d.value} avg={d.avg} unit={d.unit} />
        </div>
      ))}
      <span className="hv-e-sep" />
      {restOfBox(f, log, lineType).map((b) => (
        <div key={b.label} className="hv-cell is-quiet">
          <span className="hv-k">{b.label}</span>
          <span className="hv-v">{b.value}</span>
        </div>
      ))}
    </div>
    <div className="hv-foot">
      ▲▼ vs his average in these games · tap or hover a bar to pick a game
    </div>
  </div>
);

/** F — one compact bar above the chart, so a phone sees it while tapping bars. */
export const StripHeader = ({ f, index, total, onStep }) => (
  <div className="hv-f">
    <Nav f={f} index={index} total={total} onStep={onStep} compact />
    <div className="hv-f-body">
      <div className="hv-f-line">
        <Hero f={f} />
        {f.closing && (
          <span>
            closed {formatNumber(f.closing.value, 1)}{' '}
            <b className={`hv-delta ${f.closing.over ? 'up' : 'down'}`}>
              {signed(f.closing.margin)}
            </b>
          </span>
        )}
        {f.line && (
          <span>
            {f.line.source} {formatNumber(f.line.value, 1)}{' '}
            <b className={`hv-delta ${f.line.over ? 'up' : 'down'}`}>{signed(f.line.margin)}</b>
          </span>
        )}
        {f.rank && (
          <span className={`hv-chip is-${f.rank.tone}`}>
            {f.opponent} {f.rank.text} {f.stat} allowed
          </span>
        )}
      </div>
      <div className="hv-f-line hv-f-drivers">
        {f.drivers.map((d) => (
          <span key={d.label}>
            {d.label} <b className="hv-text">{d.text}</b>{' '}
            <Delta value={d.value} avg={d.avg} unit={d.unit} />
          </span>
        ))}
      </div>
    </div>
  </div>
);

/** G — a scoreboard: each stat a column, this game big, his average and the gap under it. */
export const StripScoreboard = ({ f, index, total, onStep }) => {
  const columns = [
    { label: f.stat, text: formatNumber(f.value, 0), value: f.value, avg: f.statAvg, main: true },
    ...f.drivers.map((d) => ({ ...d, text: d.text })),
  ];
  return (
    <div className="hv-g">
      <div className="hv-g-head">
        <Nav f={f} index={index} total={total} onStep={onStep} />
        {f.closing && (
          <div className="hv-g-close">
            <span className="hv-k">Closing line</span>
            <span>
              <b className="hv-text">{formatNumber(f.closing.value, 1)}</b> {f.closing.book}{' '}
              <b className={`hv-delta ${f.closing.over ? 'up' : 'down'}`}>
                {f.closing.over ? 'beat' : 'missed'} by{' '}
                {formatNumber(Math.abs(f.closing.margin), 1)}
              </b>
            </span>
          </div>
        )}
        {f.rank && (
          <div className="hv-g-close">
            <span className="hv-k">Opponent</span>
            <span>
              <span className={`hv-chip is-${f.rank.tone}`}>{f.rank.text}</span> in{' '}
              {f.rank.label.toLowerCase()}
            </span>
          </div>
        )}
      </div>
      <div className="hv-g-board">
        {columns.map((c) => (
          <div key={c.label} className={`hv-g-col ${c.main ? 'is-main' : ''}`}>
            <span className="hv-k">{c.label}</span>
            <span className={`hv-g-val ${c.main && f.line ? tone(f.line.over) : ''}`}>
              {c.text}
            </span>
            {c.sub && <span className="hv-dim">{c.sub}</span>}
            <span className="hv-dim">
              avg{' '}
              {c.avgText ?? (c.avg === null || c.avg === undefined ? '—' : formatNumber(c.avg, 1))}
            </span>
            <Delta value={c.value} avg={c.avg} unit={c.unit} />
          </div>
        ))}
      </div>
    </div>
  );
};
