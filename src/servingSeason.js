import { isRecord } from './decoding';

/*
 * Serving Seasons (crf04/statsplus#304). Each Matchup input reads from its own
 * season: the Published Season, or the previous one while its family is
 * trailing. A Matchup section window names the season it served and, for a
 * Last 15 window under 15 games, how many games it covers. Matchup and Slate
 * responses list the trailing families. All three fields are additive, so a
 * backend that predates them leaves them undefined.
 */
const SEASON = /^\d{4}-\d{2}$/;

const FAMILY_WORDS = {
  team_defense: 'team defense',
  player_diets: 'Diets',
  synergy: 'play types',
};

export const servingSeasonDecoders = (fail) => {
  const decodeSeason = (value) => {
    if (value === undefined || value === null) return value;
    if (typeof value !== 'string' || !SEASON.test(value)) throw fail();
    return value;
  };
  return {
    decodeSeason,
    decodeWindowGames: (value) => {
      if (value === undefined || value === null) return value;
      if (!Number.isInteger(value) || value < 0) throw fail();
      return value;
    },
    // A family this build has no words for is left out of the note rather
    // than refusing the whole response.
    decodeTrailing: (value) => {
      if (value === undefined) return undefined;
      if (!Array.isArray(value)) throw fail();
      return value
        .map((entry) => {
          if (
            !isRecord(entry) ||
            typeof entry.family !== 'string' ||
            typeof entry.rule !== 'string' ||
            !entry.rule ||
            typeof entry.serving_season !== 'string'
          ) {
            throw fail();
          }
          return {
            family: entry.family,
            servingSeason: decodeSeason(entry.serving_season),
            rule: entry.rule,
          };
        })
        .filter((entry) => Object.hasOwn(FAMILY_WORDS, entry.family));
    },
  };
};

const listWords = (words) =>
  words.length < 2 ? words.join('') : `${words.slice(0, -1).join(', ')} and ${words.at(-1)}`;

// One sentence for every trailing family, families that share a season and a
// rule named together: "Scores use 2025-26 team defense and Diets until every
// team has played 10 games."
export const trailingNote = (trailing) => {
  if (!trailing?.length) return null;
  const groups = [];
  trailing.forEach(({ family, servingSeason, rule }) => {
    const group = groups.find((item) => item.servingSeason === servingSeason && item.rule === rule);
    if (group) group.families.push(FAMILY_WORDS[family]);
    else groups.push({ servingSeason, rule, families: [FAMILY_WORDS[family]] });
  });
  const clauses = groups.map(
    ({ servingSeason, rule, families }) => `${servingSeason} ${listWords(families)} until ${rule}`,
  );
  return `Scores use ${clauses.join(', and ')}.`;
};

// The season a section served, when it differs from the Published Season.
export const trailingSeason = (servedSeason, publishedSeason) =>
  servedSeason && publishedSeason && servedSeason !== publishedSeason ? servedSeason : null;
