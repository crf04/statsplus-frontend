import { apiClient, getApiUrl } from '../config';
import { isRecord, strictDecoders } from '../decoding';
import { seasonRefusalOr, servingSeasonDecoders } from '../servingSeason';

const invalid = () => new Error('The shot zone matchup API returned an invalid response.');
const { requireNumber, requireNumberOrNull, requireString } = strictDecoders(invalid);
const { decodeSeasonContext, decodeTrailing } = servingSeasonDecoders(invalid);

// The families the court reads: the player's Diet and the opponent's defense.
const COURT_FAMILIES = ['player_diets', 'team_defense'];

/* The five Shot zones of a Diet, in the order the court labels them. */
export const SHOT_ZONES = [
  'Restricted Area',
  'In The Paint (Non-RA)',
  'Mid-Range',
  'Corner 3',
  'Above the Break 3',
];

const requireShare = (value) => {
  const share = requireNumber(value);
  if (share < 0 || share > 1) throw invalid();
  return share;
};

const requireShareOrNull = (value) => (value === null ? null : requireShare(value));

const requireRankOrNull = (value) => {
  if (value === null) return null;
  if (!Number.isInteger(value) || value < 1 || value > 30) throw invalid();
  return value;
};

/*
 * Reads only what the Zone Shooting court shows from an Unscheduled Matchup:
 * the player's season Shot-zone Diet and the opponent's season made-shot row
 * (`<zone>:FGM`, the row the PTS market reads) for each zone. A zone missing
 * from either side stays in the result with nulls, and the court leaves it
 * untinted.
 */
export const decodeShotZoneMatchup = (data, opponent) => {
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
    !isRecord(player.diet_shares) ||
    !Array.isArray(player.diet_shares.shot_zones) ||
    !team ||
    !isRecord(team.defense_sheet) ||
    !Array.isArray(team.defense_sheet.shot_zones)
  ) {
    throw invalid();
  }

  const diet = new Map(
    player.diet_shares.shot_zones.map((entry) => {
      if (!isRecord(entry) || !isRecord(entry.season)) throw invalid();
      return [
        requireString(entry.key),
        {
          share: requireShare(entry.season.share),
          leagueShare: requireShareOrNull(entry.season.league_average_share),
        },
      ];
    }),
  );
  const sheet = new Map(
    team.defense_sheet.shot_zones.map((row) => {
      if (!isRecord(row)) throw invalid();
      const key = requireString(row.key);
      if (row.season === null) return [key, null];
      if (!isRecord(row.season)) throw invalid();
      return [
        key,
        {
          rank: requireRankOrNull(row.season.rank),
          percentVsLeague: requireNumberOrNull(row.season.percent_vs_league_average),
        },
      ];
    }),
  );

  return {
    opponent,
    seasonContext: decodeSeasonContext(data.season_context),
    trailing: (decodeTrailing(data.trailing) ?? []).filter((entry) =>
      COURT_FAMILIES.includes(entry.family),
    ),
    zones: Object.fromEntries(
      SHOT_ZONES.map((zone) => {
        const shares = diet.get(zone);
        const allowed = sheet.get(`${zone}:FGM`);
        return [
          zone,
          {
            share: shares?.share ?? null,
            leagueShare: shares?.leagueShare ?? null,
            rank: allowed?.rank ?? null,
            percentVsLeague: allowed?.percentVsLeague ?? null,
          },
        ];
      }),
    ),
  };
};

/*
 * The court cannot be read for the Evidence season asked: a backend that does
 * not take `season` here, or one that answered for another season. Showing
 * the default's court under the chosen season would mislabel it.
 */
export class ShotZoneSeasonUnreadError extends Error {
  constructor(season) {
    super(`Zone Shooting can't read ${season} evidence yet.`);
    this.name = 'ShotZoneSeasonUnreadError';
    this.season = season;
  }
}

const refusesSeasonParameter = (error) => {
  const failure = error?.response?.data?.error;
  return (
    error?.response?.status === 400 &&
    failure?.code === 'invalid_input' &&
    Array.isArray(failure.details?.parameters) &&
    failure.details.parameters.includes('season')
  );
};

export const fetchShotZoneMatchup = async (
  playerName,
  opponent,
  { signal, season = null } = {},
) => {
  let response;
  try {
    response = await apiClient.get(getApiUrl('MATCHUP_UNSCHEDULED'), {
      params: { player_name: playerName, opponent, ...(season && { season }) },
      signal,
    });
  } catch (error) {
    if (season && refusesSeasonParameter(error)) throw new ShotZoneSeasonUnreadError(season);
    throw seasonRefusalOr(error);
  }
  const matchup = decodeShotZoneMatchup(response.data, opponent);
  if (season && matchup.seasonContext?.selectedSeason !== season) {
    throw new ShotZoneSeasonUnreadError(season);
  }
  return matchup;
};

/* The backend refuses a player it cannot score (no stored season Diet, or no
   such player) with a 404 and a reason; that is a fact about the player, not a
   failure to retry. */
export const shotZoneUnavailable = (error) =>
  error?.response?.status === 404 &&
  ['no_player_diet', 'player_not_found'].includes(error?.response?.data?.error?.details?.reason);
