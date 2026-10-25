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
    // An explicit Evidence season choice (crf04/statsplus#330) names the
    // season it read and the Published Season beside it. A response to an
    // omitted season carries neither.
    decodeSeasonContext: (value) => {
      if (value === undefined) return undefined;
      if (
        !isRecord(value) ||
        typeof value.selected_season !== 'string' ||
        typeof value.published_season !== 'string'
      ) {
        throw fail();
      }
      return {
        selectedSeason: decodeSeason(value.selected_season),
        publishedSeason: decodeSeason(value.published_season),
      };
    },
  };
};

/*
 * A season the backend does not offer yet (503 season_unavailable,
 * crf04/statsplus#330) is refused rather than answered from another season.
 * The refusal names the season asked for and the Published Season when the
 * backend says them. It keeps the response so the existing messages and
 * request references read it unchanged.
 */
export class SeasonUnavailableError extends Error {
  constructor(error) {
    const failure = error.response.data.error;
    const details = isRecord(failure.details) ? failure.details : {};
    const season = (value) => (typeof value === 'string' && SEASON.test(value) ? value : null);
    super(
      (typeof failure.message === 'string' && failure.message) ||
        'The requested season is unavailable.',
      { cause: error },
    );
    this.name = 'SeasonUnavailableError';
    this.response = error.response;
    this.selectedSeason = season(details.selected_season);
    this.publishedSeason = season(details.published_season);
  }
}

/** The typed refusal for a 503 season_unavailable, any other failure as it is. */
export const seasonUnavailableOr = (error) => {
  const failure = error?.response?.data?.error;
  return error?.response?.status === 503 &&
    isRecord(failure) &&
    failure.code === 'season_unavailable'
    ? new SeasonUnavailableError(error)
    : error;
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

// The season a section served, while a trailing family serves it. A past
// game's sections read that game's own season, which differs from the
// Published Season without trailing.
export const trailingSeason = (servedSeason, publishedSeason, trailing) =>
  servedSeason &&
  servedSeason !== publishedSeason &&
  trailing?.some((entry) => entry.servingSeason === servedSeason)
    ? servedSeason
    : null;

const gamesPerTeam = ({ min, max }) =>
  `${min === max ? min : `${min}–${max}`} ${max === 1 ? 'game' : 'games'} per team`;

// An Unpublished Season choice (crf04/statsplus#330) names its sample so a
// reader can see how little it rests on: "2026-27 · early, 2–4 games per team".
export const seasonChoiceLabel = ({ season, mode, teamGames }) => {
  if (mode !== 'unpublished') return season;
  return teamGames ? `${season} · early, ${gamesPerTeam(teamGames)}` : `${season} · early`;
};

export const seasonUnavailableText = (season) =>
  season ? `${season} isn't available yet.` : "This season isn't available yet.";
