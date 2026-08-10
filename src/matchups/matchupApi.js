import { apiClient, getApiUrl } from '../config';
import {
  derivePoolStatusFromProviders,
  deriveScheduleStatus,
  isStatusAllowed,
  statusAllowsNullRetrievedAt,
} from '../slateStatus';

const invalid = () => new Error('The matchup endpoint returned an invalid response.');
const selectionInvalid = () =>
  new Error('The matchup selection endpoint returned an invalid response.');
const requireSelectionString = (value) => {
  if (typeof value !== 'string' || !value) throw selectionInvalid();
  return value;
};
const requireSelectionNumber = (value) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw selectionInvalid();
  return value;
};
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
    defensiveColumns: decodeDefensiveColumns(team.defensive_columns),
  };
};

const DEFENSIVE_COLUMN_KEYS = ['OPP_TOV', 'OPP_STL', 'OPP_BLK'];

const decodeDefensiveColumnWindow = (value) => {
  if (!isRecord(value)) throw invalid();
  return {
    per48: requireNumber(value.per_48),
    percentVsLeagueAverage: requireNumber(value.percent_vs_league_average),
  };
};

function decodeDefensiveColumns(columns) {
  if (!isRecord(columns) || DEFENSIVE_COLUMN_KEYS.some((key) => !isRecord(columns[key]))) {
    throw invalid();
  }
  return Object.fromEntries(
    DEFENSIVE_COLUMN_KEYS.map((key) => [
      key,
      {
        season: decodeDefensiveColumnWindow(columns[key].season),
        last15: decodeDefensiveColumnWindow(columns[key].last_15),
      },
    ]),
  );
}

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
    scores: decodeScores(player.scores, player.posted_markets),
  };
};

const decodeScoreCell = (cell) => {
  if (!isRecord(cell) || typeof cell.thin !== 'boolean') throw invalid();
  return { value: requireNumber(cell.value), thin: cell.thin };
};

const DEFENSIVE_SCORE_MARKETS = new Set(['TOV', 'STL', 'BLK', 'STKS']);

const decodeScoreWindow = (window, market) => {
  if (!isRecord(window) || !isRecord(window.components)) throw invalid();
  const defensive = DEFENSIVE_SCORE_MARKETS.has(market);
  if ((!defensive && !isRecord(window.blend)) || (defensive && window.blend != null)) {
    throw invalid();
  }
  return {
    components: Object.fromEntries(
      Object.entries(window.components).map(([base, cell]) => [
        camelKey(base),
        decodeScoreCell(cell),
      ]),
    ),
    blend: defensive ? null : decodeScoreCell(window.blend),
  };
};

function decodeScores(scores, postedMarkets) {
  if (!isRecord(scores) || postedMarkets.some((market) => !isRecord(scores[market]))) {
    throw invalid();
  }
  return Object.fromEntries(
    postedMarkets.map((market) => [
      market,
      {
        season: decodeScoreWindow(scores[market].season, market),
        last15: decodeScoreWindow(scores[market].last_15, market),
      },
    ]),
  );
}

const decodeRetrievedAt = (value) => {
  if (value === null) return null;
  const date = new Date(requireString(value));
  if (Number.isNaN(date.getTime())) throw invalid();
  return date.toISOString();
};

const decodeFreshnessSurface = (surface, surfaceName) => {
  if (!isRecord(surface) || !isStatusAllowed(surface.status, surfaceName)) throw invalid();
  const retrievedAt = decodeRetrievedAt(surface.retrieved_at ?? null);
  if (!retrievedAt && !statusAllowsNullRetrievedAt(surface.status)) throw invalid();
  return {
    status: surface.status,
    retrievedAt,
  };
};

const decodeFreshness = (freshness) => {
  if (!isRecord(freshness) || !isRecord(freshness.schedule) || !isRecord(freshness.pool)) {
    throw invalid();
  }
  const scheduleRetrievedAt = decodeRetrievedAt(freshness.schedule.retrieved_at ?? null);
  let schedule;
  if (freshness.schedule.status === undefined) {
    if (!scheduleRetrievedAt) throw invalid();
    schedule = {
      status: deriveScheduleStatus(scheduleRetrievedAt),
      retrievedAt: scheduleRetrievedAt,
    };
  } else {
    schedule = decodeFreshnessSurface(freshness.schedule, 'schedule');
  }
  if (!isRecord(freshness.pool.providers)) throw invalid();
  const providers = Object.entries(freshness.pool.providers).map(([name, surface]) => ({
    name: requireString(name),
    ...decodeFreshnessSurface(surface, 'pool'),
  }));
  let pool;
  if (freshness.pool.status === undefined) {
    const status = derivePoolStatusFromProviders(providers);
    if (!status) throw invalid();
    const retrievedAt =
      decodeRetrievedAt(freshness.pool.retrieved_at ?? null) ||
      providers
        .map((provider) => provider.retrievedAt)
        .filter(Boolean)
        .sort()
        .at(0) ||
      null;
    pool = { status, retrievedAt, providers };
  } else {
    pool = { ...decodeFreshnessSurface(freshness.pool, 'pool'), providers };
  }
  return {
    schedule,
    pool,
    stats: decodeFreshnessSurface(freshness.stats, 'stats'),
    injuries: decodeFreshnessSurface(freshness.injuries, 'injuries'),
  };
};

const decodeGameTeam = (team) => {
  if (!isRecord(team) || !Number.isInteger(team.team_id)) throw invalid();
  const targetablePlayerCount = team.targetable_player_count ?? null;
  if (targetablePlayerCount !== null && !Number.isInteger(targetablePlayerCount)) throw invalid();
  return {
    teamId: team.team_id,
    tricode: requireString(team.tricode),
    name: requireString(team.name),
    targetablePlayerCount,
  };
};

const decodeGame = (game) => {
  if (
    !isRecord(game) ||
    !isRecord(game.status) ||
    !['scheduled', 'postponed', 'final'].includes(game.status.state) ||
    typeof game.preseason !== 'boolean'
  ) {
    throw invalid();
  }
  const scheduledAt = new Date(requireString(game.scheduled_at));
  if (Number.isNaN(scheduledAt.getTime())) throw invalid();
  return {
    gameId: requireString(game.game_id),
    away: decodeGameTeam(game.away_team),
    home: decodeGameTeam(game.home_team),
    scheduledAt: scheduledAt.toISOString(),
    status: game.status.state,
    statusLabel: game.status.label ? requireString(game.status.label) : null,
    classification: game.classification ? requireString(game.classification) : null,
    preseason: game.preseason,
  };
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
    data.teams.length !== 2 ||
    !Array.isArray(data.players)
  ) {
    throw invalid();
  }
  return {
    game: decodeGame(data.game),
    teams: data.teams.map(decodeTeam),
    players: data.players.map(decodePlayer),
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

const decodeSelectionStatMap = (value, markets) => {
  if (!isRecord(value) || markets.some((market) => !(market in value))) throw selectionInvalid();
  return Object.fromEntries(
    Object.entries(value).map(([key, number]) => {
      if (typeof number !== 'number' || !Number.isFinite(number)) throw selectionInvalid();
      return [key, number];
    }),
  );
};

const decodeLogLine = (line, markets) => {
  if (!isRecord(line)) throw selectionInvalid();
  if (!['game', 'average'].includes(line.row_type)) throw selectionInvalid();
  const average = line.row_type === 'average';
  if (
    (average && (line.game_date !== null || line.matchup !== null)) ||
    (!average && (typeof line.game_date !== 'string' || typeof line.matchup !== 'string'))
  ) {
    throw selectionInvalid();
  }
  return {
    date: line.game_date,
    matchup: average ? null : requireSelectionString(line.matchup),
    minutes: requireSelectionNumber(line.minutes),
    stats: decodeSelectionStatMap(line.stats, markets),
    deltas: decodeSelectionStatMap(line.deltas, markets),
    average,
  };
};

const decodeLogTable = (table, markets) => {
  if (!isRecord(table) || !Array.isArray(table.rows) || typeof table.thin !== 'boolean')
    throw selectionInvalid();
  const rows = table.rows.map((row) => decodeLogLine(row, markets));
  if (rows.some((row, index) => row.average && index !== rows.length - 1)) {
    throw selectionInvalid();
  }
  if (rows.length > 0 && (!rows.at(-1).average || rows.filter((row) => row.average).length !== 1)) {
    throw selectionInvalid();
  }
  return {
    rows,
    thin: table.thin,
  };
};

export const decodeMatchupSelection = (data, postedMarkets, expectedPlayerId) => {
  if (!isRecord(data) || !Array.isArray(postedMarkets) || postedMarkets.length === 0)
    throw selectionInvalid();
  if (data.player_id !== expectedPlayerId) throw selectionInvalid();
  return {
    playerId: data.player_id,
    h2h: decodeLogTable(data.h2h, postedMarkets),
    archetype: decodeLogTable(data.archetype, postedMarkets),
  };
};

export const fetchMatchupSelection = async (gameId, playerId, postedMarkets, { signal } = {}) => {
  const response = await apiClient.get(getApiUrl('MATCHUP_SELECTION'), {
    params: { game_id: gameId, player_id: playerId },
    signal,
  });
  return decodeMatchupSelection(response.data, postedMarkets, playerId);
};
