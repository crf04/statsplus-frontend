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
import { applyConditions } from './conditions';
import { useStatPrefs } from './statPrefs';
import box1 from './mock/box-1.json';
import box2 from './mock/box-2.json';
import box3 from './mock/box-3.json';

const BOXES = { 1: box1, 2: box2, 3: box3 };

/*
 * Beyond the box score: the same stats per 36 minutes, and shooting
 * efficiency, for a read that a big night of minutes cannot inflate. A game
 * is rated from its own line; a season from the ratio of the season
 * averages, which is the ratio of the totals.
 */
const per36 = (name) => (line) => (line.MIN > 0 ? (line[name] / line.MIN) * 36 : null);
const ratio = (top, bottom) => (line) =>
  line[bottom] > 0 ? (line[top] / line[bottom]) * 100 : null;

export const DERIVED = {
  'PTS/36': per36('PTS'),
  'REB/36': per36('REB'),
  'AST/36': per36('AST'),
  '3PM/36': per36('3PM'),
  '3PA/36': per36('3PA'),
  'FGA/36': per36('FGA'),
  'FTA/36': per36('FTA'),
  'STL/36': per36('STL'),
  'BLK/36': per36('BLK'),
  'TOV/36': per36('TOV'),
  'PRA/36': per36('PRA'),
  'PR/36': per36('PR'),
  'PA/36': per36('PA'),
  'FG%': ratio('FGM', 'FGA'),
  '3P%': ratio('3PM', '3PA'),
  'TS%': (line) => {
    const attempts = line.FGA + 0.44 * line.FTA;
    return attempts > 0 ? (line.PTS / (2 * attempts)) * 100 : null;
  },
  'PTS/FGA': (line) => (line.FGA > 0 ? line.PTS / line.FGA : null),
};

export const STAT_GROUPS = [
  { key: 'box', label: 'Box score' },
  { key: 'per36', label: 'Per 36 minutes' },
  { key: 'eff', label: 'Efficiency' },
];

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
  ['PTS/36', 'points per 36', 'per36'],
  ['REB/36', 'rebounds per 36', 'per36'],
  ['AST/36', 'assists per 36', 'per36'],
  ['3PM/36', 'threes per 36', 'per36'],
  ['3PA/36', 'three attempts per 36', 'per36'],
  ['FGA/36', 'attempts per 36', 'per36'],
  ['FTA/36', 'free throw attempts per 36', 'per36'],
  ['STL/36', 'steals per 36', 'per36'],
  ['BLK/36', 'blocks per 36', 'per36'],
  ['TOV/36', 'turnovers per 36', 'per36'],
  ['PRA/36', 'P+R+A per 36', 'per36'],
  ['PR/36', 'P+R per 36', 'per36'],
  ['PA/36', 'P+A per 36', 'per36'],
  ['FG%', 'field goal %', 'eff'],
  ['3P%', 'three point %', 'eff'],
  ['TS%', 'true shooting %', 'eff'],
  ['PTS/FGA', 'points per attempt', 'eff'],
];

const round1 = (value) => (value === null ? null : Math.round(value * 10) / 10);

/* A stat for one line: straight from the box score, or derived from it. */
const statOf = (name, line) => {
  if (!line) return null;
  if (DERIVED[name]) return round1(DERIVED[name](line));
  return line[name] ?? null;
};

export const boxFor = (targetId) => BOXES[String(targetId)] || null;

/*
 * The Backtest with the chosen stat columns in place of the proxies: every
 * player's games and season averages carry the chosen stats where the box
 * score has them, and the summary is recomputed for those columns. A stat
 * the box score does not have for a player reads as the proxy value if it is
 * one, else the player is left out of that column's games.
 */
const recount = (backtest) => {
  const record = summarise(backtest);
  return {
    ...backtest,
    summary: {
      players: backtest.players.length,
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

export const withStats = (backtest, box, shown) => {
  if (!backtest) return null;
  const columns = shown.filter(
    (name) =>
      backtest.statColumns.includes(name) || box?.stats.includes(name) || (box && DERIVED[name]),
  );
  if (columns.length === 0) return recount(backtest);
  const players = backtest.players
    .map((player) => {
      const entry = box?.players[String(player.canonicalId)];
      const seasonAverages = Object.fromEntries(
        columns.map((name) => [
          name,
          player.seasonAverages[name] ?? statOf(name, entry?.season) ?? null,
        ]),
      );
      if (Object.values(seasonAverages).some((value) => value === null)) return null;
      const games = player.games
        .map((game) => {
          const line = entry?.games[game.gameDate];
          const stats = Object.fromEntries(
            columns.map((name) => [name, game.stats[name] ?? statOf(name, line) ?? null]),
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
export const useShownStats = (backtest, boxId, conditions = null) => {
  const box = boxFor(boxId);
  const filtered = applyConditions(backtest, conditions);
  // A saved Target's choice sticks to the Target; a draft's lives with the draft.
  const prefs = useStatPrefs(boxId);
  const [localShown, setLocalShown] = useState(null);
  const [localGraded, setLocalGraded] = useState(null);
  const shown = boxId ? prefs.shown : localShown;
  const setShown = boxId ? prefs.setShown : setLocalShown;
  const graded = boxId ? prefs.column : localGraded;
  const setGraded = boxId ? prefs.setColumn : setLocalGraded;
  const proxies = filtered?.statColumns || [];
  const chosen = shown || proxies;
  const available = box ? STAT_CATALOGUE.map(([name]) => name) : proxies;
  const shownBacktest = withStats(filtered, box, chosen);
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
