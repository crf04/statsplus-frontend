/*
 * PROTOTYPE — throwaway. See ./README.md.
 *
 * What each variant changes in the Log Workspace chart card: the numbers above
 * the chart (`Summary`), the chart's height and axes (`chartOptions`), and
 * whether the "Player: X" chip shows. The controls are restyled in proto.css.
 */
import { formatNumber, toFiniteNumber } from '../numberUtils';

const pct = (ratio) => {
  const [hit, of] = String(ratio).split('/').map(Number);
  return of ? Math.round((hit / of) * 100) : null;
};

const diff = (current, season) => {
  const now = toFiniteNumber(current, 0);
  const was = toFiniteNumber(season, 0);
  if (!was) return null;
  return ((now - was) / was) * 100;
};

const Delta = ({ value }) => {
  if (value === null || Math.abs(value) < 0.05) return <span className="ls-delta">±0%</span>;
  return (
    <span className={`ls-delta ${value > 0 ? 'is-up' : 'is-down'}`}>
      {value > 0 ? '+' : '−'}
      {formatNumber(Math.abs(value), 1)}%
    </span>
  );
};

// A: one strip of three small tiles, label above value.
const SummaryA = ({ m, lineType }) => (
  <div className="ls-a-strip">
    <div className="ls-a-tile">
      <span className="ls-k">{lineType} avg</span>
      <span className="ls-v">{formatNumber(m.rawValue, 1)}</span>
      <span className="ls-s">
        szn {formatNumber(m.seasonRawValue, 1)} <Delta value={diff(m.rawValue, m.seasonRawValue)} />
      </span>
    </div>
    <div className="ls-a-tile">
      <span className="ls-k">Per 36</span>
      <span className="ls-v">{formatNumber(m.per36Value, 1)}</span>
      <span className="ls-s">
        szn {formatNumber(m.seasonPer36Value, 1)}{' '}
        <Delta value={diff(m.per36Value, m.seasonPer36Value)} />
      </span>
    </div>
    <div className="ls-a-tile">
      <span className="ls-k">Over line</span>
      <span className="ls-v">
        {m.ratio} <small>{pct(m.ratio)}%</small>
      </span>
      <span className="ls-s">
        L5 {m.last5ratio} · L10 {m.last10ratio}
      </span>
    </div>
  </div>
);

// B: the hit rate is the headline; averages are one quiet line under it.
const SummaryB = ({ m, lineType }) => (
  <div className="ls-b-head">
    <div className="ls-b-hit">
      <span className="ls-b-big">{pct(m.ratio)}%</span>
      <span className="ls-b-of">
        over in {m.ratio.replace('/', ' of ')}
        <span className="ls-b-recent">
          L5 {m.last5ratio} · L10 {m.last10ratio}
        </span>
      </span>
    </div>
    <div className="ls-b-avgs">
      {lineType} {formatNumber(m.rawValue, 1)} avg · {formatNumber(m.per36Value, 1)} per 36
      <span className="ls-b-szn">
        season {formatNumber(m.seasonRawValue, 1)} · {formatNumber(m.seasonPer36Value, 1)}
      </span>
    </div>
  </div>
);

// C: one mono line of numbers that sits on the chart's top edge.
const SummaryC = ({ m, lineType }) => (
  <div className="ls-c-line">
    <span>
      <b>{m.ratio}</b> over · {pct(m.ratio)}%
    </span>
    <span>
      L5 <b>{m.last5ratio}</b>
    </span>
    <span>
      L10 <b>{m.last10ratio}</b>
    </span>
    <span>
      {lineType} <b>{formatNumber(m.rawValue, 1)}</b>{' '}
      <Delta value={diff(m.rawValue, m.seasonRawValue)} />
    </span>
    <span>
      /36 <b>{formatNumber(m.per36Value, 1)}</b>
    </span>
  </div>
);

// D: today's three cards, trimmed: same pieces, less padding, smaller type.
const Card = ({ title, value, from, change }) => (
  <div className="ls-d-card">
    <span className="ls-d-title">{title}</span>
    <span className="ls-d-value">
      {value} <small>from {from}</small>
    </span>
    {change !== undefined && (
      <span className="ls-d-corner">
        <Delta value={change} />
      </span>
    )}
  </div>
);

const SummaryD = ({ m, lineType }) => (
  <div className="ls-d-row">
    <Card
      title={`${lineType} avg`}
      value={formatNumber(m.rawValue, 2)}
      from={formatNumber(m.seasonRawValue, 2)}
      change={diff(m.rawValue, m.seasonRawValue)}
    />
    <Card
      title="Per-36"
      value={formatNumber(m.per36Value, 2)}
      from={formatNumber(m.seasonPer36Value, 2)}
      change={diff(m.per36Value, m.seasonPer36Value)}
    />
    <div className="ls-d-card">
      <span className="ls-d-title">Hit rate</span>
      <span className="ls-d-value">
        {m.ratio} <small>{pct(m.ratio)}%</small>
      </span>
      <span className="ls-d-corner ls-d-recent">
        L5 {m.last5ratio} · L10 {m.last10ratio}
      </span>
    </div>
  </div>
);

export const SUMMARIES = { A: SummaryA, B: SummaryB, C: SummaryC, D: SummaryD };

// The game date as M/D, the way the rest of the page writes short dates.
const shortDate = (label) => {
  const match = /^\d{4}-(\d{2})-(\d{2})/.exec(String(label));
  return match ? `${Number(match[1])}/${Number(match[2])}` : label;
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const CHART_HEIGHT = { A: 260, B: 220, C: 200, D: 360 };

/** The variant's chart options, built on top of today's. */
export const chartOptionsFor = (variant, options, labels) => {
  if (variant === 'O') return options;
  const tickFont = { family: 'ui-monospace, SF Mono, Menlo, monospace', size: 10 };
  const x = {
    ...options.scales.x,
    ticks: {
      color: '#7d7666',
      font: tickFont,
      maxRotation: 0,
      autoSkip: true,
      maxTicksLimit: variant === 'A' || variant === 'D' ? 8 : 6,
      callback(value) {
        return shortDate(this.getLabelForValue(value));
      },
    },
  };
  if (variant === 'C') {
    // A month name where the month changes; every other game unlabeled.
    x.ticks = {
      color: '#7d7666',
      font: tickFont,
      maxRotation: 0,
      autoSkip: false,
      callback(value, index) {
        const month = String(labels[index] || '').slice(5, 7);
        const before = String(labels[index - 1] || '').slice(5, 7);
        return month && month !== before ? MONTHS[Number(month) - 1] : '';
      },
    };
  }
  const y = {
    ...options.scales.y,
    title: { display: false },
    ticks: {
      ...options.scales.y.ticks,
      color: '#7d7666',
      maxTicksLimit: variant === 'A' ? 5 : variant === 'D' ? 6 : 4,
    },
    grid: { color: variant === 'C' ? 'transparent' : 'rgba(255, 255, 255, 0.05)' },
    border: { display: false },
  };
  const line = options.plugins.annotation.annotations.line1;
  return {
    ...options,
    maintainAspectRatio: false,
    scales: { x, y: variant === 'C' ? { ...y, ticks: { ...y.ticks, display: false } } : y },
    plugins: {
      ...options.plugins,
      annotation: {
        annotations: {
          line1: {
            ...line,
            label: {
              ...line.label,
              position: variant === 'A' || variant === 'D' ? 'start' : 'end',
              padding: 4,
              font: { ...line.label.font, size: 10 },
            },
          },
        },
      },
    },
  };
};
