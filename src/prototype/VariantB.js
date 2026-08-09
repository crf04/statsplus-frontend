// THROWAWAY PROTOTYPE — Variant B "Edge Matrix" (wayfinder crf04/statsplus#7).
// Hierarchy: the whole game at once. Rows = targetable players, columns = the
// five stat categories; each cell surfaces where the player's habits line up
// with what the opponent concedes. Click a cell for the underlying numbers.
import { Fragment, useState } from 'react';
import {
  PLAYERS,
  DEFENSE,
  opponentOf,
  marketsFor,
  archetypeLogsFor,
} from './mockData';
import { RankPill, MarketChips, Num, SectionCard } from './protoUi';

const CATEGORIES = ['Traditional', 'Play types', 'Shot zones', 'Shot types', 'Assist locations'];

// Per-cell pairing of player tendency vs opponent rank in that category.
function cellPairs(player, category) {
  const def = DEFENSE[opponentOf(player)];
  if (category === 'Traditional') {
    const map = { PTS: 'OPP_PTS', REB: 'OPP_REB', AST: 'OPP_AST', '3PM': 'OPP_3PM' };
    return marketsFor(player)
      .filter((m) => map[m])
      .map((m) => {
        const row = def.traditional.find((r) => r.stat === map[m]);
        return {
          label: m,
          player: `${m} posted`,
          opp: `${row.value} allowed (${row.vsAvg > 0 ? '+' : ''}${row.vsAvg} vs avg)`,
          rank: row.rank,
        };
      });
  }
  if (category === 'Play types') {
    return player.playTypes
      .filter((pt) => pt.freq >= 12)
      .map((pt) => ({
        label: pt.type,
        player: `${pt.freq}% · ${pt.ppp} PPP`,
        opp: `${def.playTypes[pt.type].ppp} allowed`,
        rank: def.playTypes[pt.type].rank,
      }));
  }
  if (category === 'Shot zones') {
    return player.zones
      .filter((z) => z.share >= 20)
      .map((z) => ({
        label: z.zone,
        player: `${z.share}% FGA · ${z.fgPct}%`,
        opp: `${def.zones[z.zone].fgPct}% allowed`,
        rank: def.zones[z.zone].rank,
      }));
  }
  if (category === 'Shot types') {
    return player.shotTypes
      .filter((st) => st.fga >= 4)
      .map((st) => ({
        label: st.type,
        player: `${st.fga} FGA · ${st.efg} eFG%`,
        opp: `${def.shotTypes[st.type].efg}% allowed`,
        rank: def.shotTypes[st.type].rank,
      }));
  }
  return Object.entries(player.assistLoc)
    .filter(([, perGame]) => perGame >= 1)
    .map(([loc, perGame]) => ({
      label: loc,
      player: `${perGame}/gm`,
      opp: `${def.assistLoc[loc].perGame}/gm allowed`,
      rank: def.assistLoc[loc].rank,
    }));
}

const cellTone = (pairs) => {
  if (pairs.some((p) => p.rank >= 21)) return 'var(--ct-hit-soft)';
  if (pairs.length > 0 && pairs.every((p) => p.rank <= 9)) return 'var(--ct-miss-soft)';
  return 'transparent';
};

const MatrixCell = ({ pairs, active, onClick }) => (
  <td
    onClick={pairs.length ? onClick : undefined}
    style={{
      border: '1px solid var(--ct-line)',
      padding: '6px 8px',
      cursor: pairs.length ? 'pointer' : 'default',
      background: active ? 'var(--ct-gold-soft)' : cellTone(pairs),
      verticalAlign: 'top',
      minWidth: 130,
    }}
  >
    {pairs.length === 0 ? (
      <span style={{ color: 'var(--ct-dim)', fontSize: 11 }}>—</span>
    ) : (
      pairs
        .slice()
        .sort((a, b) => b.rank - a.rank)
        .slice(0, 2)
        .map((p) => (
          <div
            key={p.label}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 6,
              fontSize: 12,
              lineHeight: '20px',
            }}
          >
            <span
              style={{
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                color: p.rank >= 21 ? 'var(--ct-hit)' : p.rank <= 9 ? 'var(--ct-miss)' : 'var(--ct-text)',
              }}
            >
              {p.label}
            </span>
            <RankPill rank={p.rank} size={18} />
          </div>
        ))
    )}
  </td>
);

const ExpandedRow = ({ player, category, onClose }) => {
  const pairs = cellPairs(player, category);
  const logs = archetypeLogsFor(player);
  const oppTri = opponentOf(player);
  return (
    <tr>
      <td colSpan={CATEGORIES.length + 1} style={{ padding: 0, border: '1px solid var(--ct-line-strong)' }}>
        <div style={{ background: 'var(--ct-surface-2)', padding: 12, textAlign: 'left' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 700 }}>
              {player.name} — {category} vs {oppTri}
            </span>
            <button
              onClick={onClose}
              style={{ background: 'none', border: 'none', color: 'var(--ct-dim)', cursor: 'pointer' }}
            >
              ✕ close
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              {pairs.map((p) => (
                <div
                  key={p.label}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr 1fr 30px',
                    gap: 8,
                    fontSize: 13,
                    padding: '5px 0',
                    borderBottom: '1px solid var(--ct-line)',
                    alignItems: 'center',
                  }}
                >
                  <span>{p.label}</span>
                  <Num>{p.player}</Num>
                  <Num>{p.opp}</Num>
                  <RankPill rank={p.rank} />
                </div>
              ))}
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--ct-dim)', textTransform: 'uppercase', marginBottom: 4 }}>
                {player.archetype}s vs {oppTri}
              </div>
              {logs.length === 0 ? (
                <div style={{ color: 'var(--ct-dim)', fontSize: 13 }}>No same-archetype sample yet.</div>
              ) : (
                logs.slice(0, 3).map((log) => (
                  <div key={log.player + log.date} style={{ fontSize: 13, padding: '3px 0' }}>
                    {log.player} <Num style={{ color: 'var(--ct-dim)' }}>({log.date})</Num> —{' '}
                    <Num>
                      {log.pts}p {log.reb}r {log.ast}a {log.fg3m} 3pm
                    </Num>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </td>
    </tr>
  );
};

const DefenseStrip = ({ tri }) => {
  const def = DEFENSE[tri];
  const worstPlayTypes = Object.entries(def.playTypes)
    .sort((a, b) => b[1].rank - a[1].rank)
    .slice(0, 3);
  return (
    <SectionCard title={`${tri} defense leaks`} style={{ flex: 1 }}>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 12 }}>
        {worstPlayTypes.map(([type, d]) => (
          <span key={type} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            {type} <RankPill rank={d.rank} size={18} />
          </span>
        ))}
        {def.traditional
          .filter((r) => r.rank >= 24)
          .map((r) => (
            <span key={r.stat} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              {r.stat.replace('OPP_', '')} <RankPill rank={r.rank} size={18} />
            </span>
          ))}
      </div>
    </SectionCard>
  );
};

const VariantB = () => {
  const [expanded, setExpanded] = useState(null); // {playerId, category}

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 12 }}>
        <DefenseStrip tri="NYK" />
        <DefenseStrip tri="BOS" />
      </div>
      <table style={{ borderCollapse: 'collapse', width: '100%', textAlign: 'left' }}>
        <thead>
          <tr>
            <th style={{ padding: '6px 8px', fontSize: 11, color: 'var(--ct-dim)', textTransform: 'uppercase' }}>
              Player
            </th>
            {CATEGORIES.map((c) => (
              <th
                key={c}
                style={{ padding: '6px 8px', fontSize: 11, color: 'var(--ct-dim)', textTransform: 'uppercase' }}
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {PLAYERS.map((player) => (
            <Fragment key={player.id}>
              <tr>
                <td
                  style={{
                    border: '1px solid var(--ct-line)',
                    padding: '6px 8px',
                    background: 'var(--ct-surface)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: 13 }}>
                    {player.name}{' '}
                    <span style={{ color: 'var(--ct-dim)', fontWeight: 400 }}>
                      {player.team} · {player.pos}
                    </span>
                  </div>
                  <MarketChips markets={marketsFor(player)} />
                </td>
                {CATEGORIES.map((category) => {
                  const pairs = cellPairs(player, category);
                  const active =
                    expanded && expanded.playerId === player.id && expanded.category === category;
                  return (
                    <MatrixCell
                      key={category}
                      pairs={pairs}
                      active={active}
                      onClick={() =>
                        setExpanded(active ? null : { playerId: player.id, category })
                      }
                    />
                  );
                })}
              </tr>
              {expanded && expanded.playerId === player.id && (
                <ExpandedRow
                  player={player}
                  category={expanded.category}
                  onClose={() => setExpanded(null)}
                />
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default VariantB;
