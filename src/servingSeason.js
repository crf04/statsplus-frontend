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
  // A trailing family's sample under an explicit Evidence season
  // (crf04/statsplus#330).
  const decodeTeamGames = (value) => {
    if (
      !isRecord(value) ||
      !Number.isInteger(value.min) ||
      !Number.isInteger(value.max) ||
      value.min < 0 ||
      value.min > value.max
    ) {
      throw fail();
    }
    return { min: value.min, max: value.max };
  };
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
            ...(entry.team_games !== undefined && {
              teamGames: decodeTeamGames(entry.team_games),
            }),
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

/*
 * Evidence from a season after the game's own (400 season_after_game,
 * crf04/statsplus#330 AC9): a 2025-26 game has no 2026-27 evidence.
 */
export class SeasonAfterGameError extends Error {
  constructor(error) {
    const failure = error.response.data.error;
    const details = isRecord(failure.details) ? failure.details : {};
    const season = (value) => (typeof value === 'string' && SEASON.test(value) ? value : null);
    super(
      (typeof failure.message === 'string' && failure.message) ||
        'The selected season is after the game.',
      { cause: error },
    );
    this.name = 'SeasonAfterGameError';
    this.response = error.response;
    this.selectedSeason = season(details.selected_season);
    this.gameSeason = season(details.game_season);
  }
}

const REFUSALS = {
  503: { season_unavailable: SeasonUnavailableError },
  400: { season_after_game: SeasonAfterGameError },
};

/** The typed refusal of an Evidence season, any other failure as it is. */
export const seasonRefusalOr = (error) => {
  const failure = error?.response?.data?.error;
  const Refusal = isRecord(failure) && REFUSALS[error.response.status]?.[failure.code];
  return Refusal ? new Refusal(error) : error;
};

export const isSeasonRefusal = (error) =>
  error instanceof SeasonUnavailableError || error instanceof SeasonAfterGameError;

export const gamesPerTeam = ({ min, max }) =>
  `${min === max ? min : `${min}–${max}`} ${max === 1 ? 'game' : 'games'} per team`;

// A trailing season's own sample, never a count borrowed from another input.
export const trailingSample = (teamGames) =>
  teamGames ? gamesPerTeam(teamGames) : 'sample not reported';

const listWords = (words) =>
  words.length < 2 ? words.join('') : `${words.slice(0, -1).join(', ')} and ${words.at(-1)}`;

// One sentence for every trailing family, families that share a season and a
// rule named together: "Scores use 2025-26 team defense and Diets until every
// team has played 10 games." Under an explicit Evidence season each season
// also names its sample, or says it is not reported.
export const trailingNote = (trailing, seasonContext) => {
  if (!trailing?.length) return null;
  const groups = [];
  trailing.forEach(({ family, servingSeason, rule, teamGames }) => {
    const group = groups.find((item) => item.servingSeason === servingSeason && item.rule === rule);
    if (group) group.families.push(FAMILY_WORDS[family]);
    else groups.push({ servingSeason, rule, teamGames, families: [FAMILY_WORDS[family]] });
  });
  const clauses = groups.map(({ servingSeason, rule, teamGames, families }) => {
    const sample = seasonContext ? ` (${trailingSample(teamGames)})` : '';
    return `${servingSeason} ${listWords(families)}${sample} until ${rule}`;
  });
  return `Scores use ${clauses.join(', and ')}.`;
};

// The season a section served, while a trailing family serves it. A past
// game's sections read that game's own season, which differs from the
// season read (the Published Season, or an explicit Evidence season) without
// trailing.
export const trailingSeason = (servedSeason, readSeason, trailing) =>
  servedSeason &&
  servedSeason !== readSeason &&
  trailing?.some((entry) => entry.servingSeason === servedSeason)
    ? servedSeason
    : null;

// An Unpublished Season choice (crf04/statsplus#330) names its sample so a
// reader can see how little it rests on: "2026-27 · early, 2–4 games per team".
export const seasonChoiceLabel = ({ season, mode, teamGames }) => {
  if (mode !== 'unpublished') return season;
  return teamGames ? `${season} · early, ${gamesPerTeam(teamGames)}` : `${season} · early`;
};

export const seasonUnavailableText = (season) =>
  season ? `${season} isn't available yet.` : "This season isn't available yet.";

export const seasonAfterGameText = (season, gameSeason) =>
  season && gameSeason
    ? `This is a ${gameSeason} game, so it has no ${season} evidence.`
    : 'This game was played before the selected season, so it has no evidence from it.';
