import './profileShooting.css';

/*
 * The Zone Shooting court: the MCP `get_matchup` court sheet for Shot zones
 * (statsplus-mcp `cards/matchup.html`), against the page's opponent. A region's
 * big number is his share of shots from the zone; its second line is the
 * opponent's rank (30th = allows the most) and percent vs league for made
 * shots; its fill is green when the opponent allows more, red when less.
 */

const REGIONS = {
  rim: 'Restricted Area',
  paint: 'In The Paint (Non-RA)',
  mid: 'Mid-Range',
  corner: 'Corner 3',
  arc: 'Above the Break 3',
};

const ZONE_LABELS = {
  'Restricted Area': 'Restricted area',
  'In The Paint (Non-RA)': 'Paint (non-RA)',
  'Mid-Range': 'Mid-range',
  'Corner 3': 'Corner 3',
  'Above the Break 3': 'Above-break 3',
};

const share = (value) => (value === null ? '–' : `${Math.round(value * 100)}%`);
const signed = (percent) =>
  percent === null ? '–' : `${percent >= 0 ? '+' : '−'}${Math.abs(percent).toFixed(1)}%`;
export const ordinal = (rank) => {
  if (rank === null) return '–';
  const teen = rank % 100 >= 11 && rank % 100 <= 13;
  return `${rank}${teen ? 'th' : { 1: 'st', 2: 'nd', 3: 'rd' }[rank % 10] || 'th'}`;
};

/* The MCP card's fill: intensity grows with how far the opponent sits from league average. */
export const zoneFill = (percent) =>
  percent === null
    ? 'var(--ps-untinted)'
    : `rgba(${percent >= 0 ? '76, 175, 125' : '194, 78, 78'}, ${Math.min(0.8, 0.12 + Math.abs(percent) / 28).toFixed(2)})`;

const HOOP_Y = 75;
const THREE_RADIUS = 237.5;
const HOOP = 40.5;
const ARC = `M30 0 L30 140 A${THREE_RADIUS} ${THREE_RADIUS} 0 0 0 470 140 L470 0`;
const RESTRICTED = `M190 0 L190 ${HOOP_Y} A60 60 0 0 0 310 ${HOOP_Y} L310 0`;

const RegionLabel = ({ zone, slice, opponent, x, y, corner = false }) => {
  if (slice.share === null) return null;
  return (
    <div
      className={`ps-region${corner ? ' ps-corner' : ''}`}
      style={{ left: `${x / 5}%`, top: `${y / 4}%` }}
      title={`${ZONE_LABELS[zone]}: ${share(slice.share)} of his shots (league ${share(slice.leagueShare)}) · ${opponent} ${ordinal(slice.rank)} (${signed(slice.percentVsLeague)} vs league)`}
    >
      <b>{share(slice.share)}</b>
      {/* A corner strip is 3 ft wide, so its two lines run as one along it. */}
      <small>
        {corner && '· '}
        {ordinal(slice.rank)} · {signed(slice.percentVsLeague)}
      </small>
    </div>
  );
};

const ShotZoneCourt = ({ matchup }) => {
  const { opponent, zones } = matchup;
  const fill = (region) => zoneFill(zones[REGIONS[region]].percentVsLeague);
  const ground = 'var(--ct-surface)';
  const label = (region, x, y, corner) => (
    <RegionLabel
      zone={REGIONS[region]}
      slice={zones[REGIONS[region]]}
      opponent={opponent}
      x={x}
      y={y}
      corner={corner}
    />
  );
  const largest = Object.entries(zones)
    .filter(([, slice]) => slice.share !== null)
    .reduce(
      (best, entry) => (best === null || entry[1].share > best[1].share ? entry : best),
      null,
    );
  const missing = Object.values(zones).some((slice) => slice.percentVsLeague === null);

  return (
    <div className="ps">
      <div className="ps-heading">Shot zones · vs {opponent}</div>
      <div className="ps-court-wrap">
        <div className="ps-court">
          <svg
            viewBox="0 0 500 400"
            role="img"
            aria-label={`Shot zones half court against ${opponent}`}
          >
            <rect width="500" height="400" fill={ground} />
            <rect width="500" height="400" fill={fill('arc')} />
            <rect width="30" height="140" fill={fill('corner')} />
            <rect x="470" width="30" height="140" fill={fill('corner')} />
            <path d={`${ARC} Z`} fill={ground} />
            <path d={`${ARC} Z`} fill={fill('mid')} />
            <rect x="170" width="160" height="190" fill={ground} />
            <rect x="170" width="160" height="190" fill={fill('paint')} />
            <path d={`${RESTRICTED} Z`} fill={ground} />
            <path d={`${RESTRICTED} Z`} fill={fill('rim')} />
            <g fill="none" stroke={ground} strokeWidth="3">
              <path d={ARC} />
              <rect x="170" width="160" height="190" />
              <path d={RESTRICTED} />
            </g>
            <rect
              width="500"
              height="400"
              fill="none"
              stroke="var(--ct-line-strong)"
              strokeWidth="2"
            />
            <circle cx="250" cy={HOOP} r="7.5" fill="none" className="ps-hoop" strokeWidth="2" />
            <line
              x1="220"
              x2="280"
              y1={HOOP - 10}
              y2={HOOP - 10}
              className="ps-hoop"
              strokeWidth="3"
            />
          </svg>
          {label('rim', 250, 86)}
          {label('paint', 250, 162)}
          {label('mid', 250, 242)}
          {label('arc', 250, 337)}
          {label('corner', 18, 70, true)}
          {label('corner', 483, 70, true)}
        </div>
        <div className="ps-key">
          {largest && (
            <>
              <div
                className="ps-region ps-key-cell"
                style={{ background: zoneFill(largest[1].percentVsLeague) }}
              >
                <b>{share(largest[1].share)}</b>
                <small>
                  {ordinal(largest[1].rank)} · {signed(largest[1].percentVsLeague)}
                </small>
              </div>
              <div className="ps-key-lines">
                <span>Share of his shots from this zone</span>
                <span>{opponent}&apos;s rank (30th = most) · vs league</span>
              </div>
            </>
          )}
          {missing && (
            <>
              <i className="ps-key-none" />
              <span>No data for this zone</span>
            </>
          )}
          <i className="ps-key-scale" />
          <span>{opponent} allows less → more (made shots, season)</span>
        </div>
      </div>
    </div>
  );
};

export default ShotZoneCourt;
