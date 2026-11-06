import { COURT_REGIONS, ordinal, shareText, vsLeagueText } from './matchupReading';

/*
 * The MCP `get_matchup` court (statsplus-mcp `cards/matchup.html` `court()`), for a Base read
 * by region: Shot zones or Assist locations. A region's big number is his share of the Base;
 * its second line is the opponent's rank (30th = allows the most) and % vs league; its fill is
 * green when the opponent allows more than the league, red when less, stronger with the gap.
 */

/* The zones are data marks, so the whole ramp keeps its alpha in every theme. */
export const zoneFill = (percent) =>
  percent === null
    ? 'var(--pmc-untinted)'
    : `rgb(var(--ct-${percent >= 0 ? 'hit' : 'miss'}-fill-rgb) / ${Math.min(0.8, 0.12 + Math.abs(percent) / 28).toFixed(2)})`;

const HOOP_Y = 75;
const THREE_RADIUS = 237.5;
const HOOP = 40.5;
const ARC = `M30 0 L30 140 A${THREE_RADIUS} ${THREE_RADIUS} 0 0 0 470 140 L470 0`;
const RESTRICTED = `M190 0 L190 ${HOOP_Y} A60 60 0 0 0 310 ${HOOP_Y} L310 0`;
const GROUND = 'var(--ct-surface)';

const rankText = (slice) => (slice.rank === null ? '–' : ordinal(slice.rank));

const RegionLabel = ({ slice, base, opponent, x, y, corner = false }) => {
  if (!slice) return null;
  return (
    <div
      className={`pmc-region${corner ? ' pmc-corner' : ''}`}
      style={{ left: `${x / 5}%`, top: `${y / 4}%` }}
      title={`${slice.label}: ${shareText(slice.share)} of his ${base.label.toLowerCase()} · ${
        slice.rank === null
          ? 'no opponent row'
          : `${opponent} ${ordinal(slice.rank)} (${vsLeagueText(slice.vsLeague)} vs league)`
      }`}
    >
      <b>{shareText(slice.share)}</b>
      {/* A corner strip is 3 ft wide, so its two lines run as one along it. */}
      <small>
        {corner && '· '}
        {rankText(slice)} · {vsLeagueText(slice.vsLeague)}
      </small>
    </div>
  );
};

const MatchupCourt = ({ base, opponent }) => {
  const regions = COURT_REGIONS[base.key];
  const byKey = new Map(base.slices.map((slice) => [slice.key, slice]));
  const at = (region) => byKey.get(regions[region]) ?? null;
  const fill = (region) => zoneFill(at(region)?.vsLeague ?? null);
  const label = (region, x, y, corner) => (
    <RegionLabel slice={at(region)} base={base} opponent={opponent} x={x} y={y} corner={corner} />
  );

  return (
    <div className="pmc-court-wrap">
      <div className="pmc-court">
        <svg
          viewBox="0 0 500 400"
          role="img"
          aria-label={`${base.label} half court against ${opponent}`}
        >
          <rect width="500" height="400" fill={GROUND} />
          <rect width="500" height="400" fill={fill('arc')} />
          <rect width="30" height="140" fill={fill('corner')} />
          <rect x="470" width="30" height="140" fill={fill('corner')} />
          <path d={`${ARC} Z`} fill={GROUND} />
          <path d={`${ARC} Z`} fill={fill('mid')} />
          <rect x="170" width="160" height="190" fill={GROUND} />
          <rect x="170" width="160" height="190" fill={fill('paint')} />
          <path d={`${RESTRICTED} Z`} fill={GROUND} />
          <path d={`${RESTRICTED} Z`} fill={fill('rim')} />
          <g fill="none" stroke={GROUND} strokeWidth="3">
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
          <circle cx="250" cy={HOOP} r="7.5" fill="none" className="pmc-hoop" strokeWidth="2" />
          <line
            x1="220"
            x2="280"
            y1={HOOP - 10}
            y2={HOOP - 10}
            className="pmc-hoop"
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
      <div className="pmc-legend">
        <b>{opponent} allows vs league</b>
        <span>Less</span>
        <i className="pmc-legend-scale" />
        <span>More</span>
      </div>
    </div>
  );
};

export default MatchupCourt;
