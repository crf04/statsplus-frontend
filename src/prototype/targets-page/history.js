/*
 * PROTOTYPE — throwaway. See ./README.md.
 *
 * The season behind every Target, read from the backtest: each qualifying
 * player's games against the opponent, every stat beside that player's own
 * season average. This file turns that into a record (hit rate, mean margin,
 * a chronological list of games, a leaderboard) that the history-first
 * variants lay out in their own ways.
 */
import { useEffect, useState } from 'react';
import { isRequestCancelled } from '../../gameLogsApi';
import { decodeBacktest, fetchTargetBacktest } from '../../targets/targetsApi';
import { PROTO_STANDALONE } from './prototypeMode';
import backtest1 from './mock/backtest-1.json';
import backtest2 from './mock/backtest-2.json';
import backtest3 from './mock/backtest-3.json';

/* Decoded on first use: the shipped page's tests mock the API module without
   this decoder, and this file is loaded by the page they test. */
let mockBacktests = null;
const readMockBacktests = () => {
  if (!mockBacktests) {
    mockBacktests = Object.fromEntries(
      [backtest1, backtest2, backtest3].map((payload) => {
        const backtest = decodeBacktest(payload);
        return [String(backtest.target.id), { status: 'ready', backtest }];
      }),
    );
  }
  return mockBacktests;
};

/*
 * One read per saved Target, all at once. This is the league-wide scan the
 * shipped page keeps behind a disclosure; a history-first page has to pay for
 * it up front, which is part of what these variants are testing.
 */
export const useBacktests = (targets) => {
  const [state, setState] = useState({});
  const ids = targets
    .filter((target) => !target.local)
    .map((target) => String(target.id))
    .join(',');
  useEffect(() => {
    if (PROTO_STANDALONE || !ids) return undefined;
    const controller = new AbortController();
    const list = ids.split(',');
    setState((current) =>
      Object.fromEntries(list.map((id) => [id, current[id] || { status: 'loading' }])),
    );
    // One scan at a time: three league-wide scans in parallel can push the
    // slowest past the client timeout, and the page is fine reading in order.
    (async () => {
      for (const id of list) {
        try {
          const backtest = await fetchTargetBacktest({ id, signal: controller.signal });
          setState((current) => ({ ...current, [id]: { status: 'ready', backtest } }));
        } catch (error) {
          if (isRequestCancelled(error)) return;
          setState((current) => ({ ...current, [id]: { status: 'error' } }));
        }
      }
    })();
    return () => controller.abort();
  }, [ids]);
  return PROTO_STANDALONE ? readMockBacktests() : state;
};

const round1 = (value) => Math.round(value * 10) / 10;

/*
 * A game is a hit on a column when the player beat their own season average
 * for it, a miss when they fell short, and a push when they landed on it.
 */
export const toneOf = (delta) => (delta > 0 ? 'hit' : delta < 0 ? 'miss' : 'push');

export const summarise = (backtest) => {
  const { statColumns, players } = backtest;
  const primary = statColumns[0];
  const games = players
    .flatMap((player) =>
      player.games.map((game) => ({
        player,
        date: game.gameDate,
        stats: game.stats,
        delta: Object.fromEntries(
          statColumns.map((column) => [
            column,
            round1(game.stats[column] - player.seasonAverages[column]),
          ]),
        ),
      })),
    )
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  const columns = statColumns.map((column) => {
    const hits = games.filter((game) => game.delta[column] > 0).length;
    const pushes = games.filter((game) => game.delta[column] === 0).length;
    const mean = games.length
      ? games.reduce((sum, game) => sum + game.delta[column], 0) / games.length
      : 0;
    return {
      column,
      hits,
      pushes,
      misses: games.length - hits - pushes,
      rate: games.length ? hits / games.length : null,
      mean: round1(mean),
      max: Math.max(0, ...games.map((game) => game.delta[column])),
      min: Math.min(0, ...games.map((game) => game.delta[column])),
    };
  });

  const leaderboard = players
    .map((player) => {
      const deltas = player.games.map((game) =>
        round1(game.stats[primary] - player.seasonAverages[primary]),
      );
      return {
        player,
        games: player.games.length,
        hits: deltas.filter((delta) => delta > 0).length,
        mean: round1(deltas.reduce((sum, delta) => sum + delta, 0) / deltas.length),
        lines: player.games.map((game) => ({
          date: game.gameDate,
          value: game.stats[primary],
          delta: round1(game.stats[primary] - player.seasonAverages[primary]),
        })),
      };
    })
    .sort((a, b) => b.mean - a.mean || b.games - a.games);

  return {
    primary,
    games,
    columns,
    leaderboard,
    playerCount: players.length,
    first: games[0]?.date ?? null,
    last: games[games.length - 1]?.date ?? null,
  };
};

export const percent = (rate) => (rate === null ? '—' : `${Math.round(rate * 100)}%`);

export const signedDelta = (delta) => `${delta > 0 ? '+' : ''}${delta.toFixed(1)}`;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const monthDay = (date) => {
  const [, month, day] = date.split('-');
  return `${MONTHS[Number(month) - 1]} ${Number(day)}`;
};

export const monthName = (date) => (date ? MONTHS[Number(date.split('-')[1]) - 1] : '');

/*
 * The season as an axis: from the first of the month the earliest game was
 * played in, to the day the page is read on. Positions are fractions of it.
 */
export const seasonAxis = (dates, endDate) => {
  const sorted = [...dates].sort();
  const firstDate = sorted[0] || endDate;
  const start = new Date(`${firstDate.slice(0, 7)}-01T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  const span = Math.max(1, end - start);
  const position = (date) =>
    Math.min(1, Math.max(0, (new Date(`${date}T00:00:00Z`) - start) / span));
  const ticks = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    const iso = cursor.toISOString().slice(0, 10);
    ticks.push({ date: iso, label: monthName(iso), at: position(iso) });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return { position, ticks, start: firstDate, end: endDate };
};
