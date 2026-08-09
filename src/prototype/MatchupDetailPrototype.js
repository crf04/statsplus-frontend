// THROWAWAY PROTOTYPE — wayfinder crf04/statsplus#7: matchup detail view.
// Three variants of how one slate game expands into a matchup breakdown,
// switchable via ?variant= (A | B | C) or the arrow keys / floating bar.
// Mock data only (src/prototype/mockData.js) — no backend, no auth.
// Run: npm start, then open http://localhost:5173/?prototype=matchup
import { useState } from 'react';
import { GAME, POOL_META, PLAYERS } from './mockData';
import PrototypeSwitcher from './PrototypeSwitcher';
import VariantA from './VariantA';
import VariantB from './VariantB';
import VariantC from './VariantC';

const VARIANTS = ['A', 'B', 'C'];
const VARIANT_NAMES = {
  A: 'Player Dossier',
  B: 'Edge Matrix',
  C: 'Defense Funnel',
};

const readVariant = () => {
  const v = new URLSearchParams(window.location.search).get('variant');
  return VARIANTS.includes(v) ? v : 'A';
};

const GameHeader = () => {
  const tipLocal = new Date(GAME.tipUtc).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
  const counts = PLAYERS.reduce((acc, p) => {
    acc[p.team] = (acc[p.team] || 0) + 1;
    return acc;
  }, {});
  const boardsUp = Object.entries(POOL_META.boards)
    .filter(([, s]) => s === 'ok')
    .map(([b]) => b);
  const boardsDown = Object.entries(POOL_META.boards)
    .filter(([, s]) => s !== 'ok')
    .map(([b]) => b);

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        padding: '14px 0 12px',
        flexWrap: 'wrap',
        gap: 8,
      }}
    >
      <div style={{ textAlign: 'left' }}>
        <span style={{ fontSize: 22, fontWeight: 800 }}>
          {GAME.away.tri} @ {GAME.home.tri}
        </span>
        <span style={{ color: 'var(--ct-dim)', marginLeft: 10, fontSize: 14 }}>
          {tipLocal} · {GAME.status}
        </span>
        <span style={{ color: 'var(--ct-dim)', marginLeft: 10, fontSize: 13 }}>
          {counts[GAME.away.tri] || 0} + {counts[GAME.home.tri] || 0} targetable
        </span>
      </div>
      <div style={{ fontSize: 12, color: 'var(--ct-dim)', fontFamily: 'var(--ct-mono)' }}>
        props pool {POOL_META.retrievedAtLabel} · boards {boardsUp.join('/')}
        {boardsDown.length > 0 && (
          <span style={{ color: 'var(--ct-miss)' }}> · {boardsDown.join('/')} unavailable</span>
        )}
      </div>
    </div>
  );
};

const MatchupDetailPrototype = () => {
  const [variant, setVariant] = useState(readVariant);

  const changeVariant = (next) => {
    const url = new URL(window.location.href);
    url.searchParams.set('variant', next);
    window.history.replaceState(null, '', url);
    setVariant(next);
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--ct-ink)',
        color: 'var(--ct-text)',
        padding: '0 20px 80px',
        maxWidth: 1280,
        margin: '0 auto',
      }}
    >
      <div
        style={{
          fontSize: 11,
          color: 'var(--ct-gold)',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          paddingTop: 10,
          textAlign: 'left',
        }}
      >
        Prototype — matchup detail (mock data, crf04/statsplus#7)
      </div>
      <GameHeader />
      {variant === 'A' && <VariantA />}
      {variant === 'B' && <VariantB />}
      {variant === 'C' && <VariantC />}
      <PrototypeSwitcher
        variants={VARIANTS}
        names={VARIANT_NAMES}
        current={variant}
        onChange={changeVariant}
      />
    </div>
  );
};

export default MatchupDetailPrototype;
