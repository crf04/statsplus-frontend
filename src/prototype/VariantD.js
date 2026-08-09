// THROWAWAY PROTOTYPE — Variant D "Target Board" (wayfinder crf04/statsplus#7).
// Synthesis after first reaction: this page exists to SPOT who to target or
// look into, fast — deep per-player analysis already lives on the player
// analysis page. Combines C's defense leaks (as clickable filters), B's
// alignment scanning (as ranked target cards), and A's dossier (as a
// tap-to-expand drill-in, standing in for "open in player analysis").
import { Fragment, useState } from 'react';
import { PLAYERS, marketsFor, computeEdges, archetypeLogsFor } from './mockData';
import { RankPill, MarketChips, SectionCard } from './protoUi';
import { Dossier } from './VariantA';
import { concessions } from './VariantC';

const leakKey = (tri, c) => `${tri}|${c.category}|${c.label}`;

const LeakStrip = ({ tri, activeKey, onToggle }) => {
  const leaks = concessions(tri).filter((c) => c.rank >= 21);
  return (
    <SectionCard title={`${tri} concedes`} style={{ flex: 1, minWidth: 260 }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {leaks.map((c) => {
          const key = leakKey(tri, c);
          const active = key === activeKey;
          return (
            <button
              key={key}
              onClick={() => onToggle(active ? null : { key, tri, concession: c })}
              title={`${c.category} · ${c.line}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                fontSize: 12,
                padding: '3px 8px',
                borderRadius: 999,
                cursor: 'pointer',
                background: active ? 'var(--ct-gold-soft)' : 'var(--ct-surface-2)',
                border: active ? '1px solid var(--ct-gold)' : '1px solid var(--ct-line)',
                color: 'var(--ct-text)',
              }}
            >
              {c.label} <RankPill rank={c.rank} size={17} />
            </button>
          );
        })}
      </div>
    </SectionCard>
  );
};

const TargetCard = ({ player, edges, expanded, onToggle }) => {
  const logs = archetypeLogsFor(player);
  const hotChips = edges.hot.slice().sort((a, b) => b.rank - a.rank).slice(0, 3);
  return (
    <button
      onClick={onToggle}
      style={{
        display: 'block',
        width: '100%',
        textAlign: 'left',
        background: expanded ? 'var(--ct-gold-soft)' : 'var(--ct-surface)',
        border: expanded ? '1px solid var(--ct-gold)' : '1px solid var(--ct-line)',
        borderRadius: 'var(--ct-radius-card)',
        color: 'var(--ct-text)',
        padding: '10px 12px',
        cursor: 'pointer',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontWeight: 700, fontSize: 14 }}>
          {player.name}{' '}
          <span style={{ color: 'var(--ct-dim)', fontWeight: 400, fontSize: 12 }}>
            {player.team} · {player.pos}
          </span>
        </span>
        <span style={{ fontSize: 11, whiteSpace: 'nowrap' }}>
          <span style={{ color: 'var(--ct-hit)' }}>▲{edges.hot.length}</span>{' '}
          <span style={{ color: 'var(--ct-miss)' }}>▼{edges.cold.length}</span>
        </span>
      </div>
      <div style={{ margin: '4px 0' }}>
        <MarketChips markets={marketsFor(player)} />
      </div>
      {hotChips.length > 0 ? (
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 4 }}>
          {hotChips.map((e) => (
            <span
              key={e.label}
              style={{
                fontSize: 11,
                color: 'var(--ct-hit)',
                border: '1px solid var(--ct-line)',
                borderRadius: 4,
                padding: '1px 6px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              {e.label} <RankPill rank={e.rank} size={15} />
            </span>
          ))}
          {edges.hot.length > 3 && (
            <span style={{ fontSize: 11, color: 'var(--ct-dim)' }}>+{edges.hot.length - 3} more</span>
          )}
        </div>
      ) : (
        <div style={{ fontSize: 11, color: 'var(--ct-dim)', marginTop: 4 }}>no aligned leaks</div>
      )}
      <div style={{ fontSize: 11, color: 'var(--ct-dim)', marginTop: 5 }}>
        {logs.length === 0
          ? `no ${player.archetype.toLowerCase()} sample vs opp`
          : `similar: ${logs
              .slice(0, 2)
              .map((l) => `${l.player} ${l.pts}p/${l.reb}r/${l.ast}a`)
              .join(' · ')}`}
      </div>
    </button>
  );
};

const VariantD = () => {
  const [leak, setLeak] = useState(null); // {key, tri, concession}
  const [expandedId, setExpandedId] = useState(null);

  const ranked = PLAYERS.map((p) => ({ player: p, edges: computeEdges(p) })).sort(
    (a, b) =>
      b.edges.hot.length - a.edges.hot.length || a.edges.cold.length - b.edges.cold.length,
  );
  const shown = leak
    ? ranked.filter(
        ({ player }) => player.team !== leak.tri && leak.concession.attackers(player),
      )
    : ranked;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <LeakStrip tri="NYK" activeKey={leak?.key} onToggle={setLeak} />
        <LeakStrip tri="BOS" activeKey={leak?.key} onToggle={setLeak} />
      </div>
      <div
        style={{
          fontSize: 12,
          color: 'var(--ct-dim)',
          textAlign: 'left',
          display: 'flex',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 6,
        }}
      >
        <span>
          {leak
            ? `${shown.length} player${shown.length === 1 ? '' : 's'} attacking ${leak.concession.label} (${leak.tri}) — tap the chip again to clear`
            : 'All targetable players, most aligned leaks first — tap a leak above to filter, tap a card to drill in'}
        </span>
        <span>sorted by ▲ alignment count (ordering only — no score shown)</span>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: 10,
        }}
      >
        {shown.map(({ player, edges }) => (
          <Fragment key={player.id}>
            <TargetCard
              player={player}
              edges={edges}
              expanded={expandedId === player.id}
              onToggle={() => setExpandedId(expandedId === player.id ? null : player.id)}
            />
            {expandedId === player.id && (
              <div style={{ gridColumn: '1 / -1' }}>
                <div
                  style={{
                    fontSize: 11,
                    color: 'var(--ct-dim)',
                    textAlign: 'left',
                    margin: '2px 0 6px',
                  }}
                >
                  Drill-in (in the real page this could hand off to the player analysis page)
                </div>
                <Dossier player={player} />
              </div>
            )}
          </Fragment>
        ))}
        {shown.length === 0 && (
          <div style={{ color: 'var(--ct-dim)', fontSize: 13 }}>
            No targetable player attacks this leak.
          </div>
        )}
      </div>
    </div>
  );
};

export default VariantD;
