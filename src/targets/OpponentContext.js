import { opponentMetricLabel } from './opponentContextApi';
const formatSignedPercent = (value) =>
  Number.isFinite(value) ? `${value > 0 ? '+' : ''}${value.toFixed(1).replace(/\.0$/, '')}%` : '—';
export default function OpponentContext({ opponent, qualifier, row, status, onRetry }) {
  const metric = opponentMetricLabel(qualifier.base);
  return (
    <div
      className="target-qualifier-opponent"
      role="group"
      aria-label={`${opponent} opponent context`}
    >
      <span className="target-qualifier-opponent-label">
        <span className="target-qualifier-opponent-team">{opponent}</span>
        <small className="target-qualifier-opponent-metric">{metric}</small>
      </span>
      {row ? (
        <>
          <span
            className="target-qualifier-opponent-rank"
            data-tone={
              Number.isFinite(row.rank)
                ? row.rank <= 10
                  ? 'low'
                  : row.rank >= 21
                    ? 'high'
                    : 'neutral'
                : 'neutral'
            }
            title="League rank: 1 is lowest, 30 is highest; 1–10 red, 11–20 neutral, 21–30 green"
          >
            {Number.isFinite(row.rank) ? (
              <>
                <b>{`#${Math.round(row.rank)}`}</b>
                <small>/30</small>
              </>
            ) : (
              <b>—</b>
            )}
          </span>
          <span
            className="target-qualifier-opponent-diff"
            data-tone={
              Number.isFinite(row.vsAverage)
                ? row.vsAverage <= -5
                  ? 'low'
                  : row.vsAverage >= 5
                    ? 'high'
                    : 'neutral'
                : 'neutral'
            }
            title="Allowed vs league average: red at −5% or below, green at +5% or above"
          >
            <b>{formatSignedPercent(row.vsAverage)}</b> vs avg
          </span>
        </>
      ) : (
        <span className="target-qualifier-opponent-state" role="status">
          {status === 'loading' ? 'Loading context…' : 'Context unavailable'}
          {status === 'error' && (
            <button type="button" onClick={onRetry}>
              Retry opponent context
            </button>
          )}
        </span>
      )}
    </div>
  );
}
