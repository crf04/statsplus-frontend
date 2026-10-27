import { formatNumber, toFiniteNumber } from './numberUtils';
import './MetricsDashboardRow.css';

// The filtered value against the season value, in percent; null when the
// season value is zero and the filtered one is not.
const changeFrom = (current, previous) => {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / previous) * 100;
};

const ChangePill = ({ change }) => {
  if (change === null) return <span className="metric-change">—</span>;
  // Rounded by size, so −6.25% reads −6.3% just as +6.25% reads +6.3%.
  const size = Math.round(Math.abs(change) * 10) / 10;
  if (size === 0) return <span className="metric-change">±0%</span>;
  return (
    <span className={`metric-change ${change > 0 ? 'is-up' : 'is-down'}`}>
      {change > 0 ? '+' : '−'}
      {formatNumber(size, 1)}%
    </span>
  );
};

const MetricCard = ({ title, current, previous }) => (
  <div className="metric-card">
    <h3 className="metric-title">{title}</h3>
    <div className="metric-value">
      {formatNumber(current, 2)}{' '}
      <span className="metric-aside">from {formatNumber(previous, 2)}</span>
    </div>
    <div className="metric-corner">
      <ChangePill change={changeFrom(current, previous)} />
    </div>
  </div>
);

const HitRateCard = ({ ratio, last5ratio, last10ratio }) => {
  const [hits, games] = String(ratio)
    .split('/')
    .map((part) => toFiniteNumber(part));
  const percent = games ? `${Math.round((hits / games) * 100)}%` : '—';
  return (
    <div className="metric-card">
      <h3 className="metric-title">Hit rate</h3>
      <div className="metric-value">
        <span>{ratio}</span> <span className="metric-aside">{percent}</span>
      </div>
      <div className="metric-corner metric-recent">
        L5 {last5ratio || '—'} · L10 {last10ratio || '—'}
      </div>
    </div>
  );
};

const MetricsDashboardRow = ({
  lineType,
  rawValue,
  per36Value,
  seasonRawValue,
  seasonPer36Value,
  ratio,
  last5ratio,
  last10ratio,
}) => (
  <div className="metrics-row">
    <MetricCard
      title={`${lineType} avg`}
      current={toFiniteNumber(rawValue, 0)}
      previous={toFiniteNumber(seasonRawValue, 0)}
    />
    <MetricCard
      title="Per-36"
      current={toFiniteNumber(per36Value, 0)}
      previous={toFiniteNumber(seasonPer36Value, 0)}
    />
    {ratio && <HitRateCard ratio={ratio} last5ratio={last5ratio} last10ratio={last10ratio} />}
  </div>
);

export default MetricsDashboardRow;
