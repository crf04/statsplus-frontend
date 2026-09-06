/*
 * PROTOTYPE — throwaway. See ./README.md.
 *
 * The stats a reader can choose to see. The backend's Backtest carries only
 * the proxy columns its Qualifiers map to; the box score behind those games
 * has the rest. The standalone build reads the box score captured from the
 * production database (2025-26, regular season) for every player in each
 * Target's Backtest, with season averages computed from all their games. A
 * signed-in build has no such read yet, so it can only offer the proxies.
 */
import { useState } from 'react';
import { summarise } from './history';
import box1 from './mock/box-1.json';
import box2 from './mock/box-2.json';
import box3 from './mock/box-3.json';

const BOXES = { 1: box1, 2: box2, 3: box3 };

export const STAT_CATALOGUE = [
  ['PTS', 'points'],
  ['REB', 'rebounds'],
  ['AST', 'assists'],
  ['3PM', 'threes made'],
  ['3PA', 'threes attempted'],
  ['FGM', 'field goals made'],
  ['FGA', 'field goals attempted'],
  ['FTM', 'free throws made'],
  ['FTA', 'free throws attempted'],
  ['STL', 'steals'],
  ['BLK', 'blocks'],
  ['TOV', 'turnovers'],
  ['OREB', 'offensive rebounds'],
  ['DREB', 'defensive rebounds'],
  ['PF', 'fouls'],
  ['MIN', 'minutes'],
  ['PA', 'points + assists'],
  ['PR', 'points + rebounds'],
  ['RA', 'rebounds + assists'],
  ['PRA', 'points + rebounds + assists'],
  ['SB', 'steals + blocks'],
];

export const boxFor = (targetId) => BOXES[String(targetId)] || null;

/*
 * The Backtest with the chosen stat columns in place of the proxies: every
 * player's games and season averages carry the chosen stats where the box
 * score has them, and the summary is recomputed for those columns. A stat
 * the box score does not have for a player reads as the proxy value if it is
 * one, else the player is left out of that column's games.
 */
export const withStats = (backtest, box, shown) => {
  if (!backtest) return null;
  const columns = shown.filter(
    (name) => backtest.statColumns.includes(name) || box?.stats.includes(name),
  );
  if (columns.length === 0) return backtest;
  const players = backtest.players
    .map((player) => {
      const entry = box?.players[String(player.canonicalId)];
      const seasonAverages = Object.fromEntries(
        columns.map((name) => [name, player.seasonAverages[name] ?? entry?.season[name] ?? null]),
      );
      if (Object.values(seasonAverages).some((value) => value === null)) return null;
      const games = player.games
        .map((game) => {
          const line = entry?.games[game.gameDate];
          const stats = Object.fromEntries(
            columns.map((name) => [name, game.stats[name] ?? line?.[name] ?? null]),
          );
          if (Object.values(stats).some((value) => value === null)) return null;
          return { ...game, stats };
        })
        .filter(Boolean);
      return games.length ? { ...player, seasonAverages, games } : null;
    })
    .filter(Boolean);
  const draft = { ...backtest, statColumns: columns, players };
  const record = summarise(draft);
  return {
    ...draft,
    summary: {
      players: players.length,
      games: record.games.length,
      columns: Object.fromEntries(
        record.columns.map((column) => [
          column.column,
          { meanDifference: column.mean, overAverageShare: column.rate },
        ]),
      ),
    },
  };
};

/*
 * Which stats are shown and which one the grid is graded by. Starts on the
 * proxies the backend sent; the reader adds and drops stats from there.
 */
export const useShownStats = (backtest, boxId) => {
  const box = boxFor(boxId);
  const [shown, setShown] = useState(null);
  const [graded, setGraded] = useState(null);
  const proxies = backtest?.statColumns || [];
  const chosen = shown || proxies;
  const available = box ? STAT_CATALOGUE.map(([name]) => name) : proxies;
  const shownBacktest = withStats(backtest, box, chosen);
  const columns = shownBacktest?.statColumns || [];
  const column = columns.includes(graded) ? graded : columns[0];
  const toggle = (name) => {
    const next = chosen.includes(name) ? chosen.filter((item) => item !== name) : [...chosen, name];
    if (next.length === 0) return;
    setShown(next);
  };
  return {
    backtest: shownBacktest,
    shown: columns,
    available,
    canChoose: Boolean(box),
    toggle,
    column,
    setColumn: setGraded,
  };
};
