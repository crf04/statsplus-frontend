// THROWAWAY PROTOTYPE — shared presentational atoms for the matchup detail
// variants (wayfinder crf04/statsplus#7). Kept deliberately small: layout
// belongs to each variant.

export const RankPill = ({ rank, size = 24 }) => {
  const normalized = (rank - 1) / 29;
  const red = Math.round(255 * (1 - normalized));
  const green = Math.round(255 * normalized);
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: size,
        height: size,
        padding: '0 4px',
        borderRadius: 4,
        fontWeight: 700,
        fontSize: size * 0.52,
        fontFamily: 'var(--ct-mono)',
        backgroundColor: `rgb(${red}, ${green}, 0)`,
        color: rank > 15 ? 'black' : 'white',
      }}
      title={`Opponent rank ${rank}/30 — 30 allows the most`}
    >
      {rank}
    </span>
  );
};

const BOARD_COLORS = { PP: '#8b5cf6', UD: '#eab308', DAB: '#22c55e' };

export const BoardDots = ({ boards }) => (
  <span style={{ display: 'inline-flex', gap: 3, marginLeft: 6 }}>
    {Object.entries(boards)
      .filter(([, markets]) => markets.length > 0)
      .map(([board]) => (
        <span
          key={board}
          title={`${board}: ${boards[board].join(', ')}`}
          style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            backgroundColor: BOARD_COLORS[board],
            display: 'inline-block',
          }}
        />
      ))}
  </span>
);

export const MarketChips = ({ markets }) => (
  <span style={{ display: 'inline-flex', gap: 4, flexWrap: 'wrap' }}>
    {markets.map((m) => (
      <span
        key={m}
        style={{
          fontSize: 10,
          fontFamily: 'var(--ct-mono)',
          padding: '1px 5px',
          borderRadius: 3,
          border: '1px solid var(--ct-line-strong)',
          color: 'var(--ct-dim)',
        }}
      >
        {m}
      </span>
    ))}
  </span>
);

export const SectionCard = ({ title, right, children, style }) => (
  <div
    style={{
      background: 'var(--ct-surface)',
      border: '1px solid var(--ct-line)',
      borderRadius: 'var(--ct-radius-card)',
      padding: 12,
      textAlign: 'left',
      ...style,
    }}
  >
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        marginBottom: 8,
      }}
    >
      <div
        style={{
          fontSize: 11,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--ct-dim)',
          fontWeight: 700,
        }}
      >
        {title}
      </div>
      {right}
    </div>
    {children}
  </div>
);

export const Num = ({ children, style }) => (
  <span style={{ fontFamily: 'var(--ct-mono)', ...style }}>{children}</span>
);

export const Sparkline = ({ values, width = 56, height = 16 }) => {
  if (!values || values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const x = (i) => (i / (values.length - 1)) * (width - 4) + 2;
  const y = (v) => height - 2 - ((v - min) / span) * (height - 4);
  const pts = values.map((v, i) => `${x(i)},${y(v)}`).join(' ');
  const avg3 = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;
  const up = avg3(values.slice(-3)) >= avg3(values.slice(0, 3));
  const color = up ? 'var(--ct-hit)' : 'var(--ct-miss)';
  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" opacity="0.85" />
      <circle cx={x(values.length - 1)} cy={y(values[values.length - 1])} r="2" fill={color} />
    </svg>
  );
};

export const HotBadge = () => (
  <span style={{ color: 'var(--ct-hit)', fontWeight: 700, fontSize: 11 }}>▲</span>
);

export const ColdBadge = () => (
  <span style={{ color: 'var(--ct-miss)', fontWeight: 700, fontSize: 11 }}>▼</span>
);
