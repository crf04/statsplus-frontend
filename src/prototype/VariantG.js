// THROWAWAY PROTOTYPE — Variant G "Open Team Sheets" (wayfinder crf04/statsplus#7).
// Reaction round 4: F was still player-first — you had to select someone to
// light the sheet up. G needs no selection: both defense sheets render in
// full, every row already carrying the opposing targetable players who lean
// on it. Tap a player chip to open their dossier under the row; tapping a
// rail player just highlights their rows across the sheets.
import { Fragment, useState } from 'react';
import { GAME, PLAYERS, marketsFor, computeEdges, opponentOf } from './mockData';
import { RankPill, MarketChips, SectionCard, Num } from './protoUi';
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
const MARKET_TABS = ['All', 'PTS', 'REB', 'AST', '3PM', 'PRA'];
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

const TeamSheet = ({ tri, market, overlayId, openKey, onOpen }) => {
  const byCategory = concessions(tri)
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

const VariantG = () => {
  const [overlayId, setOverlayId] = useState(null);
  const [openKey, setOpenKey] = useState(null); // {rowKey, playerId}
  const [sheetTri, setSheetTri] = useState(GAME.home.tri);
  const [market, setMarket] = useState('All');
  const teams = [...new Set(PLAYERS.map((p) => p.team))];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '250px 1fr', gap: 12 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ fontSize: 11, color: 'var(--ct-dim)', textAlign: 'left' }}>
          Tap a player to trace their rows across the sheets; tap chips in the sheet for the full
          dossier.
        </div>
        {teams.map((tri) => (
          <SectionCard key={tri} title={`${tri} targetable`}>
            {PLAYERS.filter((p) => p.team === tri).map((p) => {
              const edges = computeEdges(p);
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
        <div style={{ display: 'flex', gap: 0, alignSelf: 'flex-start' }}>
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
        <TeamSheet
          tri={sheetTri}
          market={market}
          overlayId={overlayId}
          openKey={openKey}
          onOpen={setOpenKey}
        />
      </div>
    </div>
  );
};

export default VariantG;
