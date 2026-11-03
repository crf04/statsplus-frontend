import { apiClient, getApiUrl } from './config';
import { isRecord } from './decoding';
import { seasonRefusalOr, servingSeasonDecoders } from './servingSeason';

const invalidTeamStats = () => new Error('The team stats endpoint returned an invalid response.');
const { decodeSeasonContext, decodeTrailing } = servingSeasonDecoders(invalidTeamStats);

/*
 * As with the Player Profile, an explicit Evidence season (crf04/statsplus#369)
 * wraps the body as `{data, season_context, trailing}`, since a Shooting Type
 * body is a JSON array. An omitted season, or a backend that predates the
 * season, answers with the bare body.
 */
export const decodeTeamStats = (body) => {
  if (!isRecord(body) || !Object.hasOwn(body, 'season_context')) {
    return { data: body, seasonContext: undefined };
  }
  if (!Object.hasOwn(body, 'data')) throw invalidTeamStats();
  return {
    data: body.data,
    seasonContext: decodeSeasonContext(body.season_context),
    trailing: decodeTrailing(body.trailing),
  };
};

export const fetchTeamStats = (params, { signal } = {}) =>
  apiClient
    .get(getApiUrl('TEAM_STATS'), { params, signal })
    .then(({ data }) => decodeTeamStats(data))
    .catch((error) => {
      throw seasonRefusalOr(error);
    });
