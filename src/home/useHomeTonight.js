import { useEffect, useState } from 'react';
import { fetchSlate } from '../slateApi';
import { fetchSlateEdges } from '../slateEdgesApi';
import { fetchResolvedTargets } from '../targets/targetsApi';
import { isRequestCancelled } from '../gameLogsApi';

/*
 * What the home page knows about today (crf04/statsplus#204): the Slate's
 * games joined to their Slate Edges, and the reader's firing Targets. Each read
 * stands alone, so a failed one drops only its own section. The three are
 * requested at once with `fallback=previous_game_day` and no date, so each
 * falls back to the most recent game day by itself (crf04/statsplus#217). A
 * backend without the edges route (null) reads like a failure: no ticker, no
 * Tonight.
 *
 * `past` is true when the Slate answered with that fallback day rather than
 * today.
 *
 * `games` is null when there is nothing to show: no edges, no games today, or
 * edges for another date than the Slate's (the reads straddled midnight ET).
 * Targets resolved for another date are dropped the same way.
 *
 * The last public result (games, spotlight, date, past; never Targets) is kept
 * in localStorage and painted on mount before any read answers, then replaced
 * by the fresh one. An unreadable entry is ignored and removed.
 *
 * The Slate and Edges are public (crf04/statsplus#211): `landing` is whether
 * the Query Prompt is on screen. `account` is the uid of a signed-in, admitted
 * reader, or null: only an account reads Targets, and switching accounts
 * rereads, so one reader's Targets never stay on screen for the next.
 */
const EMPTY = { games: null, spotlight: null, slateDate: null, past: false, targets: null };

const CACHE_KEY = 'courtai.homeTonight.v1';

const isGame = (game) =>
  game !== null &&
  typeof game === 'object' &&
  typeof game.gameId === 'string' &&
  typeof game.scheduledAt === 'string' &&
  typeof game.away?.tricode === 'string' &&
  typeof game.home?.tricode === 'string' &&
  Array.isArray(game.effects) &&
  Array.isArray(game.scores) &&
  game.scores.every((pair) => Array.isArray(pair) && pair.length === 2);

const isPick = (pick) => pick === null || typeof pick === 'object';

// The last public result, or EMPTY when there is none or it cannot be trusted.
const readCache = () => {
  try {
    const entry = JSON.parse(window.localStorage.getItem(CACHE_KEY));
    if (entry === null) return EMPTY;
    if (
      typeof entry !== 'object' ||
      !Array.isArray(entry.games) ||
      entry.games.length === 0 ||
      !entry.games.every(isGame) ||
      typeof entry.slateDate !== 'string' ||
      typeof entry.past !== 'boolean' ||
      !entry.spotlight ||
      !isPick(entry.spotlight.best) ||
      !isPick(entry.spotlight.toughest)
    ) {
      clearCache();
      return EMPTY;
    }
    return {
      ...EMPTY,
      games: entry.games.map((game) => ({ ...game, scores: new Map(game.scores) })),
      spotlight: entry.spotlight,
      slateDate: entry.slateDate,
      past: entry.past,
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

const writeCache = ({ games, spotlight, slateDate, past }) => {
  try {
    const stored = games.map((game) => ({ ...game, scores: [...game.scores] }));
    window.localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ games: stored, spotlight, slateDate, past }),
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
    setState(landing ? readCache() : EMPTY);
    if (!landing) {
      return undefined;
    }
    const controller = new AbortController();
    const { signal } = controller;
    const fallback = 'previous_game_day';
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

    // Games and Targets render as each arrives: a slow Targets read must not
    // hold back the ticker.
    Promise.all([slateRead, edgesRead]).then(([slate, edges]) => {
      if (signal.aborted) return;
      // A failed read keeps what is on screen; only an answer replaces it.
      if (slate.status !== 'fulfilled' || edges.status !== 'fulfilled') return;
      if (edges.value !== null && edges.value.slateDate !== slate.value.slateDate) return;
      if (edges.value === null || slate.value.games.length === 0) {
        clearCache();
        setState((current) => ({ ...EMPTY, targets: current.targets }));
        return;
      }
      const fresh = {
        games: joinGames(slate.value, edges.value),
        spotlight: edges.value.spotlight,
        slateDate: slate.value.slateDate,
        past: slate.value.fallback === fallback,
      };
      writeCache(fresh);
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
