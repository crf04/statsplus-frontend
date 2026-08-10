// THROWAWAY PROTOTYPE — Variant G "Open Team Sheets" (wayfinder crf04/statsplus#7).
// Reaction round 4: F was still player-first — you had to select someone to
// light the sheet up. G needs no selection: both defense sheets render in
// full, every row already carrying the opposing targetable players who lean
// on it. Tap a player chip to open their dossier under the row; tapping a
// rail player just highlights their rows across the sheets.
import { Fragment, useState } from 'react';
import {
  GAME,
  PLAYERS,
  INJURIES,
  marketsFor,
  opponentOf,
  matchupScore,
  scoreComponents,
  scoreLabel,
} from './mockData';
import { RankPill, MarketChips, SectionCard, Num, Sparkline } from './protoUi';
import { archetypeLogsFor } from './mockData';
import { Dossier } from './VariantA';
import { concessions } from './VariantC';

const CATEGORY_ORDER = [
  'Play types',
  'Shot zones',
  'Shot types',
  'Assist locations',
  'Traditional',
];

const rowKeyOf = (tri, c) => `${tri}|${c.category}|${c.label}`;

// Prop-market views: which rows a market cares about, and which players are
// even on the board for it (from the posted-lines data — the pool contract).
const MARKET_TABS = ['All', 'PTS', 'REB', 'AST', '3PM', 'FGA', 'FG3A', 'PRA'];
const rowMatchesMarket = (c, market) => {
  if (market === 'All') return true;
  const rowMarkets = c.markets || [];
  if (market === 'PRA') return ['PTS', 'REB', 'AST', '3PM'].some((m) => rowMarkets.includes(m));
  return rowMarkets.includes(market);
};
const playerMatchesMarket = (p, market) =>
  market === 'All' || marketsFor(p).includes(market);

const SheetRow = ({ tri, c, market, overlayId, openKey, onOpen }) => {
  const rowKey = rowKeyOf(tri, c);
  const attackers = PLAYERS.filter((p) => p.team !== tri && playerMatchesMarket(p, market))
    .map((p) => ({ player: p, note: c.attackers(p) }))
    .filter((a) => a.note);
  const overlayHit = overlayId && attackers.some((a) => a.player.id === overlayId);
  const openPlayer =
    openKey && openKey.rowKey === rowKey ? PLAYERS.find((p) => p.id === openKey.playerId) : null;

  return (
    <Fragment>
      <div
        style={{
          padding: '6px 6px',
          borderBottom: '1px solid var(--ct-line)',
          background: overlayHit ? 'var(--ct-gold-soft)' : 'transparent',
          borderLeft: overlayHit ? '2px solid var(--ct-gold)' : '2px solid transparent',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
          <RankPill rank={c.rank} />
          <span style={{ fontWeight: 600 }}>{c.label}</span>
          <Num style={{ marginLeft: 'auto', color: 'var(--ct-dim)', fontSize: 12 }}>{c.line}</Num>
        </div>
        {attackers.length > 0 && (
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 5 }}>
            {attackers.map(({ player, note }) => {
              const active = openPlayer && openPlayer.id === player.id;
              const dimOthers = overlayId && player.id !== overlayId;
              return (
                <button
                  key={player.id}
                  onClick={() =>
                    onOpen(active ? null : { rowKey, playerId: player.id })
                  }
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    background: active ? 'var(--ct-gold-soft)' : 'var(--ct-surface-2)',
                    border: active ? '1px solid var(--ct-gold)' : '1px solid var(--ct-line)',
                    borderRadius: 999,
                    color: 'var(--ct-text)',
                    padding: '1px 8px',
                    fontSize: 11,
                    cursor: 'pointer',
                    opacity: dimOthers ? 0.35 : 1,
                  }}
                >
                  <span style={{ fontWeight: 600 }}>{player.name}</span>
                  <Num style={{ color: 'var(--ct-dim)' }}>{note}</Num>
                </button>
              );
            })}
          </div>
        )}
      </div>
      {openPlayer && (
        <div style={{ margin: '10px 0' }}>
          <Dossier player={openPlayer} />
        </div>
      )}
    </Fragment>
  );
};

const TeamSheet = ({ tri, market, recency, overlayId, openKey, onOpen }) => {
  const byCategory = concessions(tri, recency)
    .filter((c) => rowMatchesMarket(c, market))
    .reduce((acc, c) => {
      (acc[c.category] = acc[c.category] || []).push(c);
      return acc;
    }, {});
  const attackerTri = tri === GAME.home.tri ? GAME.away.tri : GAME.home.tri;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div
        style={{
          fontSize: 13,
          fontWeight: 800,
          textAlign: 'left',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: 'var(--ct-gold)',
          marginTop: 4,
        }}
      >
        {tri} defense · attacked by {attackerTri}
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))',
          gap: 10,
        }}
      >
        {CATEGORY_ORDER.filter((category) => (byCategory[category] || []).length > 0).map(
          (category) => (
            <SectionCard key={category} title={category}>
              {(byCategory[category] || [])
                .slice()
                .sort((a, b) => b.rank - a.rank)
                .map((c) => (
                  <SheetRow
                    key={rowKeyOf(tri, c)}
                    tri={tri}
                    c={c}
                    market={market}
                    overlayId={overlayId}
                    openKey={openKey}
                    onOpen={onOpen}
                  />
                ))}
            </SectionCard>
          ),
        )}
      </div>
    </div>
  );
};

const SCORE_COLS = [
  ['playTypes', 'Play types'],
  ['zones', 'Shot zones'],
  ['shotTypes', 'Shot types'],
  ['assistLoc', 'Assist loc'],
  ['traditional', 'Traditional'],
];

const ScoreCell = ({ value }) => (
  <td style={{ padding: '5px 10px', textAlign: 'right', fontFamily: 'var(--ct-mono)', fontSize: 12 }}>
    {value == null ? (
      <span style={{ color: 'var(--ct-dim)' }}>—</span>
    ) : (
      <span style={{ fontWeight: 700, color: value >= 1 ? 'var(--ct-hit)' : 'var(--ct-miss)' }}>
        {scoreLabel(value)}
      </span>
    )}
  </td>
);

const LogTable = ({ title, logs, withPlayer }) => (
  <div>
    <div
      style={{
        fontSize: 10,
        color: 'var(--ct-dim)',
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        marginBottom: 4,
        fontWeight: 700,
      }}
    >
      {title} <span style={{ fontWeight: 400 }}>({logs.length})</span>
    </div>
    {logs.length === 0 ? (
      <div style={{ fontSize: 12, color: 'var(--ct-dim)' }}>No games yet this season.</div>
    ) : (
      <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12 }}>
        <thead>
          <tr style={{ fontSize: 10, color: 'var(--ct-dim)', textAlign: 'left' }}>
            {withPlayer && <th style={{ paddingRight: 8 }}>Player</th>}
            <th>Date</th>
            <th>MIN</th>
            <th>PTS</th>
            <th>REB</th>
            <th>AST</th>
            <th>3PM</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((l) => (
            <tr key={(l.player || '') + l.date} style={{ borderTop: '1px solid var(--ct-line)' }}>
              {withPlayer && <td style={{ padding: '3px 8px 3px 0' }}>{l.player}</td>}
              <td>
                <Num>{l.date}</Num>
              </td>
              <td>
                <Num>{l.min}</Num>
              </td>
              <td>
                <Num>{l.pts}</Num>
              </td>
              <td>
                <Num>{l.reb}</Num>
              </td>
              <td>
                <Num>{l.ast}</Num>
              </td>
              <td>
                <Num>{l.fg3m}</Num>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    )}
  </div>
);

const ScoreTable = ({ player, recency, onClose }) => {
  const rows = marketsFor(player)
    .map((m) => ({
      market: m,
      comps: scoreComponents(player, m, recency),
      blend: matchupScore(player, m, recency),
    }))
    .filter((r) => r.blend != null || Object.values(r.comps).some((v) => v != null));

  return (
    <SectionCard
      title={`${player.name} — matchup scores vs ${opponentOf(player)} (${recency === 'L15' ? 'last 15' : 'season'})`}
      right={
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', color: 'var(--ct-dim)', cursor: 'pointer' }}
        >
          ✕
        </button>
      }
      style={{ borderColor: 'var(--ct-gold)' }}
    >
      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead>
          <tr style={{ fontSize: 10, color: 'var(--ct-dim)', textTransform: 'uppercase' }}>
            <th style={{ textAlign: 'left', padding: '4px 10px 4px 0' }}>Market</th>
            {SCORE_COLS.map(([, label]) => (
              <th key={label} style={{ textAlign: 'right', padding: '4px 10px' }}>
                {label}
              </th>
            ))}
            <th style={{ textAlign: 'right', padding: '4px 10px' }}>Blend</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ market, comps, blend }) => (
            <tr key={market} style={{ borderTop: '1px solid var(--ct-line)' }}>
              <td style={{ padding: '5px 10px 5px 0', fontSize: 12, fontWeight: 700 }}>{market}</td>
              {SCORE_COLS.map(([key]) => (
                <ScoreCell key={key} value={comps[key]} />
              ))}
              <ScoreCell value={blend} />
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ fontSize: 10, color: 'var(--ct-dim)', marginTop: 6 }}>
        Each cell: {player.name.split(' ')[1]}&apos;s diet in that base × opponent per-48 concession
        vs league avg. Combos (PRA/PA/RA) blend their parts by season weights.
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: 16,
          marginTop: 12,
          borderTop: '1px solid var(--ct-line-strong)',
          paddingTop: 10,
        }}
      >
        <LogTable
          title={`${player.name.split(' ')[1]} vs ${opponentOf(player)} this season`}
          logs={player.vsOpp || []}
        />
        <LogTable
          title={`${player.archetype}s vs ${opponentOf(player)}`}
          logs={archetypeLogsFor(player)}
          withPlayer
        />
      </div>
    </SectionCard>
  );
};

const INJURY_COLOR = { OUT: 'var(--ct-miss)', GTD: 'var(--ct-gold)' };
const injuryFor = (name) =>
  Object.values(INJURIES)
    .flat()
    .find((i) => i.player === name);

const VariantG = () => {
  const [overlayId, setOverlayId] = useState(null);
  const [openKey, setOpenKey] = useState(null); // {rowKey, playerId}
  const [sheetTri, setSheetTri] = useState(GAME.home.tri);
  const [market, setMarket] = useState('All');
  const [recency, setRecency] = useState('Season');
  const teams = [...new Set(PLAYERS.map((p) => p.team))];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '250px 1fr', gap: 12 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ fontSize: 11, color: 'var(--ct-dim)', textAlign: 'left' }}>
          Tap a player to trace their rows across the sheets; tap chips in the sheet for the full
          dossier.
        </div>
        <SectionCard title="Injury report">
          {Object.entries(INJURIES).flatMap(([tri, list]) =>
            list.map((inj) => (
              <div key={inj.player} style={{ fontSize: 12, padding: '3px 0' }}>
                <span style={{ fontWeight: 700, color: INJURY_COLOR[inj.status] }}>
                  {inj.status}
                </span>{' '}
                {inj.player} <span style={{ color: 'var(--ct-dim)' }}>({tri}) — {inj.note}</span>
              </div>
            )),
          )}
        </SectionCard>
        {teams.map((tri) => (
          <SectionCard key={tri} title={`${tri} targetable`}>
            {PLAYERS.filter((p) => p.team === tri)
              .sort((a, b) => b.season.pts - a.season.pts)
              .map((p) => {
              const active = p.id === overlayId;
              return (
                <button
                  key={p.id}
                  onClick={() => {
                    setOverlayId(active ? null : p.id);
                    if (!active) setSheetTri(opponentOf(p));
                  }}
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
                    opacity: playerMatchesMarket(p, market) ? 1 : 0.35,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>
                    <span style={{ fontWeight: active ? 700 : 400 }}>
                      {p.name}
                      {injuryFor(p.name) && (
                        <span
                          style={{
                            marginLeft: 6,
                            fontSize: 10,
                            fontWeight: 800,
                            color: INJURY_COLOR[injuryFor(p.name).status],
                          }}
                        >
                          {injuryFor(p.name).status}
                        </span>
                      )}
                    </span>
                  </div>
                  <div style={{ color: 'var(--ct-dim)', fontSize: 11 }}>
                    {p.pos} · <MarketChips markets={marketsFor(p)} />
                  </div>
                  <div
                    style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}
                    title="Minutes, last 10 games"
                  >
                    <Sparkline values={p.minutes} />
                    <Num style={{ fontSize: 10, color: 'var(--ct-dim)' }}>
                      {p.minutes[p.minutes.length - 1]}′ last
                    </Num>
                  </div>
                </button>
              );
            })}
          </SectionCard>
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 4 }}>
            {MARKET_TABS.map((m) => {
              const active = m === market;
              return (
                <button
                  key={m}
                  onClick={() => {
                    setMarket(m);
                    setOpenKey(null);
                  }}
                  style={{
                    padding: '4px 12px',
                    fontSize: 12,
                    fontWeight: 700,
                    fontFamily: 'var(--ct-mono)',
                    cursor: 'pointer',
                    background: active ? 'var(--ct-gold-soft)' : 'none',
                    color: active ? 'var(--ct-gold)' : 'var(--ct-dim)',
                    border: active
                      ? '1px solid var(--ct-gold)'
                      : '1px solid var(--ct-line)',
                    borderRadius: 999,
                  }}
                >
                  {m}
                </button>
              );
            })}
          </div>
          <span style={{ fontSize: 11, color: 'var(--ct-dim)' }}>
            market views scope rows + players to posted lines
          </span>
        </div>
        <div style={{ display: 'flex', gap: 12, alignSelf: 'flex-start', alignItems: 'center' }}>
          <div style={{ display: 'flex' }}>
            {['Season', 'L15'].map((w, i) => {
              const active = w === recency;
              return (
                <button
                  key={w}
                  onClick={() => setRecency(w)}
                  style={{
                    padding: '5px 14px',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                    background: active ? 'var(--ct-surface-2)' : 'none',
                    color: active ? 'var(--ct-text)' : 'var(--ct-dim)',
                    border: '1px solid var(--ct-line-strong)',
                    borderRadius:
                      i === 0
                        ? 'var(--ct-radius-ctl) 0 0 var(--ct-radius-ctl)'
                        : '0 var(--ct-radius-ctl) var(--ct-radius-ctl) 0',
                  }}
                >
                  {w === 'L15' ? 'Last 15' : 'Season'}
                </button>
              );
            })}
          </div>
          <div style={{ display: 'flex' }}>
          {[GAME.home.tri, GAME.away.tri].map((tri, i) => {
            const active = tri === sheetTri;
            return (
              <button
                key={tri}
                onClick={() => {
                  setSheetTri(tri);
                  setOpenKey(null);
                }}
                style={{
                  padding: '6px 18px',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: active ? 'var(--ct-gold)' : 'var(--ct-surface-2)',
                  color: active ? '#0d0b07' : 'var(--ct-dim)',
                  border: '1px solid var(--ct-line-strong)',
                  borderRadius:
                    i === 0 ? 'var(--ct-radius-ctl) 0 0 var(--ct-radius-ctl)' : '0 var(--ct-radius-ctl) var(--ct-radius-ctl) 0',
                }}
              >
                {tri} defense
              </button>
            );
          })}
          </div>
        </div>
        {overlayId && (
          <ScoreTable
            player={PLAYERS.find((p) => p.id === overlayId)}
            recency={recency}
            onClose={() => setOverlayId(null)}
          />
        )}
        <TeamSheet
          tri={sheetTri}
          market={market}
          recency={recency}
          overlayId={overlayId}
          openKey={openKey}
          onOpen={setOpenKey}
        />
      </div>
    </div>
  );
};

export default VariantG;
