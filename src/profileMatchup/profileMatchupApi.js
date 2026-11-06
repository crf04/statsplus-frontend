import { apiClient, getApiUrl } from '../config';
import { isRecord } from '../decoding';
import { seasonRefusalOr } from '../servingSeason';
import { readMatchup } from './matchupReading';

const invalid = () => new Error('The matchup API returned an invalid response.');

/* The shape `readMatchup` relies on: one player with scores, and the opponent's Defense Sheet. */
export const decodeProfileMatchup = (data, opponent) => {
  if (!isRecord(data) || !Array.isArray(data.players) || !Array.isArray(data.teams)) {
    throw invalid();
  }
  const [player] = data.players;
  const team = data.teams.find(
    (candidate) => isRecord(candidate) && candidate.tricode === opponent,
  );
  if (
    data.players.length !== 1 ||
    !isRecord(player) ||
    !isRecord(player.scores) ||
    !isRecord(player.diet_shares) ||
    Object.values(player.diet_shares).some((facts) => !Array.isArray(facts)) ||
    !team ||
    !isRecord(team.defense_sheet) ||
    Object.values(team.defense_sheet).some((rows) => !Array.isArray(rows))
  ) {
    throw invalid();
  }
  return readMatchup(data, opponent);
};

/*
 * The Unscheduled Matchup the MCP `get_matchup` card reads for this player against this
 * opponent, in the Workspace's Evidence season: `season` names it, and null (the default
 * season) sends none, as MCP sends none.
 */
export const fetchProfileMatchup = async (playerName, opponent, { signal, season = null } = {}) => {
  let response;
  try {
    response = await apiClient.get(getApiUrl('MATCHUP_UNSCHEDULED'), {
      params: { player_name: playerName, opponent, ...(season && { season }) },
      signal,
    });
  } catch (error) {
    throw seasonRefusalOr(error);
  }
  return decodeProfileMatchup(response.data, opponent);
};

/* The backend refuses a player it cannot score (no stored season Diet, or no such player) with
   a 404 and a reason; that is a fact about the player, not a failure to retry. */
export const matchupUnavailable = (error) =>
  error?.response?.status === 404 &&
  ['no_player_diet', 'player_not_found'].includes(error?.response?.data?.error?.details?.reason);
