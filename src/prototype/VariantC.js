// THROWAWAY PROTOTYPE — Variant C "Defense Funnel" (wayfinder crf04/statsplus#7).
// Hierarchy: defense first. Each panel reads one defense's concessions worst-
// first across the five categories; under each leak, the opposing targetable
// players who lean on that exact thing. Click a player for a mini-dossier.
import { useState } from 'react';
import {
  PLAYERS,
  DEFENSE,
  defenseFor,
  GAME,
  LEAGUE_AVG,
  pctVs,
  defPlayTypeVolume,
  defZoneVolume,
  defShotTypeVolume,
  marketsFor,
  archetypeLogsFor,
  computeEdges,
} from './mockData';
import { RankPill, MarketChips, Num, SectionCard } from './protoUi';

// Which prop markets each defensive stat informs (round 7: prop-type views).
const TRAD_MARKETS = {
  OPP_PTS: ['PTS'],
  OPP_REB: ['REB'],
  OPP_AST: ['AST'],
  OPP_3PM: ['3PM'],
  OPP_3PA: ['3PM'],
  OPP_FTA: ['PTS'],
  OPP_TOV: [],
  OPP_STL: [],
  OPP_BLK: [],
};
const THREE_POINT_ZONES = ['Corner 3', 'Above Break 3'];
const THREE_POINT_SHOT_TYPES = ['Catch & Shoot', 'Pull-Up'];

// Every concession a defense makes, flattened and sortable by rank.
export function concessions(tri, window = 'Season') {
  const def = defenseFor(tri, window);
  const out = [];
  def.traditional.forEach((r) =>
    out.push({
      category: 'Traditional',
      label: r.stat.replace('OPP_', ''),
      line: `${r.value} per 48 (${pctVs(r.value, r.value - r.vsAvg)})`,
      rank: r.rank,
      z: (r.vsAvg / (r.value - r.vsAvg)) * 100 / 7,
      markets: TRAD_MARKETS[r.stat] || [],
      attackers: (p) => {
        const map = { PTS: 'PTS', REB: 'REB', AST: 'AST', '3PM': '3PM' };
        const market = map[r.stat.replace('OPP_', '')];
        return market && marketsFor(p).includes(market)
          ? `${market} posted`
          : null;
      },
    }),
  );
  Object.entries(def.playTypes).forEach(([type, d]) => {
    const v = defPlayTypeVolume(tri, type, window);
    out.push({
      category: 'Play types',
      label: type,
      line: `${v.ptsG} pts (${v.ptsPct}) · ${d.ppp} PPP (${v.pppPct})`,
      rank: d.rank,
      z: v.ptsPctNum / 8,
      markets: type === 'Putbacks' ? ['PTS', 'REB'] : ['PTS'],
      attackers: (p) => {
        const pt = p.playTypes.find((x) => x.type === type && x.freq >= 12);
        return pt ? `${Math.round(pt.freq)}% of poss` : null;
      },
    });
  });
  Object.entries(def.zones).forEach(([zone, d]) => {
    const v = defZoneVolume(tri, zone, window);
    out.push({
      category: 'Shot zones',
      label: zone,
      line: `${v.ptsG} pts (${v.ptsPct}) · ${v.fgaG} FGA (${v.fgaPct})`,
      rank: d.rank,
      z: v.ptsPctNum / 8,
      markets: THREE_POINT_ZONES.includes(zone)
        ? ['PTS', '3PM', 'FGA', 'FG3A']
        : ['PTS', 'FGA'],
      attackers: (p) => {
        const z = p.zones.find((x) => x.zone === zone && x.share >= 20);
        return z ? `${Math.round(z.share)}% of FGA` : null;
      },
    });
  });
  Object.entries(def.shotTypes).forEach(([type, d]) => {
    const v = defShotTypeVolume(tri, type, window);
    out.push({
      category: 'Shot types',
      label: type,
      line: `${v.ptsG} pts (${v.ptsPct}) · ${v.fgaG} FGA (${v.fgaPct})`,
      rank: d.rank,
      z: v.ptsPctNum / 8,
      markets: THREE_POINT_SHOT_TYPES.includes(type)
        ? ['PTS', '3PM', 'FGA', 'FG3A']
        : ['PTS', 'FGA'],
      attackers: (p) => {
        const st = p.shotTypes.find((x) => x.type === type && x.fga >= 4);
        if (!st) return null;
        const total = p.shotTypes.reduce((sum, x) => sum + x.fga, 0);
        return `${Math.round((st.fga / total) * 100)}% of FGA`;
      },
    });
  });
  Object.entries(def.assistLoc).forEach(([loc, d]) =>
    out.push({
      category: 'Assist locations',
      label: `Assists to ${loc}`,
      line: `${d.perGame} ast/gm (${pctVs(d.perGame, LEAGUE_AVG.assistLoc[loc])})`,
      rank: d.rank,
      z: ((d.perGame / LEAGUE_AVG.assistLoc[loc] - 1) * 100) / 9,
      markets: ['AST'],
      attackers: (p) => {
        if (p.assistLoc[loc] < 1) return null;
        const total = Object.values(p.assistLoc).reduce((sum, v) => sum + v, 0);
        return `${Math.round((p.assistLoc[loc] / total) * 100)}% of ast`;
      },
    }),
  );
  return out.sort((a, b) => b.rank - a.rank);
}

const PlayerChip = ({ player, note, onClick, active }) => (
  <button
    onClick={onClick}
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      background: active ? 'var(--ct-gold-soft)' : 'var(--ct-surface-2)',
      border: active ? '1px solid var(--ct-gold)' : '1px solid var(--ct-line)',
      borderRadius: 999,
      color: 'var(--ct-text)',
      padding: '2px 10px',
      fontSize: 12,
      cursor: 'pointer',
    }}
  >
    <span style={{ fontWeight: 600 }}>{player.name}</span>
    <Num style={{ color: 'var(--ct-dim)' }}>{note}</Num>
  </button>
);

const MiniDossier = ({ player, onClose }) => {
  const edges = computeEdges(player);
  const logs = archetypeLogsFor(player);
  return (
    <SectionCard
      title={`${player.name} — ${player.team} · ${player.pos} · ${player.archetype}`}
      right={
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', color: 'var(--ct-dim)', cursor: 'pointer' }}
        >
          ✕
        </button>
      }
      style={{ borderColor: 'var(--ct-gold)', marginTop: 10 }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <MarketChips markets={marketsFor(player)} />
        <Num>
          {player.season.pts}p · {player.season.reb}r · {player.season.ast}a ·{' '}
          {player.season.fg3m} 3pm
        </Num>
      </div>
      <div style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 3 }}>
        {edges.hot.map((e) => (
          <span key={e.label} style={{ color: 'var(--ct-hit)' }}>
            ▲ {e.label} — {e.playerLine} into {e.oppLine} (rank {e.rank})
          </span>
        ))}
        {edges.cold.map((e) => (
          <span key={e.label} style={{ color: 'var(--ct-miss)' }}>
            ▼ {e.label} — {e.playerLine} into {e.oppLine} (rank {e.rank})
          </span>
        ))}
      </div>
      <div style={{ marginTop: 8, fontSize: 12, color: 'var(--ct-dim)' }}>
        {logs.length === 0
          ? 'No same-archetype sample vs this opponent yet.'
          : logs
              .slice(0, 3)
              .map((l) => `${l.player} ${l.pts}p/${l.reb}r/${l.ast}a (${l.date})`)
              .join(' · ')}
      </div>
    </SectionCard>
  );
};

const DefensePanel = ({ tri }) => {
  const [showAll, setShowAll] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const attackersPool = PLAYERS.filter((p) => p.team !== tri);
  const all = concessions(tri);
  const shown = showAll ? all : all.filter((c) => c.rank >= 21);
  const selected = PLAYERS.find((p) => p.id === selectedId);

  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <SectionCard
        title={`${tri} defense — what it concedes, worst first`}
        right={
          <button
            onClick={() => setShowAll(!showAll)}
            style={{
              background: 'none',
              border: '1px solid var(--ct-line-strong)',
              borderRadius: 4,
              color: 'var(--ct-dim)',
              fontSize: 11,
              cursor: 'pointer',
              padding: '2px 8px',
            }}
          >
            {showAll ? 'leaks only' : `all ${all.length}`}
          </button>
        }
      >
        {shown.map((c) => {
          const attackers = attackersPool
            .map((p) => ({ player: p, note: c.attackers(p) }))
            .filter((a) => a.note);
          return (
            <div
              key={c.category + c.label}
              style={{ padding: '8px 0', borderBottom: '1px solid var(--ct-line)' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                <RankPill rank={c.rank} />
                <span style={{ fontWeight: 600 }}>{c.label}</span>
                <span style={{ color: 'var(--ct-dim)', fontSize: 11 }}>{c.category}</span>
                <Num style={{ marginLeft: 'auto', color: 'var(--ct-dim)', fontSize: 12 }}>
                  {c.line}
                </Num>
              </div>
              {attackers.length > 0 && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                  {attackers.map(({ player, note }) => (
                    <PlayerChip
                      key={player.id}
                      player={player}
                      note={note}
                      active={player.id === selectedId}
                      onClick={() =>
                        setSelectedId(player.id === selectedId ? null : player.id)
                      }
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </SectionCard>
      {selected && <MiniDossier player={selected} onClose={() => setSelectedId(null)} />}
    </div>
  );
};

const VariantC = () => (
  <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
    <DefensePanel tri={GAME.home.tri} />
    <DefensePanel tri={GAME.away.tri} />
  </div>
);

export default VariantC;
