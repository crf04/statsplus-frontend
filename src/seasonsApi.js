import { apiClient, getApiUrl } from './config';

const SEASON_PATTERN = /^\d{4}-\d{2}$/;

export const decodeSeasons = (data) => {
  if (
    !data ||
    !Array.isArray(data.seasons) ||
    !data.seasons.every((season) => typeof season === 'string' && SEASON_PATTERN.test(season)) ||
    (data.default_season !== null &&
      data.default_season !== undefined &&
      typeof data.default_season !== 'string')
  ) {
    throw new Error('The seasons endpoint returned an invalid response.');
  }
  return { seasons: data.seasons, defaultSeason: data.default_season ?? null };
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
