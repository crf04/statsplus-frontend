/*
 * PROTOTYPE — throwaway. Four structurally different answers to "how should
 * the Shooting Type and Zone Shooting profiles look, and always fit?".
 * Every variant sizes to its container (not the viewport) and never scrolls
 * sideways: the card is half the page on desktop and the full phone width.
 */
import './prototype.css';
import { ma, one, pct, share, shotTypes, times, vsTone, zones } from './data';

const Bar = ({ value, max = 1, tone = 'gold' }) => (
  <span className="pss-bar">
    <span
      className={`pss-bar-fill pss-${tone}`}
      style={{ width: `${Math.max(0, Math.min(1, value / max)) * 100}%` }}
    />
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

const TypeA = ({ rows }) => (
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
            <span className="pss-main">{share(r.share)}</span>
            <Bar value={r.share} />
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

/* ---------------- B: bar rows, no table ---------------- */

const TypeB = ({ rows }) => {
  const max = Math.max(...rows.map((r) => r.share), 0.01);
  return (
    <div className="pss-rows">
      <div className="pss-legend">
        <span><i className="pss-key pss-gold" />2PT attempts</span>
        <span><i className="pss-key pss-slate" />3PT attempts</span>
      </div>
      {rows.map((r) => (
        <div className="pss-row" key={r.key}>
          <div className="pss-row-head">
            <span className="pss-name">{r.name}</span>
            <span className="pss-row-big">
              {share(r.share)} <small>of FGA</small>
            </span>
          </div>
          <div className="pss-split" style={{ width: `${(r.share / max) * 100}%` }}>
            <span className="pss-gold" style={{ flex: r.two.share || 0 }} />
            <span className="pss-slate" style={{ flex: r.three.share || 0 }} />
          </div>
          <div className="pss-row-stats">
            <span><b>FG</b> {pct(r.fg.pct)} <em>{ma(r.fg)}</em></span>
            <span><b>2PT</b> {pct(r.two.pct)} <em>{r.two.a > 0 ? ma(r.two) : ''}</em></span>
            <span><b>3PT</b> {pct(r.three.pct)} <em>{r.three.a > 0 ? ma(r.three) : ''}</em></span>
          </div>
        </div>
      ))}
    </div>
  );
};

const ZoneB = ({ rows }) => {
  const max = Math.max(...rows.map((z) => z.pts), 0.1);
  return (
    <div className="pss-zrows">
      <div className="pss-zrow pss-zrow-head">
        <span>Zone</span>
        <span>Points per game</span>
        <span>FG%</span>
        <span>vs Lg</span>
      </div>
      {rows.map((z) => (
        <div className="pss-zrow" key={z.key}>
          <span className="pss-name">{z.name}</span>
          <span className="pss-zbar">
            <span className={`pss-zbar-fill ${z.three ? 'pss-slate' : 'pss-gold'}`} style={{ width: `${(z.pts / max) * 100}%` }} />
            <span className="pss-zbar-label">
              {one(z.pts)} <em>{share(z.share)}</em>
            </span>
          </span>
          <span className="pss-num">
            {pct(z.fg.pct)}
            <em>{ma(z.fg)}</em>
          </span>
          <span className="pss-num">
            <Vs x={z.vsLg} />
          </span>
        </div>
      ))}
    </div>
  );
};

/* ---------------- C: court map + tiles ---------------- */

const TypeC = ({ rows }) => (
  <div className="pss-tiles">
    {rows.map((r) => (
      <div className="pss-tile" key={r.key}>
        <div className="pss-tile-name">{r.name}</div>
        <div className="pss-tile-big">{share(r.share)}</div>
        <div className="pss-tile-label">of his FGA · {one(r.fg.a)}/g</div>
        <div className="pss-tile-fg">
          {pct(r.fg.pct)} <span>FG</span>
        </div>
        <div className="pss-tile-split">
          <div>
            <span>2PT</span>
            <b>{pct(r.two.pct, 0)}</b>
            <em>{r.two.a > 0 ? ma(r.two) : '—'}</em>
          </div>
          <div>
            <span>3PT</span>
            <b>{pct(r.three.pct, 0)}</b>
            <em>{r.three.a > 0 ? ma(r.three) : '—'}</em>
          </div>
        </div>
      </div>
    ))}
  </div>
);

/* Half court, baseline at the top, 10 units = 1 ft. */
const COURT = {
  'Restricted Area': { d: 'M210,0 L210,52.5 A40,40 0 0 0 290,52.5 L290,0 Z', at: [250, 46], tight: true },
  'In The Paint (Non-RA)': {
    d: 'M170,0 L170,190 L330,190 L330,0 Z M210,0 L210,52.5 A40,40 0 0 0 290,52.5 L290,0 Z',
    at: [250, 140],
  },
  'Mid-Range': {
    d: 'M30,0 L30,142 A237.5,237.5 0 0 0 470,142 L470,0 Z M170,0 L170,190 L330,190 L330,0 Z',
    at: [250, 245],
  },
  'Left Corner 3': { d: 'M0,0 L30,0 L30,142 L0,142 Z', at: [2, -16], above: true, anchor: 'start' },
  'Right Corner 3': { d: 'M470,0 L500,0 L500,142 L470,142 Z', at: [498, -16], above: true, anchor: 'end' },
  'Above the Break 3': {
    d: 'M0,142 L30,142 A237.5,237.5 0 0 0 470,142 L500,142 L500,400 L0,400 Z',
    at: [250, 345],
  },
};

const heat = (x) => {
  if (x == null) return 'rgba(255,255,255,0.03)';
  if (x >= 1) return `rgba(232,163,61,${Math.min(0.75, 0.12 + (x - 1) * 0.45)})`;
  return `rgba(122,134,153,${Math.min(0.5, 0.08 + (1 - x) * 0.45)})`;
};

const ZoneC = ({ rows }) => (
  <div className="pss-court-wrap">
    <svg className="pss-court" viewBox="-4 -52 508 456" role="img" aria-label="Zone shooting court map">
      {rows.map((z) => (
        <path key={z.key} d={COURT[z.key].d} fill={heat(z.vsLg)} fillRule="evenodd" stroke="rgba(255,255,255,0.22)" strokeWidth="2" />
      ))}
      {rows.map((z) => {
        const { at, above, tight, anchor = 'middle' } = COURT[z.key];
        return (
          <g key={z.key} transform={`translate(${at[0]},${at[1]})`} textAnchor={anchor}>
            {above ? (
              <>
                <text className="pss-court-small" y="-14">{z.short} · {pct(z.fg.pct, 0)}</text>
                <text className="pss-court-mid" y="10">{one(z.pts)}</text>
              </>
            ) : tight ? (
              <>
                <text className="pss-court-small" y="-22">{z.short} · {pct(z.fg.pct, 0)} FG</text>
                <text className="pss-court-big" y="10">{one(z.pts)}</text>
                <text className="pss-court-small" y="34">{times(z.vsLg)}</text>
              </>
            ) : (
              <>
                <text className="pss-court-small" y="-20">{z.short} · {pct(z.fg.pct, 0)} FG</text>
                <text className="pss-court-big" y="10">{one(z.pts)}</text>
                <text className="pss-court-small" y="32">{times(z.vsLg)}</text>
              </>
            )}
          </g>
        );
      })}
    </svg>
    <div className="pss-court-key">
      <span>Big = points per game · × and shade = emphasis vs league</span>
      <span className="pss-heat">
        <i style={{ background: heat(0.3) }} />less
        <i style={{ background: heat(1) }} />
        <i style={{ background: heat(2) }} />more
      </span>
    </div>
  </div>
);

/* ---------------- D: pivoted columns + points strip ---------------- */

const TypeD = ({ rows }) => {
  const line = (label, render, cls = '') => (
    <tr className={cls}>
      <th className="pss-left">{label}</th>
      {rows.map((r) => (
        <td key={r.key} className="pss-num">{render(r)}</td>
      ))}
    </tr>
  );
  return (
    <table className="pss-table pss-pivot">
      <thead>
        <tr>
          <th className="pss-left" />
          {rows.map((r) => (
            <th key={r.key}>{r.name}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {line('Share of FGA', (r) => (
          <>
            <span className="pss-main">{share(r.share)}</span>
            <Bar value={r.share} />
          </>
        ), 'pss-strong')}
        {line('FG%', (r) => <span className="pss-main">{pct(r.fg.pct)}</span>)}
        {line('FGM/FGA', (r) => <span className="pss-dim">{ma(r.fg)}</span>)}
        {line('2PT%', (r) => <span className="pss-main">{pct(r.two.pct)}</span>, 'pss-group')}
        {line('2PM/2PA', (r) => <span className="pss-dim">{r.two.a > 0 ? ma(r.two) : '—'}</span>)}
        {line('3PT%', (r) => <span className="pss-main">{pct(r.three.pct)}</span>, 'pss-group')}
        {line('3PM/3PA', (r) => <span className="pss-dim">{r.three.a > 0 ? ma(r.three) : '—'}</span>)}
      </tbody>
    </table>
  );
};

const STRIP = ['#e8a33d', '#c98a28', '#8f6a2c', '#7a8699', '#5d6879', '#a3adbd'];

const ZoneD = ({ rows }) => {
  const ordered = [...rows];
  return (
    <div>
      <div className="pss-strip" aria-label="Share of zone points">
        {ordered.map((z, i) =>
          z.share > 0 ? (
            <span key={z.key} style={{ flex: z.share, background: STRIP[i] }} title={`${z.name} ${share(z.share)}`}>
              {z.share >= 0.12 ? share(z.share) : ''}
            </span>
          ) : null,
        )}
      </div>
      <div className="pss-zgrid">
        {ordered.map((z, i) => (
          <div className="pss-zcell" key={z.key}>
            <div className="pss-zcell-head">
              <i className="pss-key" style={{ background: STRIP[i] }} />
              <span className="pss-name">{z.name}</span>
            </div>
            <div className="pss-zcell-big">
              {one(z.pts)} <small>pts</small>
              <Vs x={z.vsLg} />
            </div>
            <div className="pss-zcell-sub">
              {pct(z.fg.pct)} FG · {ma(z.fg)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ---------------- entry points ---------------- */

const TYPE = { A: TypeA, B: TypeB, C: TypeC, D: TypeD };
const ZONE = { A: ZoneA, B: ZoneB, C: ZoneC, D: ZoneD };

export const ShootingTypeProto = ({ variant, data }) => {
  const Variant = TYPE[variant];
  return (
    <div className="pss">
      <Variant rows={shotTypes(data)} />
      <Caption>Per game, season. Share = of all his field-goal attempts.</Caption>
    </div>
  );
};

export const ZoneShootingProto = ({ variant, data }) => {
  const Variant = ZONE[variant];
  return (
    <div className="pss">
      <Variant rows={zones(data)} />
      <Caption>Per game, season. Share = of his points from the six zones. vs Lg = zone emphasis vs league average.</Caption>
    </div>
  );
};
