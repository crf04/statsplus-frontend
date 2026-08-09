// THROWAWAY PROTOTYPE — Variant E "Category Board" (wayfinder crf04/statsplus#7).
// Reaction round 2: group the spotting surface by stat category. Each of the
// five categories is a section; inside, both defenses' leaks in that mechanism
// (worst first) with the players who attack each leak. The full player dossier
// (kept from Variant A by request) opens as a drill-in under the row.
import { Fragment, useState } from 'react';
import { GAME, PLAYERS } from './mockData';
import { RankPill, Num, SectionCard } from './protoUi';
import { Dossier } from './VariantA';
import { concessions } from './VariantC';

const CATEGORY_ORDER = [
  'Play types',
  'Shot zones',
  'Shot types',
  'Assist locations',
  'Traditional',
];

const rowKeyOf = (c) => `${c.tri}|${c.category}|${c.label}`;

const PlayerChip = ({ player, note, active, onClick }) => (
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

const CategorySection = ({ category, rows, selected, onSelect }) => {
  const [showAll, setShowAll] = useState(false);
  const leaks = showAll ? rows : rows.filter((c) => c.rank >= 21);
  return (
    <SectionCard
      title={category}
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
          {showAll ? 'leaks only' : `all ${rows.length}`}
        </button>
      }
    >
      {leaks.length === 0 && (
        <div style={{ color: 'var(--ct-dim)', fontSize: 13 }}>
          Neither defense leaks here tonight.
        </div>
      )}
      {leaks.map((c) => {
        const rowKey = rowKeyOf(c);
        const attackers = PLAYERS.filter((p) => p.team !== c.tri)
          .map((p) => ({ player: p, note: c.attackers(p) }))
          .filter((a) => a.note);
        const selectedHere = selected && selected.rowKey === rowKey;
        const selectedPlayer = selectedHere
          ? PLAYERS.find((p) => p.id === selected.playerId)
          : null;
        return (
          <Fragment key={rowKey}>
            <div style={{ padding: '8px 0', borderBottom: '1px solid var(--ct-line)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, flexWrap: 'wrap' }}>
                <RankPill rank={c.rank} />
                <span style={{ fontWeight: 600 }}>{c.label}</span>
                <span
                  style={{
                    fontSize: 11,
                    color: 'var(--ct-dim)',
                    border: '1px solid var(--ct-line)',
                    borderRadius: 3,
                    padding: '0 5px',
                  }}
                >
                  vs {c.tri}
                </span>
                <Num style={{ marginLeft: 'auto', color: 'var(--ct-dim)', fontSize: 12 }}>
                  {c.line}
                </Num>
              </div>
              {attackers.length > 0 ? (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                  {attackers.map(({ player, note }) => (
                    <PlayerChip
                      key={player.id}
                      player={player}
                      note={note}
                      active={selectedHere && selected.playerId === player.id}
                      onClick={() =>
                        onSelect(
                          selectedHere && selected.playerId === player.id
                            ? null
                            : { rowKey, playerId: player.id },
                        )
                      }
                    />
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: 11, color: 'var(--ct-dim)', marginTop: 4 }}>
                  no targetable player leans on this
                </div>
              )}
            </div>
            {selectedPlayer && (
              <div style={{ margin: '10px 0' }}>
                <Dossier player={selectedPlayer} />
              </div>
            )}
          </Fragment>
        );
      })}
    </SectionCard>
  );
};

const VariantE = () => {
  const [selected, setSelected] = useState(null); // {rowKey, playerId}
  const all = [
    ...concessions(GAME.home.tri).map((c) => ({ ...c, tri: GAME.home.tri })),
    ...concessions(GAME.away.tri).map((c) => ({ ...c, tri: GAME.away.tri })),
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 12, color: 'var(--ct-dim)', textAlign: 'left' }}>
        Both defenses&apos; leaks, grouped by stat category — tap a player to open their full
        dossier in place.
      </div>
      {CATEGORY_ORDER.map((category) => (
        <CategorySection
          key={category}
          category={category}
          rows={all
            .filter((c) => c.category === category)
            .sort((a, b) => b.rank - a.rank)}
          selected={selected}
          onSelect={setSelected}
        />
      ))}
    </div>
  );
};

export default VariantE;
