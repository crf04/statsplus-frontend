/*
 * PROTOTYPE — throwaway. In-memory Targets. Nothing persists; a reload
 * restores the seeds. The backend record does not exist yet (statsplus#53).
 */
import { useSyncExternalStore } from 'react';
import { baseOf, sliceLabel } from './catalog';

let nextId = 100;
const seed = (opponent, qualifiers, note = '') => ({
  id: nextId++,
  opponent,
  qualifiers: qualifiers.map(([base, sliceKey, comparator, threshold]) => ({
    base,
    sliceKey,
    comparator,
    threshold,
  })),
  note,
  createdAt: '2026-04-08T15:12:00Z',
});

const SEEDS = [
  seed('BOS', [['shotZones', 'Corner 3', 'at_or_above', 0.3]], 'BOS switches everything and leaves the corner late.'),
  seed(
    'NOP',
    [
      ['shotZones', 'Restricted Area', 'at_or_above', 0.35],
      ['playTypes', 'Transition', 'at_or_above', 0.18],
    ],
    'No rim protection when Missi sits; they also give up leak-outs.',
  ),
  seed('MIA', [['shotZones', 'Restricted Area', 'at_or_below', 0.2]], 'Zone walls off the rim. Who scores without it?'),
  seed('DEN', [['shotTypes', 'Pullups', 'at_or_above', 0.4]]),
  seed('OKC', [['assistLocations', 'Corner3Assists', 'at_or_above', 0.2]], 'Corner-3 creators vs the scramble.'),
];

let state = { targets: SEEDS, draft: null, toast: null };
const listeners = new Set();
const set = (patch) => {
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener());
};
const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
export const useTargetsStore = () => useSyncExternalStore(subscribe, () => state);

export const COMPARATOR_SYMBOL = { at_or_above: '≥', at_or_below: '≤' };

export const qualifierLabel = (q) =>
  `${sliceLabel(q.base, q.sliceKey)} ${COMPARATOR_SYMBOL[q.comparator]} ${Math.round(q.threshold * 100)}%`;

/* Title is derived, never stored: the record is the filter. (ADR 0001) */
export const titleOf = (target) =>
  `${target.opponent} vs ${target.qualifiers.map(qualifierLabel).join(', ')}`;

export const unitOf = (q) => baseOf(q.base)?.unit || '';

export const emptyQualifier = (base = 'shotZones', sliceKey = 'Corner 3', threshold = 0.25) => ({
  base,
  sliceKey,
  comparator: 'at_or_above',
  threshold,
});

export const addTarget = (target) => {
  const record = { ...target, id: nextId++, createdAt: new Date().toISOString() };
  set({ targets: [...state.targets, record], toast: { kind: 'saved', target: record } });
  return record;
};
export const updateTarget = (id, patch) =>
  set({ targets: state.targets.map((t) => (t.id === id ? { ...t, ...patch } : t)) });
export const removeTarget = (id) => set({ targets: state.targets.filter((t) => t.id !== id) });

/* Capture draft shared between the sheet rows and the capture surface. */
export const openDraft = (draft) => set({ draft });
export const patchDraft = (patch) => set({ draft: state.draft ? { ...state.draft, ...patch } : null });
export const closeDraft = () => set({ draft: null });
export const dismissToast = () => set({ toast: null });
