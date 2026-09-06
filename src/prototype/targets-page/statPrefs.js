/*
 * PROTOTYPE — throwaway. See ./README.md.
 *
 * The stats a Target is read through, kept with the Target: which columns
 * show and which one grades the grid. Every surface showing that Target
 * reads the same choice, and it survives a reload. Here that is a small
 * store in localStorage; shipped, it is two fields on the Target record,
 * saved the moment they change rather than with the criteria.
 */
import { useSyncExternalStore } from 'react';

const KEY = 'proto-targets-stat-prefs';

const load = () => {
  try {
    return JSON.parse(window.localStorage.getItem(KEY) || '{}');
  } catch {
    return {};
  }
};

let prefs = typeof window === 'undefined' ? {} : load();
const listeners = new Set();

const write = (next) => {
  prefs = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    // a full or blocked storage keeps the choice for the session only
  }
  listeners.forEach((listener) => listener());
};

const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const EMPTY = {};

export const useStatPrefs = (targetId) => {
  const all = useSyncExternalStore(subscribe, () => prefs);
  const own = targetId ? all[String(targetId)] || EMPTY : EMPTY;
  const set = (patch) => {
    if (!targetId) return;
    write({ ...prefs, [String(targetId)]: { ...own, ...patch } });
  };
  return {
    shown: own.shown || null,
    column: own.column || null,
    setShown: (shown) => set({ shown }),
    setColumn: (column) => set({ column }),
  };
};
