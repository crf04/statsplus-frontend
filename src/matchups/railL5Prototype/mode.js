/*
 * PROTOTYPE — throwaway (branch prototype/rail-matchup-l5). Matchup Score and
 * a Last 5 against the line in the Matchup player rail. The variant rides the
 * URL hash (#proto=l5&v=A) so the page's own query string is untouched.
 */
import { useEffect, useState } from 'react';

export const VARIANT_KEYS = ['O', 'B', 'C', 'E'];
export const VARIANT_NAMES = {
  O: 'Today',
  A: 'Score under name + L5 tiles',
  B: 'Mini chart under the row',
  C: 'Score text + L5 dots pill',
  E: 'Score text + L5 micro-bars pill',
  D: 'One footer line: score · L5 numbers · Game logs',
};

const readHash = () =>
  new URLSearchParams(typeof window === 'undefined' ? '' : window.location.hash.replace(/^#/, ''));

export const PROTO_STANDALONE = process.env.REACT_APP_PROTOTYPE === 'rail-l5';

export const isPrototypeActive = () =>
  PROTO_STANDALONE ||
  (process.env.NODE_ENV !== 'production' && readHash().get('proto') === 'l5');

const readVariant = () => {
  const key = (readHash().get('v') || 'B').toUpperCase();
  return VARIANT_KEYS.includes(key) ? key : 'B';
};

export const useVariant = () => {
  const [variant, setVariant] = useState(readVariant);
  useEffect(() => {
    const onHashChange = () => setVariant(readVariant());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);
  const goTo = (key) => {
    const hash = readHash();
    hash.set('proto', 'l5');
    hash.set('v', key);
    window.location.hash = hash.toString();
  };
  const step = (delta) => {
    const index = VARIANT_KEYS.indexOf(variant);
    goTo(VARIANT_KEYS[(index + delta + VARIANT_KEYS.length) % VARIANT_KEYS.length]);
  };
  return { variant, step };
};

export function PrototypeSwitcher() {
  const { variant, step } = useVariant();
  useEffect(() => {
    const onKey = (event) => {
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.closest('input, textarea, select, [contenteditable="true"]') !== null)
      )
        return;
      if (event.key === 'ArrowLeft') step(-1);
      if (event.key === 'ArrowRight') step(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  return (
    <div className="l5-proto-switcher" role="group" aria-label="Prototype variant">
      <button type="button" onClick={() => step(-1)} aria-label="Previous variant">
        ←
      </button>
      <span>
        <b>{variant}</b> {VARIANT_NAMES[variant]}
      </span>
      <button type="button" onClick={() => step(1)} aria-label="Next variant">
        →
      </button>
    </div>
  );
}
