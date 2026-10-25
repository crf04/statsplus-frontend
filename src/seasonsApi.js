import { apiClient, getApiUrl } from './config';
import { isRecord } from './decoding';

const SEASON_PATTERN = /^\d{4}-\d{2}$/;
const CHOICE_MODES = ['published', 'retained', 'unpublished'];
const FAMILY_STATES = ['serving', 'trailing', 'unavailable'];
const FAMILY_REASONS = [
  'window_not_ready',
  'season_not_composed',
  'readiness_not_met',
  'upstream_missing',
];

const invalidSeasons = () => new Error('The seasons endpoint returned an invalid response.');
const isSeason = (value) => typeof value === 'string' && SEASON_PATTERN.test(value);
const isGameCount = (value) => Number.isInteger(value) && value >= 0;

// A family serves no season exactly when it is unavailable.
const decodeFamily = (family) => {
  if (
    !isRecord(family) ||
    !FAMILY_STATES.includes(family.state) ||
    (family.state === 'unavailable'
      ? family.served_season !== null
      : !isSeason(family.served_season)) ||
    (family.reason !== undefined && !FAMILY_REASONS.includes(family.reason))
  ) {
    throw invalidSeasons();
  }
  return {
    servedSeason: family.served_season,
    state: family.state,
    reason: family.reason ?? null,
  };
};

const decodeTeamGames = (teamGames) => {
  if (teamGames === undefined) return null;
  if (
    !isRecord(teamGames) ||
    !isGameCount(teamGames.min) ||
    !isGameCount(teamGames.max) ||
    teamGames.min > teamGames.max
  ) {
    throw invalidSeasons();
  }
  return { min: teamGames.min, max: teamGames.max };
};

/*
 * Each season a reader can choose and what it serves (crf04/statsplus#330):
 * whether it is the Published Season, a retained one or one not yet published,
 * the season each family reads under it, and the fewest and most games any
 * team has played. A backend that predates the list leaves it undefined.
 */
const decodeChoices = (choices) => {
  if (choices === undefined) return undefined;
  if (!Array.isArray(choices)) throw invalidSeasons();
  const decoded = choices.map((choice) => {
    if (
      !isRecord(choice) ||
      !isSeason(choice.season) ||
      !CHOICE_MODES.includes(choice.mode) ||
      !isRecord(choice.families)
    ) {
      throw invalidSeasons();
    }
    return {
      season: choice.season,
      mode: choice.mode,
      families: Object.fromEntries(
        Object.entries(choice.families).map(([family, value]) => [family, decodeFamily(value)]),
      ),
      teamGames: decodeTeamGames(choice.team_games),
    };
  });
  if (new Set(decoded.map((choice) => choice.season)).size !== decoded.length) {
    throw invalidSeasons();
  }
  return decoded;
};

export const decodeSeasons = (data) => {
  if (
    !data ||
    !Array.isArray(data.seasons) ||
    !data.seasons.every(isSeason) ||
    (data.default_season !== null &&
      data.default_season !== undefined &&
      typeof data.default_season !== 'string')
  ) {
    throw invalidSeasons();
  }
  return {
    seasons: data.seasons,
    defaultSeason: data.default_season ?? null,
    choices: decodeChoices(data.choices),
  };
};

// The list changes when a Publication does, not within a page session, so one
// read serves every Search mount. A failed read is forgotten so a later mount
// can ask again.
let seasonsRequest = null;

export const fetchSeasons = () => {
  if (!seasonsRequest) {
    seasonsRequest = apiClient
      .get(getApiUrl('SEASONS'))
      .then((response) => decodeSeasons(response.data))
      .catch((error) => {
        seasonsRequest = null;
        throw error;
      });
  }
  return seasonsRequest;
};

export const resetSeasonsCache = () => {
  seasonsRequest = null;
};
