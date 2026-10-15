import { useEffect, useState } from 'react';
import { fetchSlate } from '../slateApi';
import { fetchSlateEdges } from '../slateEdgesApi';
import { fetchResolvedTargets } from '../targets/targetsApi';
import { isRequestCancelled } from '../gameLogsApi';

/*
 * What the home page knows about today (crf04/statsplus#204): the Slate's
 * games joined to their Slate Edges, and the reader's firing Targets. Each read
 * stands alone, so a failed one drops only its own section. A backend without
 * the edges route (null) reads like a failure: no ticker, no Tonight.
 *
 * `games` is null when there is nothing to show: no edges, or no games today.
 */
const EMPTY = { games: null, spotlight: null, slateDate: null, targets: null };

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

export const useHomeTonight = (enabled) => {
  const [state, setState] = useState(EMPTY);
  useEffect(() => {
    if (!enabled) {
      setState(EMPTY);
      return undefined;
    }
    const controller = new AbortController();
    const { signal } = controller;
    Promise.allSettled([
      fetchSlate(undefined, { signal }),
      fetchSlateEdges({ signal }),
      fetchResolvedTargets({ signal }),
    ]).then(([slate, edges, resolved]) => {
      if (signal.aborted) return;
      const failed = (result) => result.status === 'rejected' && !isRequestCancelled(result.reason);
      [slate, edges, resolved].filter(failed).forEach((result) => {
        // Each section is optional; the console keeps the reason for diagnosis.
        console.warn('Home page read failed', result.reason);
      });
      const hasGames =
        slate.status === 'fulfilled' &&
        edges.status === 'fulfilled' &&
        edges.value !== null &&
        slate.value.games.length > 0;
      setState({
        games: hasGames ? joinGames(slate.value, edges.value) : null,
        spotlight: hasGames ? edges.value.spotlight : null,
        slateDate: hasGames ? slate.value.slateDate : null,
        targets: resolved.status === 'fulfilled' ? firingTargets(resolved.value) : null,
      });
    });
    return () => controller.abort();
  }, [enabled]);
  return state;
};
