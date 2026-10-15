/*
 * PROTOTYPE — throwaway. The two reads a home preview would need: the Slate
 * and the day's resolved Targets, through the real decoders. Matchup edges
 * come from a captured digest; a real build would need a slate-wide endpoint.
 */
import { useEffect, useState } from 'react';
import { fetchSlate } from '../slateApi';
import { fetchResolvedTargets } from '../targets/targetsApi';
import edges from './mock/edges.json';
import { DEMO_DATE } from './prototypeMode';

const MARKETS = ['PTS', 'REB', 'AST', '3PM'];

const edgesByGame = new Map(edges.games.map((game) => [game.gameId, game.players]));

/* A player's single best market: the one with the largest positive score. */
const bestMarket = (player) =>
  MARKETS.map((market) => ({ market, value: player.scores[market] }))
    .filter((entry) => entry.value !== null)
    .sort((a, b) => b.value - a.value)[0] || null;

export const topEdges = (gameId, { market = 'PTS', limit = 3, tricode } = {}) =>
  (edgesByGame.get(gameId) || [])
    .filter((player) => (tricode ? player.tricode === tricode : true))
    .filter((player) => player.scores[market] !== null && (player.ppg ?? 0) >= 8)
    .sort((a, b) => b.scores[market] - a.scores[market])
    .slice(0, limit)
    .map((player) => ({ ...player, market, value: player.scores[market] }));

/* The largest PTS Matchup Scores in a game by size, either sign. The 8 PPG
   floor keeps deep-bench players' noisy scores off the ticker. */
export const biggestPtsEffects = (gameId, limit = 3) =>
  (edgesByGame.get(gameId) || [])
    .filter((player) => player.scores.PTS !== null && (player.ppg ?? 0) >= 8)
    .sort((a, b) => Math.abs(b.scores.PTS) - Math.abs(a.scores.PTS))
    .slice(0, limit)
    .map((player) => ({ ...player, value: player.scores.PTS }));

export const bestEdgeInGame = (gameId) =>
  (edgesByGame.get(gameId) || [])
    .filter((player) => (player.ppg ?? 0) >= 10)
    .map((player) => ({ ...player, ...bestMarket(player) }))
    .filter((player) => player.market)
    .sort((a, b) => b.value - a.value)[0] || null;

export const useHomePreviewData = () => {
  const [state, setState] = useState({ slate: null, targets: null, error: null });
  useEffect(() => {
    let live = true;
    Promise.all([fetchSlate(DEMO_DATE), fetchResolvedTargets({ date: DEMO_DATE })])
      .then(([slate, resolved]) => {
        if (!live) return;
        const firing = resolved.entries
          .filter((entry) => entry.game && entry.players.length > 0)
          .sort((a, b) => b.players.length - a.players.length);
        setState({ slate, targets: { firing, total: resolved.entries.length }, error: null });
      })
      .catch((error) => live && setState((s) => ({ ...s, error: error.message })));
    return () => {
      live = false;
    };
  }, []);
  return state;
};
