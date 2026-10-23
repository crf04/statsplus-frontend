import { useEffect, useState } from 'react';
import { fetchSlate } from '../slateApi';
import { fetchSlateEdges } from '../slateEdgesApi';
import { fetchResolvedTargets } from '../targets/targetsApi';
import { TARGET_SLICES } from '../targets/targetCatalog';
import { isCalendarDate } from '../calendarDate';
import { isRequestCancelled } from '../gameLogsApi';

/*
 * What the home page knows about today (crf04/statsplus#204): the Slate's
 * games joined to their Slate Edges, and the reader's firing Targets. Each read
 * stands alone, so a failed one drops only its own section. The three are
 * requested at once with `fallback=next_game_day` and no date, so each
 * falls forward to the next game day by itself when today has none, or back to
 * the most recent one when no next is scheduled (crf04/statsplus#217, #242). A
 * backend without the edges route (null) reads like a failure: no ticker, no
 * Tonight.
 *
 * `fallback` is what the Slate answered with: null for today, or
 * `previous_game_day` / `next_game_day` for the day it fell back to.
 *
 * `games` is null when there is nothing to show: no edges, no games today, or
 * edges for another date than the Slate's (the reads straddled midnight ET).
 * Targets resolved for another date are dropped the same way.
 *
 * `trailing` is the Slate's list of families scored from an earlier season.
 * It is read fresh, never painted from the cache.
 *
 * The last public result (games, spotlight, date, fallback; never Targets) is kept
 * in localStorage and painted on mount before any read answers, then replaced
 * by the fresh one. An unreadable entry is ignored and removed.
 *
 * The Slate and Edges are public (crf04/statsplus#211): `landing` is whether
 * the Query Prompt is on screen. `account` is the uid of a signed-in, admitted
 * reader, or null: only an account reads Targets, and switching accounts
 * rereads, so one reader's Targets never stay on screen for the next.
 */
const EMPTY = { games: null, spotlight: null, slateDate: null, fallback: null, targets: null };

const FALLBACKS = new Set(['previous_game_day', 'next_game_day']);

const CACHE_KEY = 'courtai.homeTonight.v2';

// Everything below is what the ticker and Tonight read; an entry is only
// trusted when each of those fields has the type and form they render from.
const isObject = (value) => value !== null && typeof value === 'object';
const isText = (value) => typeof value === 'string';
const isNumber = (value) => typeof value === 'number' && Number.isFinite(value);
const isInstant = (value) => isText(value) && !Number.isNaN(new Date(value).getTime());

const isEffect = (effect) =>
  isObject(effect) && isNumber(effect.canonicalId) && isText(effect.name) && isNumber(effect.value);

const isGame = (game) =>
  isObject(game) &&
  isText(game.gameId) &&
  isInstant(game.scheduledAt) &&
  isText(game.away?.tricode) &&
  isText(game.home?.tricode) &&
  Array.isArray(game.effects) &&
  game.effects.every(isEffect) &&
  Array.isArray(game.scores) &&
  game.scores.every(
    (pair) => Array.isArray(pair) && pair.length === 2 && isNumber(pair[0]) && isNumber(pair[1]),
  );

const isReason = (reason) =>
  reason === null ||
  (isObject(reason) &&
    isText(reason.base) &&
    Object.hasOwn(TARGET_SLICES, reason.base) &&
    isText(reason.sliceKey) &&
    isNumber(reason.share) &&
    Number.isInteger(reason.opponentRank) &&
    reason.opponentRank >= 1 &&
    reason.opponentRank <= 30);

// `best` helps and `toughest` hurts, as the Slate Edges decoder requires.
const isPick = (pick, sign) =>
  pick === null ||
  (isObject(pick) &&
    isText(pick.gameId) &&
    isText(pick.name) &&
    isText(pick.opponent) &&
    isNumber(pick.value) &&
    pick.value * sign > 0 &&
    isReason(pick.reason));

// The last public result, or EMPTY when there is none or it cannot be trusted.
const readCache = () => {
  try {
    const entry = JSON.parse(window.localStorage.getItem(CACHE_KEY));
    if (entry === null) return EMPTY;
    if (
      !isObject(entry) ||
      !Array.isArray(entry.games) ||
      entry.games.length === 0 ||
      !entry.games.every(isGame) ||
      !isCalendarDate(entry.slateDate) ||
      !(entry.fallback === null || FALLBACKS.has(entry.fallback)) ||
      !isObject(entry.spotlight) ||
      !isPick(entry.spotlight.best, 1) ||
      !isPick(entry.spotlight.toughest, -1)
    ) {
      clearCache();
      return EMPTY;
    }
    return {
      ...EMPTY,
      games: entry.games.map((game) => ({ ...game, scores: new Map(game.scores) })),
      spotlight: entry.spotlight,
      slateDate: entry.slateDate,
      fallback: entry.fallback,
    };
  } catch {
    clearCache();
    return EMPTY;
  }
};

function clearCache() {
  try {
    window.localStorage.removeItem(CACHE_KEY);
  } catch {
    // Storage can be unavailable (private mode); the cache is best effort.
  }
}

const writeCache = ({ games, spotlight, slateDate, fallback }) => {
  try {
    const stored = games.map((game) => ({ ...game, scores: [...game.scores] }));
    window.localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ games: stored, spotlight, slateDate, fallback }),
    );
  } catch {
    // Storage can be unavailable or full; the cache is best effort.
  }
};

const joinGames = (slate, edges) => {
  const byId = new Map(edges.games.map((game) => [game.gameId, game]));
  return [...slate.games]
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
    .map((game) => ({
      ...game,
      effects: byId.get(game.gameId)?.effects ?? [],
      scores: byId.get(game.gameId)?.scores ?? new Map(),
    }));
};

// The Targets that fire today, most fits first; how many exist at all decides
// which empty line the column shows.
const firingTargets = (resolved) => ({
  total: resolved.entries.length,
  firing: resolved.entries
    .filter((entry) => entry.game && entry.players.length > 0)
    .sort((a, b) => b.players.length - a.players.length),
});

export const useHomeTonight = (landing, account) => {
  const [state, setState] = useState(() => (landing ? readCache() : EMPTY));
  useEffect(() => {
    // Targets are never cached, and a new account starts without the last one's.
    const cached = landing ? readCache() : EMPTY;
    setState(cached);
    if (!landing) {
      return undefined;
    }
    const controller = new AbortController();
    const { signal } = controller;
    const fallback = 'next_game_day';
    const settle = (promise) =>
      promise.then(
        (value) => ({ status: 'fulfilled', value }),
        (reason) => ({ status: 'rejected', reason }),
      );
    const warnIfFailed = (result) => {
      if (result.status === 'rejected' && result.reason && !isRequestCancelled(result.reason)) {
        // Each section is optional; the console keeps the reason for diagnosis.
        console.warn('Home page read failed', result.reason);
      }
    };
    // All three reads start now; none waits on another. The Slate names the
    // date each answered for, so a read that straddled midnight ET is dropped.
    const slateRead = settle(fetchSlate(undefined, { signal, fallback }));
    const edgesRead = settle(fetchSlateEdges({ signal, fallback }));
    const targetsRead = account ? settle(fetchResolvedTargets({ signal, fallback })) : null;
    slateRead.then(warnIfFailed);
    edgesRead.then(warnIfFailed);
    targetsRead?.then(warnIfFailed);

    // The day on screen from the cache, kept here rather than read inside a
    // state updater, so storage writes happen in the order they are made.
    let paintedDate = cached.slateDate;
    const dropPaint = () => {
      clearCache();
      paintedDate = null;
      setState((current) => ({ ...EMPTY, targets: current.targets }));
    };
    // A Slate that failed to read leaves the painted cache alone. Once it has
    // answered, the cache is decided at once, without waiting for Edges: an
    // empty Slate, or one for another day than the painted one, clears it.
    slateRead.then((slate) => {
      if (signal.aborted || slate.status !== 'fulfilled') return;
      const { games, slateDate } = slate.value;
      if (games.length === 0 || (paintedDate !== null && paintedDate !== slateDate)) dropPaint();
    });
    // Games and Targets render as each arrives: a slow Targets read must not
    // hold back the ticker. Edges can only replace the paint, or clear it when
    // they answer null or for another day; a failed Edges read keeps a
    // same-day paint.
    Promise.all([slateRead, edgesRead]).then(([slate, edges]) => {
      if (signal.aborted) return;
      if (slate.status !== 'fulfilled' || slate.value.games.length === 0) return;
      if (edges.status !== 'fulfilled') return;
      const confirmed = edges.value;
      if (confirmed === null || confirmed.slateDate !== slate.value.slateDate) {
        dropPaint();
        return;
      }
      const fresh = {
        games: joinGames(slate.value, confirmed),
        spotlight: confirmed.spotlight,
        slateDate: slate.value.slateDate,
        fallback: slate.value.fallback,
        trailing: slate.value.trailing,
      };
      writeCache(fresh);
      paintedDate = fresh.slateDate;
      setState((current) => ({ ...current, ...fresh }));
    });
    if (targetsRead) {
      Promise.all([slateRead, targetsRead]).then(([slate, resolved]) => {
        if (signal.aborted) return;
        if (resolved.status !== 'fulfilled') return;
        if (slate.status === 'fulfilled' && resolved.value.slateDate !== slate.value.slateDate) {
          return;
        }
        setState((current) => ({ ...current, targets: firingTargets(resolved.value) }));
      });
    }
    return () => controller.abort();
  }, [landing, account]);
  return state;
};
