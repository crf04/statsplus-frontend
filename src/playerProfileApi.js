import { apiClient, getApiUrl } from './config';
import { isRecord } from './decoding';
import { seasonUnavailableOr, servingSeasonDecoders } from './servingSeason';

const invalidProfile = () => new Error('The player profile endpoint returned an invalid response.');
const { decodeSeasonContext } = servingSeasonDecoders(invalidProfile);

/*
 * A profile body can be a JSON array, so an explicit Evidence season
 * (crf04/statsplus#330) wraps it as `{data, season_context}`. An omitted
 * season answers with the bare body, as before.
 */
export const decodePlayerProfile = (body) => {
  if (!isRecord(body) || !Object.hasOwn(body, 'season_context')) {
    return { data: body, seasonContext: undefined };
  }
  if (!Object.hasOwn(body, 'data')) throw invalidProfile();
  return { data: body.data, seasonContext: decodeSeasonContext(body.season_context) };
};

export const fetchPlayerProfile = (params, { signal } = {}) =>
  apiClient
    .get(getApiUrl('PLAYER_PROFILE'), { params, signal })
    .then(({ data }) => decodePlayerProfile(data))
    .catch((error) => {
      throw seasonUnavailableOr(error);
    });
