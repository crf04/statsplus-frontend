import { apiClient, getApiUrl } from '../config';

const invalid = () => new Error('The matchup endpoint returned an invalid response.');
const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const requireString = (value) => {
  if (typeof value !== 'string' || !value) throw invalid();
  return value;
};
const requireNumber = (value) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw invalid();
  return value;
};
const requireStringList = (value) => {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) throw invalid();
  return value;
};
const camelKey = (key) => key.replace(/_([a-z0-9])/g, (_match, letter) => letter.toUpperCase());

const decodeWindowValue = (value) => {
  if (!isRecord(value)) throw invalid();
  return {
    allowedPer48: requireNumber(value.allowed_per_48),
    percentVsLeagueAverage: requireNumber(value.percent_vs_league_average),
    sigmaDeviation: requireNumber(value.sigma_deviation),
    rank: requireNumber(value.rank),
  };
};

const decodeSheetRow = (row) => {
  if (!isRecord(row)) throw invalid();
  return {
    key: requireString(row.key),
    label: requireString(row.label),
    markets: requireStringList(row.markets),
    season: decodeWindowValue(row.season),
    last15: decodeWindowValue(row.last_15),
  };
};

const decodeDefenseSheet = (sheet) => {
  if (!isRecord(sheet) || Object.keys(sheet).length === 0) throw invalid();
  return Object.fromEntries(
    Object.entries(sheet).map(([base, rows]) => {
      if (!Array.isArray(rows)) throw invalid();
      return [camelKey(base), rows.map(decodeSheetRow)];
    }),
  );
};

const decodeTeam = (team) => {
  if (!isRecord(team) || !Number.isInteger(team.team_id)) throw invalid();
  return {
    teamId: team.team_id,
    tricode: requireString(team.tricode),
    name: requireString(team.name),
    defenseSheet: decodeDefenseSheet(team.defense_sheet),
  };
};

const decodeDietShares = (dietShares) => {
  if (!isRecord(dietShares)) throw invalid();
  return Object.fromEntries(
    Object.entries(dietShares).map(([base, entries]) => {
      if (!Array.isArray(entries)) throw invalid();
      return [
        camelKey(base),
        entries.map((entry) => {
          if (!isRecord(entry) || !isRecord(entry.season) || !isRecord(entry.last_15)) {
            throw invalid();
          }
          const decodeShare = (share) => ({
            share: requireNumber(share.share),
            volumePerGame: requireNumber(share.volume_per_game),
          });
          return {
            key: requireString(entry.key),
            season: decodeShare(entry.season),
            last15: decodeShare(entry.last_15),
          };
        }),
      ];
    }),
  );
};

const decodePlayer = (player) => {
  if (!isRecord(player) || !Number.isInteger(player.team_id)) throw invalid();
  if (!Array.isArray(player.last_10_minutes)) throw invalid();
  return {
    id: requireString(player.canonical_id),
    name: requireString(player.name),
    teamId: player.team_id,
    tricode: requireString(player.tricode),
    postedMarkets: requireStringList(player.posted_markets),
    seasonScoring: requireNumber(player.season_scoring),
    last10Minutes: player.last_10_minutes.map(requireNumber),
    dietShares: decodeDietShares(player.diet_shares),
    injuryBadgeRef:
      player.injury_badge_ref === null ? null : requireString(player.injury_badge_ref),
  };
};

const decodeRetrievedAt = (value) => {
  if (value === null) return null;
  const date = new Date(requireString(value));
  if (Number.isNaN(date.getTime())) throw invalid();
  return date.toISOString();
};

const decodeFreshnessSurface = (surface) => {
  if (!isRecord(surface) || !('retrieved_at' in surface)) throw invalid();
  return {
    status: requireString(surface.status),
    retrievedAt: decodeRetrievedAt(surface.retrieved_at),
  };
};

const decodeFreshness = (freshness) => {
  if (!isRecord(freshness)) throw invalid();
  const result = {};
  for (const name of ['schedule', 'pool', 'stats', 'injuries']) {
    result[name] = decodeFreshnessSurface(freshness[name]);
  }
  if (!isRecord(freshness.pool.providers)) throw invalid();
  result.pool.providers = Object.entries(freshness.pool.providers).map(([name, surface]) => ({
    name,
    ...decodeFreshnessSurface(surface),
  }));
  return result;
};

const decodeInjuryEntry = (entry) => {
  if (!isRecord(entry)) throw invalid();
  if (
    entry.status !== null &&
    entry.status !== undefined &&
    !['Probable', 'Questionable', 'Doubtful', 'Out'].includes(entry.status)
  ) {
    throw invalid();
  }
  return {
    id: requireString(entry.entry_id),
    playerId: entry.canonical_player_id,
    playerName: requireString(entry.source_player_name),
    teamId: entry.team_id,
    tricode: requireString(entry.tricode),
    status: entry.status || null,
    rawStatus: entry.raw_status || null,
    reason: requireString(entry.reason),
    sourceUrl: requireString(entry.source_url),
  };
};

const decodeInjuries = (injuries) => {
  if (!isRecord(injuries) || !['fresh', 'stale', 'unavailable'].includes(injuries.status)) {
    throw invalid();
  }
  if (!Array.isArray(injuries.teams)) throw invalid();
  return {
    status: injuries.status,
    unavailableReason: injuries.unavailable_reason || null,
    retrievedAt: decodeRetrievedAt(injuries.retrieved_at),
    source: requireString(injuries.source),
    sourceUrl: requireString(injuries.source_url),
    teams: injuries.teams.map((team) => {
      if (!isRecord(team) || !Array.isArray(team.entries)) throw invalid();
      return {
        teamId: team.team_id,
        tricode: requireString(team.tricode),
        submissionState: team.submission_state || null,
        entries: team.entries.map(decodeInjuryEntry),
      };
    }),
  };
};

export const decodeMatchup = (data) => {
  if (
    !isRecord(data) ||
    !isRecord(data.game) ||
    !Array.isArray(data.teams) ||
    data.teams.length !== 2
  ) {
    throw invalid();
  }
  return {
    game: data.game,
    teams: data.teams.map(decodeTeam),
    players: Array.isArray(data.players)
      ? data.players.map(decodePlayer)
      : (() => {
          throw invalid();
        })(),
    injuries: decodeInjuries(data.injuries),
    freshness: decodeFreshness(data.freshness),
  };
};

export const fetchMatchup = async (gameId, { signal } = {}) => {
  const response = await apiClient.get(getApiUrl('MATCHUP'), {
    params: { game_id: gameId },
    signal,
  });
  return decodeMatchup(response.data);
};
