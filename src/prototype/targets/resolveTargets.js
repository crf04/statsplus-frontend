/*
 * PROTOTYPE — throwaway. Resolves in-memory Targets client-side against the
 * real slate and real matchup payloads, so the players and the defensive
 * context are live data. The backtest is a stub: no endpoint exists yet.
 */
import { useEffect, useMemo, useState } from 'react';
import { decodeSlate, fetchSlate as fetchLiveSlate } from '../../slateApi';
import { decodeMatchup, fetchMatchup as fetchLiveMatchup } from '../../matchups/matchupApi';
import { THIN_VOLUME, baseOf, marketsFor } from './catalog';
import { DEMO_DATE, PROTO_STANDALONE } from './prototypeMode';
import mockSlate from './mock/slate.json';
import mock1172 from './mock/matchup-0022501172.json';
import mock1174 from './mock/matchup-0022501174.json';
import mock1182 from './mock/matchup-0022501182.json';

/* Standalone build: captured production payloads for 2026-04-10, decoded by
   the real decoders. No sign-in, no network. Other dates are empty slates. */
const MOCK_MATCHUPS = { '0022501172': mock1172, '0022501174': mock1174, '0022501182': mock1182 };
const fetchSlate = (date) =>
  PROTO_STANDALONE
    ? Promise.resolve(
        decodeSlate(date === DEMO_DATE ? mockSlate : { ...mockSlate, slate_date: date, games: [] }),
      )
    : fetchLiveSlate(date);
const fetchMatchup = (gameId) =>
  PROTO_STANDALONE
    ? MOCK_MATCHUPS[gameId]
      ? Promise.resolve(decodeMatchup(MOCK_MATCHUPS[gameId]))
      : Promise.reject(new Error('no mock for this game'))
    : fetchLiveMatchup(gameId);

const matchupCache = new Map();
const loadMatchup = (gameId) => {
  if (!matchupCache.has(gameId)) {
    matchupCache.set(
      gameId,
      fetchMatchup(gameId).catch((error) => {
        matchupCache.delete(gameId);
        throw error;
      }),
    );
  }
  return matchupCache.get(gameId);
};

export const gameFor = (slate, opponent) =>
  slate?.games.find((game) => game.away.tricode === opponent || game.home.tricode === opponent) ||
  null;

const shareEntry = (player, q) =>
  player.dietShares[baseOf(q.base).key]?.find((entry) => entry.key === q.sliceKey)?.season || null;

const meets = (entry, q) => {
  if (!entry) return false;
  return q.comparator === 'at_or_above' ? entry.share >= q.threshold : entry.share <= q.threshold;
};

const isThin = (entry, q) =>
  !entry || entry.gamesPlayed < 10 || entry.volumePerGame < THIN_VOLUME[baseOf(q.base).key];

/* Every defense-sheet row for the slice, so the context is what the sheet shows. */
const contextRows = (team, q) =>
  (team?.defenseSheet[baseOf(q.base).key] || []).filter((row) => row.sliceKey === q.sliceKey);

export const evaluate = (target, game, matchup) => {
  if (!game) return { target, game: null, players: [], context: [], availability: 'idle' };
  if (!matchup) return { target, game, players: [], context: [], availability: 'loading' };
  const opponentTeam = matchup.teams.find((team) => team.tricode === target.opponent);
  const opposingTeam = matchup.teams.find((team) => team.tricode !== target.opponent);
  const historical = matchup.experience.mode === 'historical';
  const poolOk = historical
    ? matchup.experience.sections.participants.status === 'available'
    : !['missing', 'unavailable'].includes(matchup.freshness.pool.status);
  const context = target.qualifiers.map((q) => ({
    qualifier: q,
    rows: contextRows(opponentTeam, q),
  }));
  const players = poolOk
    ? matchup.players
        .filter((player) => player.teamId === opposingTeam?.teamId)
        .map((player) => {
          const shares = target.qualifiers.map((q) => {
            const entry = shareEntry(player, q);
            return { qualifier: q, entry, meets: meets(entry, q), thin: isThin(entry, q) };
          });
          return {
            player,
            shares,
            fits: shares.every((s) => s.meets),
            thin: shares.some((s) => s.thin),
          };
        })
        .filter((row) => row.fits)
        .sort((a, b) => (b.player.seasonScoring ?? -1) - (a.player.seasonScoring ?? -1))
    : [];
  return {
    target,
    game,
    matchup,
    opponentTeam,
    opposingTeam,
    context,
    players,
    availability: poolOk ? 'available' : 'unavailable',
    poolSize: matchup.players.filter((p) => p.teamId === opposingTeam?.teamId).length,
  };
};

/* League-average share for a slice, read off any player in the payload. */
export const leagueAverageShare = (players, base, sliceKey) => {
  for (const player of players) {
    const entry = player.dietShares[baseOf(base).key]?.find((e) => e.key === sliceKey)?.season;
    if (entry && entry.leagueAverageShare !== null) return entry.leagueAverageShare;
  }
  return null;
};

export const useResolvedTargets = (date, targets) => {
  const [slateState, setSlateState] = useState({ status: 'loading', slate: null, error: null });
  const [matchups, setMatchups] = useState({});
  useEffect(() => {
    let live = true;
    if (!date) {
      setSlateState({ status: 'idle', slate: null, error: null });
      return undefined;
    }
    setSlateState({ status: 'loading', slate: null, error: null });
    fetchSlate(date)
      .then((slate) => live && setSlateState({ status: 'ready', slate, error: null }))
      .catch((error) => live && setSlateState({ status: 'error', slate: null, error }));
    return () => {
      live = false;
    };
  }, [date]);
  const gameIds = useMemo(
    () =>
      slateState.slate
        ? [
            ...new Set(
              targets.map((t) => gameFor(slateState.slate, t.opponent)?.gameId).filter(Boolean),
            ),
          ]
        : [],
    [slateState.slate, targets],
  );
  useEffect(() => {
    let live = true;
    gameIds.forEach((gameId) => {
      if (matchups[gameId]) return;
      loadMatchup(gameId)
        .then((matchup) => live && setMatchups((prev) => ({ ...prev, [gameId]: matchup })))
        .catch(() => live && setMatchups((prev) => ({ ...prev, [gameId]: { failed: true } })));
    });
    return () => {
      live = false;
    };
  }, [gameIds]); // eslint-disable-line react-hooks/exhaustive-deps
  const results = useMemo(
    () =>
      targets.map((target) => {
        const game = gameFor(slateState.slate, target.opponent);
        const matchup = game ? matchups[game.gameId] : null;
        if (matchup?.failed)
          return { target, game, players: [], context: [], availability: 'error' };
        return evaluate(target, game, matchup);
      }),
    [targets, slateState.slate, matchups],
  );
  return {
    ...slateState,
    results,
    live: results.filter((r) => r.game),
    idle: results.filter((r) => !r.game),
  };
};

/* ---- Backtest stub ------------------------------------------------------ */
// Synthetic. Deterministic per player so the rows are stable while reviewing
// the layout. Replace with the real read from statsplus-backend#246.
const noise = (seed, i) => 0.65 + ((seed * 7 + i * 13) % 70) / 100;
export const stubBacktest = (result) => {
  const markets = [
    ...new Set(result.target.qualifiers.flatMap((q) => marketsFor(q.base, q.sliceKey))),
  ];
  const baseline = { PTS: (p) => p.seasonScoring ?? 12, '3PM': () => 2.1, AST: () => 4.2 };
  const rows = result.players
    .filter((row) => !row.thin)
    .map(({ player, shares }) => {
      const gameCount = 2 + (player.id % 2);
      const season = Object.fromEntries(markets.map((m) => [m, baseline[m](player)]));
      const games = Array.from({ length: gameCount }, (_, i) => ({
        date: `2026-0${1 + i}-${10 + ((player.id + i) % 18)}`,
        stats: Object.fromEntries(
          markets.map((m) => [m, Math.round(season[m] * noise(player.id, i + m.length) * 10) / 10]),
        ),
      }));
      return { player, shares, season, games };
    });
  return {
    markets,
    rows,
    proxy: 'Outcomes are box-score proxies; there are no per-game slice splits.',
  };
};
