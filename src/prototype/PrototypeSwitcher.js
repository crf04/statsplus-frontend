// THROWAWAY PROTOTYPE — floating variant switcher (wayfinder crf04/statsplus#7).
// Deliberately styled unlike the app so it reads as scaffolding, not design.
import { useEffect } from 'react';

const isTypingTarget = (el) =>
  el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);

const PrototypeSwitcher = ({ variants, current, names, onChange }) => {
  const index = variants.indexOf(current);
  const cycle = (delta) => {
    const next = variants[(index + delta + variants.length) % variants.length];
    onChange(next);
  };

  useEffect(() => {
    const onKey = (e) => {
      if (isTypingTarget(document.activeElement)) return;
      if (e.key === 'ArrowLeft') cycle(-1);
      if (e.key === 'ArrowRight') cycle(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (process.env.NODE_ENV === 'production') return null;

  const buttonStyle = {
    background: 'none',
    border: 'none',
    color: 'white',
    fontSize: 18,
    cursor: 'pointer',
    padding: '2px 10px',
  };

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        background: '#1d4ed8',
        color: 'white',
        borderRadius: 999,
        boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
        padding: '6px 8px',
        fontSize: 13,
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <button style={buttonStyle} onClick={() => cycle(-1)} aria-label="Previous variant">
        ←
      </button>
      <span style={{ minWidth: 220, textAlign: 'center', fontWeight: 600 }}>
        {current} — {names[current]}
      </span>
      <button style={buttonStyle} onClick={() => cycle(1)} aria-label="Next variant">
        →
      </button>
    </div>
  );
};

export default PrototypeSwitcher;
