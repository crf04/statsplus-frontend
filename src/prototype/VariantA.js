// THROWAWAY PROTOTYPE — Variant A "Player Dossier" (wayfinder crf04/statsplus#7).
// Hierarchy: player pool first. Pick a targetable player, read their full
// five-category crossover against the opponent, archetype logs at the bottom.
import { useState } from 'react';
import {
  PLAYERS,
  DEFENSE,
  opponentOf,
  marketsFor,
  computeEdges,
  archetypeLogsFor,
} from './mockData';
import {
  RankPill,
  BoardDots,
  MarketChips,
  SectionCard,
  Num,
  HotBadge,
  ColdBadge,
} from './protoUi';

const rowStyle = {
  display: 'grid',
  gridTemplateColumns: '1.2fr 1fr 1fr 34px',
  gap: 8,
  alignItems: 'center',
  padding: '5px 0',
  borderBottom: '1px solid var(--ct-line)',
  fontSize: 13,
};

const CrossRow = ({ label, playerLine, oppLine, rank, emphasize }) => (
  <div style={{ ...rowStyle, opacity: emphasize === false ? 0.55 : 1 }}>
    <span style={{ color: 'var(--ct-text)' }}>
      {label} {rank >= 21 && <HotBadge />} {rank <= 9 && <ColdBadge />}
    </span>
    <Num>{playerLine}</Num>
    <Num>{oppLine}</Num>
    <span style={{ justifySelf: 'end' }}>
      <RankPill rank={rank} />
    </span>
  </div>
);

const CrossHeader = ({ playerName, oppTri }) => (
  <div style={{ ...rowStyle, borderBottom: '1px solid var(--ct-line-strong)', fontSize: 11 }}>
    <span style={{ color: 'var(--ct-dim)' }} />
    <span style={{ color: 'var(--ct-dim)' }}>{playerName}</span>
    <span style={{ color: 'var(--ct-dim)' }}>{oppTri} allows</span>
    <span style={{ color: 'var(--ct-dim)', justifySelf: 'end' }}>RK</span>
  </div>
);

export const Dossier = ({ player }) => {
  const oppTri = opponentOf(player);
  const def = DEFENSE[oppTri];
  const edges = computeEdges(player);
  const logs = archetypeLogsFor(player);
  const first = player.name.split(' ')[0][0];
  const short = `${first}. ${player.name.split(' ').slice(1).join(' ')}`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <SectionCard
        title="Player"
        right={<MarketChips markets={marketsFor(player)} />}
        style={{ background: 'var(--ct-surface-2)' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <div>
            <span style={{ fontSize: 18, fontWeight: 700 }}>{player.name}</span>
            <span style={{ color: 'var(--ct-dim)', marginLeft: 8 }}>
              {player.team} · {player.pos} · {player.archetype}
            </span>
            <BoardDots boards={player.boards} />
          </div>
          <Num>
            {player.season.pts} pts · {player.season.reb} reb · {player.season.ast} ast ·{' '}
            {player.season.fg3m} 3pm
          </Num>
        </div>
        {(edges.hot.length > 0 || edges.cold.length > 0) && (
          <div style={{ marginTop: 8, display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 12 }}>
            {edges.hot.map((e) => (
              <span key={e.label} style={{ color: 'var(--ct-hit)' }}>
                ▲ {e.label} ({oppTri} {e.rank}th)
              </span>
            ))}
            {edges.cold.map((e) => (
              <span key={e.label} style={{ color: 'var(--ct-miss)' }}>
                ▼ {e.label} ({oppTri} {e.rank}th)
              </span>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard title={`Play types — usage vs what ${oppTri} allows`}>
        <CrossHeader playerName={short} oppTri={oppTri} />
        {player.playTypes.map((pt) => (
          <CrossRow
            key={pt.type}
            label={pt.type}
            playerLine={`${pt.freq}% freq · ${pt.ppp} PPP`}
            oppLine={`${def.playTypes[pt.type].ppp} PPP`}
            rank={def.playTypes[pt.type].rank}
            emphasize={pt.freq >= 12}
          />
        ))}
      </SectionCard>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <SectionCard title="Shot zones">
          <CrossHeader playerName={short} oppTri={oppTri} />
          {player.zones.map((z) => (
            <CrossRow
              key={z.zone}
              label={z.zone}
              playerLine={`${z.share}% FGA · ${z.fgPct}%`}
              oppLine={`${def.zones[z.zone].fgPct}% allowed`}
              rank={def.zones[z.zone].rank}
              emphasize={z.share >= 20}
            />
          ))}
        </SectionCard>
        <SectionCard title="Shot types">
          <CrossHeader playerName={short} oppTri={oppTri} />
          {player.shotTypes.map((st) => (
            <CrossRow
              key={st.type}
              label={st.type}
              playerLine={`${st.fga} FGA · ${st.efg} eFG%`}
              oppLine={`${def.shotTypes[st.type].efg}% allowed`}
              rank={def.shotTypes[st.type].rank}
              emphasize={st.fga >= 4}
            />
          ))}
        </SectionCard>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <SectionCard title="Assist locations">
          <CrossHeader playerName={short} oppTri={oppTri} />
          {Object.entries(player.assistLoc).map(([loc, perGame]) => (
            <CrossRow
              key={loc}
              label={loc}
              playerLine={`${perGame}/gm`}
              oppLine={`${def.assistLoc[loc].perGame}/gm allowed`}
              rank={def.assistLoc[loc].rank}
              emphasize={perGame >= 1}
            />
          ))}
        </SectionCard>
        <SectionCard title={`${oppTri} traditional (per 48)`}>
          {def.traditional.slice(0, 6).map((row) => (
            <div key={row.stat} style={rowStyle}>
              <span>{row.stat.replace('OPP_', '')}</span>
              <Num>{row.value}</Num>
              <Num style={{ color: 'var(--ct-dim)' }}>
                {row.vsAvg > 0 ? '+' : ''}
                {row.vsAvg} vs avg
              </Num>
              <span style={{ justifySelf: 'end' }}>
                <RankPill rank={row.rank} />
              </span>
            </div>
          ))}
        </SectionCard>
      </div>

      <SectionCard
        title={`${player.archetype}s vs ${oppTri} this season`}
        right={
          <span style={{ fontSize: 11, color: 'var(--ct-dim)' }}>
            {logs.length} game{logs.length === 1 ? '' : 's'}
          </span>
        }
      >
        {logs.length === 0 ? (
          <div style={{ color: 'var(--ct-dim)', fontSize: 13 }}>
            No same-archetype games against {oppTri} yet this season.
          </div>
        ) : (
          <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ color: 'var(--ct-dim)', fontSize: 11, textAlign: 'left' }}>
                <th style={{ paddingBottom: 4 }}>Player</th>
                <th>Date</th>
                <th>MIN</th>
                <th>PTS</th>
                <th>REB</th>
                <th>AST</th>
                <th>3PM</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.player + log.date} style={{ borderTop: '1px solid var(--ct-line)' }}>
                  <td style={{ padding: '4px 0' }}>{log.player}</td>
                  <td>
                    <Num>{log.date}</Num>
                  </td>
                  <td>
                    <Num>{log.min}</Num>
                  </td>
                  <td>
                    <Num>{log.pts}</Num>
                  </td>
                  <td>
                    <Num>{log.reb}</Num>
                  </td>
                  <td>
                    <Num>{log.ast}</Num>
                  </td>
                  <td>
                    <Num>{log.fg3m}</Num>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </SectionCard>
    </div>
  );
};

const VariantA = () => {
  const [selectedId, setSelectedId] = useState(PLAYERS[0].id);
  const selected = PLAYERS.find((p) => p.id === selectedId);
  const teams = [...new Set(PLAYERS.map((p) => p.team))];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '250px 1fr', gap: 12 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {teams.map((tri) => (
          <SectionCard key={tri} title={`${tri} targetable`}>
            {PLAYERS.filter((p) => p.team === tri).map((p) => {
              const edges = computeEdges(p);
              const active = p.id === selectedId;
              return (
                <button
                  key={p.id}
                  onClick={() => setSelectedId(p.id)}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    background: active ? 'var(--ct-gold-soft)' : 'none',
                    border: 'none',
                    borderLeft: active
                      ? '2px solid var(--ct-gold)'
                      : '2px solid transparent',
                    color: 'var(--ct-text)',
                    padding: '6px 8px',
                    cursor: 'pointer',
                    fontSize: 13,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: active ? 700 : 400 }}>{p.name}</span>
                    <span>
                      {edges.hot.length > 0 && (
                        <span style={{ color: 'var(--ct-hit)', fontSize: 11 }}>
                          ▲{edges.hot.length}
                        </span>
                      )}{' '}
                      {edges.cold.length > 0 && (
                        <span style={{ color: 'var(--ct-miss)', fontSize: 11 }}>
                          ▼{edges.cold.length}
                        </span>
                      )}
                    </span>
                  </div>
                  <div style={{ color: 'var(--ct-dim)', fontSize: 11 }}>
                    {p.pos} · <MarketChips markets={marketsFor(p)} />
                  </div>
                </button>
              );
            })}
          </SectionCard>
        ))}
      </div>
      <Dossier player={selected} />
    </div>
  );
};

export default VariantA;
