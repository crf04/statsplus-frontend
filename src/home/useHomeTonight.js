import { useEffect, useState } from 'react';
import { fetchSlate } from '../slateApi';
import { fetchSlateEdges } from '../slateEdgesApi';
import { fetchResolvedTargets } from '../targets/targetsApi';
import { isRequestCancelled } from '../gameLogsApi';

/*
 * What the home page knows about today (crf04/statsplus#204): the Slate's
 * games joined to their Slate Edges, and the reader's firing Targets. Each read
 * stands alone, so a failed one drops only its own section. The Slate is read
 * first so Edges and Targets are requested for its date. A backend without
 * the edges route (null) reads like a failure: no ticker, no Tonight.
 *
 * `past` is true when that is the most recent game day rather than today.
 *
 * `games` is null when there is nothing to show: no edges, no games today, or
 * edges for another date than the Slate's (the reads straddled midnight ET).
 * Targets resolved for another date are dropped the same way.
 *
 * `account` is the signed-in uid, or null when signed out: switching accounts
 * rereads, so one reader's Targets never stay on screen for the next.
 */
const EMPTY = { games: null, spotlight: null, slateDate: null, past: false, targets: null };

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

export const useHomeTonight = (account) => {
  const [state, setState] = useState(EMPTY);
  useEffect(() => {
    setState(EMPTY);
    if (!account) {
      return undefined;
    }
    const controller = new AbortController();
    const { signal } = controller;
    const settle = (promise) =>
      promise.then(
        (value) => ({ status: 'fulfilled', value }),
        (reason) => ({ status: 'rejected', reason }),
      );
    // The Slate names the date; Edges and Targets are read for that same date,
    // so the three never straddle midnight ET.
    // A day with no games shows the most recent game day instead, so the page
    // always has a slate to show (crf04/statsplus#204, amended edge state).
    const slateToShow = async () => {
      const today = await settle(fetchSlate(undefined, { signal }));
      const earlier =
        today.status === 'fulfilled' &&
        today.value.games.length === 0 &&
        today.value.previousGameDate;
      if (!earlier) return { slate: today, past: false };
      return { slate: await settle(fetchSlate(earlier, { signal })), past: true };
    };
    const warnIfFailed = (result) => {
      if (result.status === 'rejected' && result.reason && !isRequestCancelled(result.reason)) {
        // Each section is optional; the console keeps the reason for diagnosis.
        console.warn('Home page read failed', result.reason);
      }
    };
    slateToShow().then(({ slate, past }) => {
      if (signal.aborted) return;
      warnIfFailed(slate);
      const slateDate = slate.status === 'fulfilled' ? slate.value.slateDate : null;
      // Games and Targets render as each arrives: a slow Targets read must not
      // hold back the ticker.
      if (slateDate !== null && slate.value.games.length > 0) {
        settle(fetchSlateEdges({ date: slateDate, signal })).then((edges) => {
          if (signal.aborted) return;
          warnIfFailed(edges);
          if (edges.status !== 'fulfilled' || edges.value === null) return;
          if (edges.value.slateDate !== slateDate) return;
          setState((current) => ({
            ...current,
            games: joinGames(slate.value, edges.value),
            spotlight: edges.value.spotlight,
            slateDate,
            past,
          }));
        });
      }
      settle(fetchResolvedTargets({ date: slateDate ?? undefined, signal })).then((resolved) => {
        if (signal.aborted) return;
        warnIfFailed(resolved);
        if (resolved.status !== 'fulfilled') return;
        if (slateDate !== null && resolved.value.slateDate !== slateDate) return;
        setState((current) => ({ ...current, targets: firingTargets(resolved.value) }));
      });
    });
    return () => controller.abort();
  }, [account]);
  return state;
};
