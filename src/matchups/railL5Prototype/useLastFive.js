// PROTOTYPE — throwaway. The rail has no recent games, so each row reads the
// player's season game logs (the same request the Log Workspace makes).
import { useEffect, useState } from 'react';
import { fetchGameLogsData } from '../../gameLogsApi';

const cache = new Map();

const COMBOS = {
  PRA: ['PTS', 'REB', 'AST'],
  PR: ['PTS', 'REB'],
  PA: ['PTS', 'AST'],
  RA: ['REB', 'AST'],
  STKS: ['STL', 'BLK'],
};
const statOf = (row, stat) =>
  typeof row[stat] === 'number'
    ? row[stat]
    : COMBOS[stat]
      ? COMBOS[stat].reduce((sum, key) => sum + (row[key] ?? 0), 0)
      : null;

export const useLastFive = (playerName, season, stat) => {
  const key = `${playerName}|${season ?? ''}`;
  const [rows, setRows] = useState(() => cache.get(key) ?? null);
  useEffect(() => {
    if (cache.has(key)) {
      setRows(cache.get(key));
      return;
    }
    let live = true;
    fetchGameLogsData({ player_name: playerName, ...(season ? { season_filter: season } : {}) })
      .then((data) => {
        const sorted = [...data.gameLogs].sort((a, b) =>
          String(b.GAME_DATE).localeCompare(String(a.GAME_DATE)),
        );
        cache.set(key, sorted);
        if (live) setRows(sorted);
      })
      .catch(() => live && setRows([]));
    return () => {
      live = false;
    };
  }, [key, playerName, season]);
  if (rows === null) return null;
  // Oldest → newest, left to right.
  return rows
    .slice(0, 5)
    .map((row) => ({
      date: row.GAME_DATE,
      matchup: row.MATCHUP,
      value: statOf(row, stat),
    }))
    .filter((game) => game.value !== null)
    .reverse();
};
