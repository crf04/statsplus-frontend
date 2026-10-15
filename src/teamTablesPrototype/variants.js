/*
 * PROTOTYPE — throwaway (branch prototype/team-profile-tables).
 * Three structurally different ways to show an opponent's Defense readings
 * in the half-width Opposing Team Profile card:
 *   A  Ledger: one grouped table, value / rank / vs league in fixed columns.
 *   B  Bars: a diverging bar per stat around league average, rank at the end.
 *   C  Tiles: a grid of rank-tinted tiles, one number per tile.
 */
import '../readings.css';
import './prototype.css';
import { fmtValue, fmtVs, model, ordinal, rankHue, tone } from './data';

const standing = (rank) =>
  rank == null ? '' : rank >= 16 ? `${ordinal(31 - rank)} most` : `${ordinal(rank)} fewest`;

const Rank = ({ rank, small }) =>
  rank == null ? (
    <span className="ttp-dim">–</span>
  ) : (
    <span className={`rank-pill${small ? ' ttp-pill-sm' : ''}`} style={{ '--rank': rank }}>
      {rank}
    </span>
  );

const Vs = ({ vs }) => <span className={`ttp-vs ttp-vs-${tone(vs)}`}>{fmtVs(vs)}</span>;

const Caption = ({ m }) => <p className="ttp-caption">{m.unit} · rank 1–30, 30 allows the most</p>;

/* ---------------- A: Ledger ---------------- */

/* Each group is its own table so the groups can flow into two columns when
   the card is wide enough. */
const LedgerList = ({ m }) => {
  const ratio = m.groups[0].items[0]?.kind === 'ratio';
  return (
    <div className="ttp-flow">
      {m.groups.map((g) => (
        <table key={g.title || 'all'} className="ttp-ledger">
          <colgroup>
            <col />
            {!ratio && <col style={{ width: '4.6em' }} />}
            <col style={{ width: '3em' }} />
            <col style={{ width: '4.4em' }} />
          </colgroup>
          <thead>
            <tr>
              <th className={`ttp-left${g.title ? ' ttp-gold' : ''}`}>{g.title || 'Play type'}</th>
              {!ratio && <th>Allowed</th>}
              <th className="ttp-center">Rank</th>
              <th>vs Lg</th>
            </tr>
          </thead>
          <tbody>
            {g.items.map((it) => (
              <tr key={it.key}>
                <td className="ttp-left ttp-label">{it.label}</td>
                {!ratio && <td className="ttp-num">{fmtValue(it)}</td>}
                <td className="ttp-center">
                  <Rank rank={it.rank} />
                </td>
                <td>
                  <Vs vs={it.vs} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ))}
    </div>
  );
};

/* The shorter dimension becomes the columns so the table always fits. */
const LedgerMatrix = ({ m }) => {
  const transpose = m.metrics.length > m.rows.length;
  const cols = transpose ? m.rows.map((r) => ({ key: r.key, label: r.short })) : m.metrics;
  const lines = transpose ? m.metrics : m.rows;
  const cell = (line, col) =>
    transpose ? m.rows.find((r) => r.key === col.key).cells[line.key] : line.cells[col.key];
  return (
    <table className="ttp-ledger ttp-matrix">
      <thead>
        <tr>
          <th className="ttp-left">{transpose ? 'Stat' : 'Zone'}</th>
          {cols.map((c) => (
            <th key={c.key}>{c.label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {lines.map((line) => (
          <tr key={line.key}>
            <td className="ttp-left ttp-label">{line.label}</td>
            {cols.map((c) => {
              const r = cell(line, c);
              return (
                <td key={c.key}>
                  <span className="ttp-cell">
                    <span className="ttp-num">{fmtValue(r)}</span>
                    {r.rank != null && <Rank rank={r.rank} small />}
                  </span>
                  {r.vs != null && (
                    <span className={`ttp-sub ttp-vs-${tone(r.vs)}`}>{fmtVs(r.vs)}</span>
                  )}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
};

/* ---------------- B: Diverging bars ---------------- */

const scaleFor = (items) => {
  const max = Math.max(5, ...items.map((i) => Math.abs(i.vs ?? 0)));
  return Math.ceil(max / 5) * 5;
};

const BarRow = ({ label, sub, r, scale }) => {
  const w = r.vs == null ? 0 : (Math.min(Math.abs(r.vs), scale) / scale) * 50;
  return (
    <div className="ttp-brow">
      <span className="ttp-blabel">
        {label}
        {sub && <em>{sub}</em>}
      </span>
      <span className="ttp-track">
        <span className="ttp-axis" />
        {r.vs != null && (
          <span
            className={`ttp-bfill ttp-bfill-${r.vs >= 0 ? 'up' : 'down'}`}
            style={r.vs >= 0 ? { left: '50%', width: `${w}%` } : { right: '50%', width: `${w}%` }}
          />
        )}
      </span>
      <span className={`ttp-bvs ttp-vs-${tone(r.vs)}`}>{fmtVs(r.vs)}</span>
      <Rank rank={r.rank} small />
    </div>
  );
};

const BarScale = ({ scale }) => (
  <div className="ttp-bscale">
    <span />
    <span className="ttp-bscale-track">
      <span>−{scale}%</span>
      <span>avg</span>
      <span>+{scale}%</span>
    </span>
    <span />
    <span />
  </div>
);

/* A unit is a titled run of bars. Long lists split into two columns, at a
   group boundary when that balances within a couple of lines, otherwise
   mid-group with the title repeated. Whether two columns fit is the card's
   call (container query); narrow cards stack the columns. */
const SPLIT_OVER = 9;
const lines = (u) => (u.title ? 1 : 0) + u.rows.length;

const splitUnits = (units) => {
  const total = units.reduce((n, u) => n + lines(u), 0);
  if (total <= SPLIT_OVER) return [units];
  let best = null;
  let seen = 0;
  units.slice(0, -1).forEach((u, k) => {
    seen += lines(u);
    const gap = Math.abs(total - 2 * seen);
    if (!best || gap < best.gap) best = { k: k + 1, gap };
  });
  if (best && best.gap <= 3) return [units.slice(0, best.k), units.slice(best.k)];
  const half = Math.ceil(total / 2);
  const left = [];
  const right = [];
  let used = 0;
  units.forEach((u) => {
    const room = half - used;
    const take = room - (u.title ? 1 : 0);
    // Never strand fewer than two bars on either side of a split.
    if (take < 2 || (lines(u) > room && u.rows.length - take < 2)) right.push(u);
    else if (lines(u) <= room) left.push(u);
    else {
      left.push({ ...u, split: true, rows: u.rows.slice(0, take) });
      right.push({ ...u, key: `${u.key}-cont`, head: null, cont: true, rows: u.rows.slice(take) });
    }
    used += lines(u);
  });
  return [left, right];
};

const BarUnit = ({ u, scale }) => (
  <div
    className={`ttp-bgroup${u.split ? ' ttp-bgroup-split' : ''}${u.cont ? ' ttp-bgroup-cont' : ''}`}
  >
    {u.title && (
      <div className="ttp-bgroup-title">
        <span>
          {u.title}
          {u.cont && <span className="ttp-cont"> cont.</span>}
        </span>
        {u.head && <span className="ttp-bgroup-head">{u.head}</span>}
      </div>
    )}
    {u.rows.map((r) => (
      <BarRow key={r.key} label={r.label} sub={r.sub} r={r.r} scale={scale} />
    ))}
  </div>
);

const BarColumns = ({ units, scale }) => {
  const cols = splitUnits(units);
  return (
    <div className="ttp-bars">
      <div className={`ttp-bcols${cols.length > 1 ? ' ttp-bcols-2' : ''}`}>
        {cols.map((col, n) => (
          <div key={n} className="ttp-bcol">
            <BarScale scale={scale} />
            {col.map((u) => (
              <BarUnit key={u.key} u={u} scale={scale} />
            ))}
          </div>
        ))}
      </div>
      <div className="ttp-blegend">
        <span>
          <i className="ttp-key ttp-bfill-down" /> allows less
        </span>
        <span>
          <i className="ttp-key ttp-bfill-up" /> allows more
        </span>
      </div>
    </div>
  );
};

const BarsList = ({ m }) => {
  const units = m.groups.map((g) => ({
    key: g.title || 'all',
    title: g.title,
    rows: g.items.map((it) => ({
      key: it.key,
      label: it.label,
      sub: it.kind === 'ratio' ? null : fmtValue(it),
      r: it,
    })),
  }));
  return <BarColumns units={units} scale={scaleFor(m.groups.flatMap((g) => g.items))} />;
};

const BarsMatrix = ({ m }) => {
  const ranked = m.metrics.filter((x) => m.rows.some((r) => r.cells[x.key].vs != null));
  const units = m.rows.map((row) => ({
    key: row.key,
    title: row.label,
    head: `${fmtValue(row.cells[row.headline])} ${row.headline === 'PTS' ? 'pts' : 'made'}${
      row.cells.PCT?.value != null ? ` · ${fmtValue(row.cells.PCT)}` : ''
    }`,
    rows: ranked
      .filter((x) => row.cells[x.key].value != null)
      .map((x) => ({
        key: x.key,
        label: x.label,
        sub: fmtValue(row.cells[x.key]),
        r: row.cells[x.key],
      })),
  }));
  const scale = scaleFor(m.rows.flatMap((r) => ranked.map((x) => r.cells[x.key])));
  return <BarColumns units={units} scale={scale} />;
};

/* ---------------- C: Tiles ---------------- */

const tint = (rank) => {
  const h = rankHue(rank);
  return h == null ? {} : { '--h': h };
};

const Tile = ({ label, r }) => (
  <div className={`ttp-tile${r.rank == null ? ' ttp-tile-none' : ''}`} style={tint(r.rank)}>
    <span className="ttp-tile-label">{label}</span>
    <span className="ttp-tile-big">{r.kind === 'ratio' ? fmtVs(r.vs) : fmtValue(r)}</span>
    <span className="ttp-tile-foot">
      <span>{standing(r.rank)}</span>
      {r.kind !== 'ratio' && r.vs != null && <Vs vs={r.vs} />}
    </span>
  </div>
);

const TilesList = ({ m }) => (
  <div className="ttp-tiles-wrap">
    {m.groups.map((g) => (
      <section key={g.title || 'all'}>
        {g.title && <div className="ttp-tiles-title">{g.title}</div>}
        <div className="ttp-tiles">
          {g.items.map((it) => (
            <Tile key={it.key} label={it.label} r={it} />
          ))}
        </div>
      </section>
    ))}
  </div>
);

const TilesMatrix = ({ m }) => (
  <div className="ttp-wide-tiles">
    {m.rows.map((row) => {
      const head = row.cells[row.headline];
      return (
        <div key={row.key} className="ttp-wide" style={tint(head.rank)}>
          <div className="ttp-wide-head">
            <span className="ttp-tile-label">{row.label}</span>
            <span className="ttp-tile-big">{fmtValue(head)}</span>
            <span className="ttp-tile-foot">
              <span>
                {row.headline === 'PTS' ? 'pts' : 'made'} · {standing(head.rank)}
              </span>
              <Vs vs={head.vs} />
            </span>
          </div>
          <div className="ttp-wide-cells">
            {m.metrics
              .filter((x) => x.key !== row.headline)
              .map((x) => {
                const r = row.cells[x.key];
                return (
                  <div key={x.key} className="ttp-mini">
                    <span className="ttp-mini-label">{x.label}</span>
                    <span className="ttp-num">{fmtValue(r)}</span>
                    {r.rank != null ? <Rank rank={r.rank} small /> : <span />}
                  </div>
                );
              })}
          </div>
        </div>
      );
    })}
  </div>
);

const VIEWS = {
  A: { list: LedgerList, matrix: LedgerMatrix },
  B: { list: BarsList, matrix: BarsMatrix },
  C: { list: TilesList, matrix: TilesMatrix },
};

export const TeamTablesProto = ({ variant, category, data }) => {
  const m = model(category, data);
  if (!m) return <p>Select a team and category to view stats.</p>;
  const View = VIEWS[variant][m.kind];
  return (
    <div className={`ttp ttp-${variant}`}>
      <Caption m={m} />
      <View m={m} />
    </div>
  );
};
