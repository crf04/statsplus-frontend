/*
 * PROTOTYPE — throwaway. Four structurally different answers to "how should
 * the Shooting Type and Zone Shooting profiles look, and always fit?".
 * Every variant sizes to its container (not the viewport) and never scrolls
 * sideways: the card is half the page on desktop and the full phone width.
 */
import './prototype.css';
import {
  courtSlices,
  leagueTypeShare,
  ma,
  one,
  ordinal,
  pct,
  points,
  share,
  shotTypes,
  signed,
  TEAM_CODES,
  times,
  vsTone,
  zones,
} from './data';
import baselines from './mock/diet-baselines.json';

const clamp01 = (x) => Math.max(0, Math.min(1, x));
const Bar = ({ value, max = 1, tone = 'gold', tick = null }) => (
  <span className="pss-bar">
    <span className={`pss-bar-fill pss-${tone}`} style={{ width: `${clamp01(value / max) * 100}%` }} />
    {tick != null && <span className="pss-bar-tick" style={{ left: `${clamp01(tick / max) * 100}%` }} />}
  </span>
);

const Vs = ({ x }) => (
  <span className={`pss-vs pss-vs-${vsTone(x)}`} title="Share of his points from this zone vs league average (1.00× = league)">
    {times(x)}
  </span>
);

const Caption = ({ children }) => <p className="pss-caption">{children}</p>;

/* ---------------- A: tight table, two-line cells ---------------- */

const Cell = ({ s }) => (
  <td className="pss-num">
    <span className="pss-main">{pct(s.pct)}</span>
    <span className="pss-sub">{s.a > 0 ? ma(s) : ''}</span>
  </td>
);

const ShareA = ({ r }) => (
  <>
    <span className="pss-main">{share(r.share)}</span>
    <Bar value={r.share} />
  </>
);

/* E: league average as a tick on the bar and a second line. */
const ShareE = ({ r }) => (
  <>
    <span className="pss-main">{share(r.share)}</span>
    <Bar value={r.share} tick={r.league} />
    <span className="pss-sub">lg {share(r.league)}</span>
  </>
);

/* F: the gap to league average, in percentage points. */
const ShareF = ({ r }) => {
  const d = r.league == null ? null : r.share - r.league;
  const tone = d == null || Math.abs(d) < 0.03 ? 'flat' : d > 0 ? 'up' : 'down';
  return (
    <>
      <span className="pss-main">{share(r.share)}</span>
      <span className={`pss-sub pss-delta pss-delta-${tone}`} title={`League average ${share(r.league)}`}>
        {points(d)} <span>vs lg</span>
      </span>
    </>
  );
};

const TypeA = ({ rows, Share = ShareA }) => (
  <table className="pss-table">
    <colgroup>
      <col style={{ width: '27%' }} />
      <col />
      <col />
      <col />
      <col />
    </colgroup>
    <thead>
      <tr>
        <th className="pss-left">Shot type</th>
        <th>Share</th>
        <th>FG</th>
        <th>2PT</th>
        <th>3PT</th>
      </tr>
    </thead>
    <tbody>
      {rows.map((r) => (
        <tr key={r.key}>
          <td className="pss-left pss-name">{r.name}</td>
          <td className="pss-num">
            <Share r={r} />
          </td>
          <Cell s={r.fg} />
          <Cell s={r.two} />
          <Cell s={r.three} />
        </tr>
      ))}
    </tbody>
  </table>
);

const ZoneA = ({ rows }) => (
  <table className="pss-table">
    <colgroup>
      <col style={{ width: '30%' }} />
      <col />
      <col />
      <col />
      <col />
    </colgroup>
    <thead>
      <tr>
        <th className="pss-left">Zone</th>
        <th>PTS</th>
        <th>Share</th>
        <th>FG</th>
        <th>vs Lg</th>
      </tr>
    </thead>
    <tbody>
      {rows.map((z) => (
        <tr key={z.key}>
          <td className="pss-left pss-name">{z.name}</td>
          <td className="pss-num">
            <span className="pss-main">{one(z.pts)}</span>
          </td>
          <td className="pss-num">
            <span className="pss-main">{share(z.share)}</span>
            <Bar value={z.share} />
          </td>
          <Cell s={z.fg} />
          <td className="pss-num">
            <Vs x={z.vsLg} />
          </td>
        </tr>
      ))}
    </tbody>
  </table>
);

/* ---------------- E / F: the MCP get_matchup court ---------------- */

/* Fill for what the opponent allows (percent vs league): green = more, red = less. */
const soft = (p) =>
  p == null
    ? 'rgba(255,255,255,0.05)'
    : `rgba(${p >= 0 ? '76,175,125' : '194,78,78'}, ${Math.min(0.8, 0.12 + Math.abs(p) / 28).toFixed(2)})`;

const HY = 75;
const R3 = 237.5;
const HOOP = 40.5;
const ARC = `M30 0 L30 140 A${R3} ${R3} 0 0 0 470 140 L470 0`;
const RA = `M190 0 L190 ${HY} A60 60 0 0 0 310 ${HY} L310 0`;

const Court = ({ slices, opp }) => {
  const fill = (region) => soft(slices[region]?.vsLg);
  const ground = 'var(--ct-surface)';
  const label = (region, x, y, rot) => {
    const s = slices[region];
    if (!s || s.share == null) return null;
    return (
      <div
        key={`${region}-${x}`}
        className={`pss-rl${rot ? ' pss-rot' : ''}`}
        style={{ left: `${(x / 5).toFixed(1)}%`, top: `${(y / 4).toFixed(1)}%` }}
        title={`${s.label}: ${share(s.share)} of his shots (league ${share(s.league)}) · ${opp} ${ordinal(s.rank)} (${signed(s.vsLg)} vs league)`}
      >
        <b>{share(s.share)}</b>
        {!rot && (
          <small>
            {ordinal(s.rank)} · {signed(s.vsLg)}
          </small>
        )}
      </div>
    );
  };
  return (
    <div className="pss-courtbox">
      <svg className="pss-mcourt" viewBox="0 0 500 400" role="img" aria-label="Shot zones half court">
        <rect width="500" height="400" fill={ground} />
        <rect width="500" height="400" fill={fill('arc')} />
        <rect width="30" height="140" fill={fill('corner')} />
        <rect x="470" width="30" height="140" fill={fill('corner')} />
        <path d={`${ARC} Z`} fill={ground} />
        <path d={`${ARC} Z`} fill={fill('mid')} />
        <rect x="170" width="160" height="190" fill={ground} />
        <rect x="170" width="160" height="190" fill={fill('paint')} />
        <path d={`${RA} Z`} fill={ground} />
        <path d={`${RA} Z`} fill={fill('rim')} />
        <g fill="none" stroke={ground} strokeWidth="3">
          <path d={ARC} />
          <rect x="170" width="160" height="190" />
          <path d={RA} />
        </g>
        <rect width="500" height="400" fill="none" stroke="var(--ct-line-strong)" strokeWidth="2" />
        <circle cx="250" cy={HOOP} r="7.5" fill="none" stroke="var(--ct-text)" strokeOpacity=".5" strokeWidth="2" />
        <line x1="220" x2="280" y1={HOOP - 10} y2={HOOP - 10} stroke="var(--ct-text)" strokeOpacity=".5" strokeWidth="3" />
      </svg>
      {label('rim', 250, 86)}
      {label('paint', 250, 162)}
      {label('mid', 250, 242)}
      {label('arc', 250, 337)}
      {label('corner', 18, 70, true)}
      {label('corner', 483, 70, true)}
    </div>
  );
};

const CourtKey = ({ slices, opp }) => {
  const all = Object.values(slices).filter((s) => s.share != null);
  const s = all.reduce((a, b) => (b.share > a.share ? b : a), all[0]);
  if (!s) return null;
  const gap = Object.values(slices).some((x) => x.vsLg == null);
  return (
    <div className="pss-zkey">
      <div className="pss-rl pss-static" style={{ background: soft(s.vsLg) }}>
        <b>{share(s.share)}</b>
        <small>
          {ordinal(s.rank)} · {signed(s.vsLg)}
        </small>
      </div>
      <div className="pss-lines">
        <span>Share of his shots from this zone</span>
        <span>{opp}&apos;s rank (30th = most) · vs league</span>
      </div>
      {gap && (
        <>
          <i className="pss-none" />
          <span>No data for this zone</span>
        </>
      )}
      <span className="pss-grad" />
      <span>
        {opp} allows less → more (made shots, season)
      </span>
    </div>
  );
};

const ZoneList = ({ slices, profile, opp }) => {
  const fg = (key) => {
    const a = profile?.[`${key}_FGA`];
    return { m: profile?.[`${key}_FGM`] ?? 0, a: a ?? 0, pct: a > 0 ? profile?.[`${key}_FG_PCT`] : null };
  };
  const rows = Object.values(slices).sort((a, b) => (b.share ?? 0) - (a.share ?? 0));
  return (
    <table className="pss-table pss-zlist">
      <colgroup>
        <col style={{ width: '31%' }} />
        <col />
        <col />
        <col />
      </colgroup>
      <thead>
        <tr>
          <th className="pss-left">Zone</th>
          <th>Share</th>
          <th>FG</th>
          <th>{opp}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((s) => (
          <tr key={s.key}>
            <td className="pss-left pss-name">{s.label}</td>
            <td className="pss-num">
              <span className="pss-main">{share(s.share)}</span>
              <span className="pss-sub">lg {share(s.league)}</span>
            </td>
            <Cell s={fg(s.key)} />
            <td className="pss-num">
              <span className="pss-main">{ordinal(s.rank)}</span>
              <span className={`pss-sub ${s.vsLg == null ? '' : s.vsLg >= 0 ? 'pss-hit' : 'pss-miss'}`}>{signed(s.vsLg)}</span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

const ZoneCourt = ({ matchups, team, profile, withList }) => {
  const opp = TEAM_CODES[team];
  if (!opp || !matchups?.opponents?.[opp]) return <p className="pss-caption">Pick an opponent to see the court.</p>;
  const slices = courtSlices(matchups, opp);
  return (
    <>
      <div className="pss-sec">
        <span>Shot zones · vs {opp}</span>
      </div>
      <div className="pss-courtwrap">
        <Court slices={slices} opp={opp} />
        <CourtKey slices={slices} opp={opp} />
      </div>
      {withList && <ZoneList slices={slices} profile={profile} opp={opp} />}
    </>
  );
};

/* ---------------- entry points ---------------- */

const withLeague = (rows) => rows.map((r) => ({ ...r, league: leagueTypeShare(baselines, r.key) }));

export const ShootingTypeProto = ({ variant, data }) => {
  const rows = withLeague(shotTypes(data));
  const Share = variant === 'E' ? ShareE : variant === 'F' ? ShareF : ShareA;
  return (
    <div className="pss">
      <TypeA rows={rows} Share={Share} />
      <Caption>
        Per game, season. Share = of all his field-goal attempts
        {variant === 'E' && '; lg = league-average share (tick on the bar).'}
        {variant === 'F' && '; vs lg = percentage points above or below the league-average share.'}
        {variant === 'A' && '.'}
      </Caption>
    </div>
  );
};

export const ZoneShootingProto = ({ variant, data, matchups, team }) => (
  <div className="pss">
    {variant === 'A' ? (
      <>
        <ZoneA rows={zones(data)} />
        <Caption>Round 1 table. vs Lg = zone emphasis vs league average.</Caption>
      </>
    ) : (
      <ZoneCourt matchups={matchups} team={team} profile={data} withList={variant === 'F'} />
    )}
  </div>
);
