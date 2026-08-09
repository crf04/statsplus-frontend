// THROWAWAY PROTOTYPE — Variant F "Team Sheet" (wayfinder crf04/statsplus#7).
// Reaction round 3: keep Variant A's targetable-player rail, but make the main
// pane team-stats-first — the opponent defense's five categories shown in
// full (every row, every rank), with the selected player overlaid as an
// annotation on the rows they actually lean on. The team table is the
// subject; the player is the highlight.
import { useState } from 'react';
import {
  PLAYERS,
  DEFENSE,
  PLAY_TYPES,
  ZONES,
  SHOT_TYPES,
  ASSIST_LOCS,
  opponentOf,
  marketsFor,
  computeEdges,
  archetypeLogsFor,
} from './mockData';
import { RankPill, BoardDots, MarketChips, SectionCard, Num } from './protoUi';

const gridStyle = {
  display: 'grid',
  gridTemplateColumns: '1.1fr 1fr 34px 1fr',
  gap: 8,
  alignItems: 'center',
  padding: '5px 6px',
  fontSize: 13,
};

const TeamRow = ({ label, oppLine, rank, playerLine, hit }) => (
  <div
    style={{
      ...gridStyle,
      borderBottom: '1px solid var(--ct-line)',
      background: hit ? 'var(--ct-gold-soft)' : 'transparent',
      borderLeft: hit ? '2px solid var(--ct-gold)' : '2px solid transparent',
    }}
  >
    <span style={{ color: 'var(--ct-text)' }}>{label}</span>
    <Num>{oppLine}</Num>
    <RankPill rank={rank} />
    <Num style={{ color: hit ? 'var(--ct-text)' : 'var(--ct-dim)', textAlign: 'right' }}>
      {playerLine || '—'}
    </Num>
  </div>
);

const TeamHeader = ({ oppTri, playerName }) => (
  <div style={{ ...gridStyle, fontSize: 11, color: 'var(--ct-dim)', borderBottom: '1px solid var(--ct-line-strong)' }}>
    <span />
    <span>{oppTri} allows</span>
    <span>RK</span>
    <span style={{ textAlign: 'right' }}>{playerName}</span>
  </div>
);

const VariantF = () => {
  const [selectedId, setSelectedId] = useState(PLAYERS[0].id);
  const player = PLAYERS.find((p) => p.id === selectedId);
  const oppTri = opponentOf(player);
  const def = DEFENSE[oppTri];
  const logs = archetypeLogsFor(player);
  const short = `${player.name.split(' ')[0][0]}. ${player.name.split(' ').slice(1).join(' ')}`;
  const teams = [...new Set(PLAYERS.map((p) => p.team))];

  const playerPlayType = (type) => player.playTypes.find((x) => x.type === type);
  const playerZone = (zone) => player.zones.find((x) => x.zone === zone);
  const playerShotType = (type) => player.shotTypes.find((x) => x.type === type);

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
                    borderLeft: active ? '2px solid var(--ct-gold)' : '2px solid transparent',
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
                        <span style={{ color: 'var(--ct-hit)', fontSize: 11 }}>▲{edges.hot.length}</span>
                      )}{' '}
                      {edges.cold.length > 0 && (
                        <span style={{ color: 'var(--ct-miss)', fontSize: 11 }}>▼{edges.cold.length}</span>
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

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <SectionCard title={`${oppTri} defense sheet`} style={{ background: 'var(--ct-surface-2)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 6 }}>
            <div style={{ fontSize: 13 }}>
              <span style={{ fontWeight: 700 }}>{player.name}</span>
              <span style={{ color: 'var(--ct-dim)' }}>
                {' '}
                {player.team} · {player.pos} · {player.archetype}
              </span>
              <BoardDots boards={player.boards} />
            </div>
            <Num style={{ fontSize: 12 }}>
              {player.season.pts}p · {player.season.reb}r · {player.season.ast}a · {player.season.fg3m} 3pm
            </Num>
          </div>
          <div style={{ fontSize: 11, color: 'var(--ct-dim)', marginTop: 4 }}>
            Gold rows = where {short} actually lives. Everything else is the full {oppTri} sheet.
          </div>
        </SectionCard>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <SectionCard title={`Play types ${oppTri} allows`}>
            <TeamHeader oppTri={oppTri} playerName={short} />
            {PLAY_TYPES.map((type) => {
              const d = def.playTypes[type];
              const pt = playerPlayType(type);
              return (
                <TeamRow
                  key={type}
                  label={type}
                  oppLine={`${d.ppp} PPP`}
                  rank={d.rank}
                  playerLine={pt ? `${pt.freq}% · ${pt.ppp}` : ''}
                  hit={pt && pt.freq >= 12}
                />
              );
            })}
          </SectionCard>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <SectionCard title={`Shot zones ${oppTri} allows`}>
              <TeamHeader oppTri={oppTri} playerName={short} />
              {ZONES.map((zone) => {
                const d = def.zones[zone];
                const z = playerZone(zone);
                return (
                  <TeamRow
                    key={zone}
                    label={zone}
                    oppLine={`${d.fgPct}% FG`}
                    rank={d.rank}
                    playerLine={z ? `${z.share}% FGA · ${z.fgPct}%` : ''}
                    hit={z && z.share >= 20}
                  />
                );
              })}
            </SectionCard>
            <SectionCard title={`Shot types ${oppTri} allows`}>
              <TeamHeader oppTri={oppTri} playerName={short} />
              {SHOT_TYPES.map((type) => {
                const d = def.shotTypes[type];
                const st = playerShotType(type);
                return (
                  <TeamRow
                    key={type}
                    label={type}
                    oppLine={`${d.efg}% eFG (${d.vsAvg > 0 ? '+' : ''}${d.vsAvg})`}
                    rank={d.rank}
                    playerLine={st ? `${st.fga} FGA · ${st.efg}%` : ''}
                    hit={st && st.fga >= 4}
                  />
                );
              })}
            </SectionCard>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <SectionCard title={`Assist locations ${oppTri} allows`}>
            <TeamHeader oppTri={oppTri} playerName={short} />
            {ASSIST_LOCS.map((loc) => {
              const d = def.assistLoc[loc];
              const perGame = player.assistLoc[loc];
              return (
                <TeamRow
                  key={loc}
                  label={loc}
                  oppLine={`${d.perGame}/gm`}
                  rank={d.rank}
                  playerLine={perGame ? `${perGame}/gm` : ''}
                  hit={perGame >= 1}
                />
              );
            })}
          </SectionCard>
          <SectionCard title={`${oppTri} traditional (per 48)`}>
            <TeamHeader oppTri={oppTri} playerName={short} />
            {def.traditional.map((row) => {
              const market = row.stat.replace('OPP_', '');
              const posted = marketsFor(player).includes(market);
              return (
                <TeamRow
                  key={row.stat}
                  label={market}
                  oppLine={`${row.value} (${row.vsAvg > 0 ? '+' : ''}${row.vsAvg})`}
                  rank={row.rank}
                  playerLine={posted ? `${market} posted` : ''}
                  hit={posted}
                />
              );
            })}
          </SectionCard>
        </div>

        <SectionCard
          title={`${player.archetype}s vs ${oppTri}`}
          right={<span style={{ fontSize: 11, color: 'var(--ct-dim)' }}>{logs.length} game{logs.length === 1 ? '' : 's'}</span>}
        >
          {logs.length === 0 ? (
            <div style={{ color: 'var(--ct-dim)', fontSize: 13 }}>
              No same-archetype games against {oppTri} yet this season.
            </div>
          ) : (
            <div style={{ fontSize: 13, display: 'flex', flexDirection: 'column', gap: 3 }}>
              {logs.map((l) => (
                <div key={l.player + l.date}>
                  {l.player} <Num style={{ color: 'var(--ct-dim)' }}>({l.date})</Num> —{' '}
                  <Num>
                    {l.pts}p {l.reb}r {l.ast}a {l.fg3m} 3pm · {l.min} min
                  </Num>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
};

export default VariantF;
