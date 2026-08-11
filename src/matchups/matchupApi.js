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
const requireInteger = (value) => {
  if (!Number.isInteger(value)) throw invalid();
  return value;
};
const requireStringList = (value) => {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) throw invalid();
  return value;
};
const camelKey = (key) => key.replace(/_([a-z0-9])/g, (_match, letter) => letter.toUpperCase());
const MARKET_CATEGORIES = new Set([
  'PTS',
  'REB',
  'AST',
  '3PM',
  'FGA',
  'FG2A',
  'FG3A',
  'PRA',
  'PA',
  'PR',
  'RA',
  'TOV',
  'STL',
  'BLK',
  'STKS',
]);

const DEFENSE_BASES = ['play_types', 'shot_zones', 'shot_types', 'assist_locations', 'traditional'];

const decodeAvailabilityState = (value) => {
  if (
    !isRecord(value) ||
    !['available', 'unavailable', 'missing'].includes(value.status) ||
    (value.status === 'available'
      ? value.unavailable_reason !== null
      : typeof value.unavailable_reason !== 'string' || !value.unavailable_reason)
  ) {
    throw invalid();
  }
  return {
    status: value.status,
    unavailableReason: value.unavailable_reason,
  };
};

const decodeSurfaceAvailability = (availability) => {
  if (
    !isRecord(availability) ||
    Object.keys(availability).sort().join() !== [...DEFENSE_BASES].sort().join()
  ) {
    throw invalid();
  }
  return Object.fromEntries(
    DEFENSE_BASES.map((base) => {
      const windows = availability[base];
      if (
        !isRecord(windows) ||
        Object.keys(windows).sort().join() !== ['season', 'last_15'].sort().join()
      ) {
        throw invalid();
      }
      return [
        camelKey(base),
        {
          season: decodeAvailabilityState(windows.season),
          last15: decodeAvailabilityState(windows.last_15),
        },
      ];
    }),
  );
};

const decodeAvailableWindow = (value, availability, decode) => {
  if (availability.status === 'available') return decode(value);
  if (value !== null) throw invalid();
  return null;
};

const decodeSheetWindow = (value, availability, decode, base, key) => {
  if (
    value === null &&
    availability.status === 'available' &&
    base === 'traditional' &&
    key === 'OPP_REB'
  ) {
    return null;
  }
  return decodeAvailableWindow(value, availability, decode);
};

const decodeWindowValue = (value) => {
  if (!isRecord(value)) throw invalid();
  return {
    allowedPer48: requireNumber(value.allowed_per_48),
    percentVsLeagueAverage: requireNumber(value.percent_vs_league_average),
    sigmaDeviation: requireNumber(value.sigma_deviation),
    rank: requireNumber(value.rank),
  };
};

const decodeSheetRow = (row, availability, base) => {
  if (!isRecord(row)) throw invalid();
  const key = requireString(row.key);
  return {
    key,
    label: requireString(row.label),
    markets: requireStringList(row.markets),
    season: decodeSheetWindow(row.season, availability.season, decodeWindowValue, base, key),
    last15: decodeSheetWindow(row.last_15, availability.last15, decodeWindowValue, base, key),
  };
};

const decodeDefenseSheet = (sheet, surfaceAvailability) => {
  if (!isRecord(sheet) || Object.keys(sheet).sort().join() !== [...DEFENSE_BASES].sort().join())
    throw invalid();
  return Object.fromEntries(
    Object.entries(sheet).map(([base, rows]) => {
      if (!Array.isArray(rows)) throw invalid();
      return [
        camelKey(base),
        rows.map((row) => decodeSheetRow(row, surfaceAvailability[camelKey(base)], base)),
      ];
    }),
  );
};

const decodeTeam = (team, surfaceAvailability) => {
  if (!isRecord(team) || !Number.isInteger(team.team_id)) throw invalid();
  return {
    teamId: team.team_id,
    tricode: requireString(team.tricode),
    name: requireString(team.name),
    defenseSheet: decodeDefenseSheet(team.defense_sheet, surfaceAvailability),
    defensiveColumns: decodeDefensiveColumns(
      team.defensive_columns,
      surfaceAvailability.traditional,
    ),
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

function decodeDefensiveColumns(columns, availability) {
  if (!isRecord(columns) || DEFENSIVE_COLUMN_KEYS.some((key) => !isRecord(columns[key]))) {
    throw invalid();
  }
  return Object.fromEntries(
    DEFENSIVE_COLUMN_KEYS.map((key) => [
      key,
      {
        season: decodeAvailableWindow(
          columns[key].season,
          availability.season,
          decodeDefensiveColumnWindow,
        ),
        last15: decodeAvailableWindow(
          columns[key].last_15,
          availability.last15,
          decodeDefensiveColumnWindow,
        ),
      },
    ]),
  );
}

const decodeDietShares = (dietShares) => {
  const dietBases = DEFENSE_BASES.filter((base) => base !== 'traditional');
  if (!isRecord(dietShares) || Object.keys(dietShares).sort().join() !== dietBases.sort().join())
    throw invalid();
  return Object.fromEntries(
    Object.entries(dietShares).map(([base, entries]) => {
      if (!Array.isArray(entries)) throw invalid();
      return [
        camelKey(base),
        entries.map((entry) => {
          if (!isRecord(entry) || Object.hasOwn(entry, 'last_15') || !isRecord(entry.season)) {
            throw invalid();
          }
          const season = entry.season;
          if (!Number.isInteger(season.games_played) || season.games_played <= 0) throw invalid();
          const share = requireNumber(season.share);
          const volume = requireNumber(season.volume);
          if (share < 0 || volume < 0) throw invalid();
          return {
            key: requireString(entry.key),
            season: {
              share,
              volume,
              gamesPlayed: season.games_played,
              volumeUnit: requireString(season.volume_unit),
              volumePerGame: volume / season.games_played,
            },
          };
        }),
      ];
    }),
  );
};

const decodePlayer = (player) => {
  if (!isRecord(player) || !Number.isInteger(player.team_id)) throw invalid();
  if (!Array.isArray(player.last_10_minutes)) throw invalid();
  const postedMarkets = requireStringList(player.posted_markets);
  if (
    postedMarkets.length === 0 ||
    new Set(postedMarkets).size !== postedMarkets.length ||
    postedMarkets.some((market) => !MARKET_CATEGORIES.has(market))
  )
    throw invalid();
  return {
    id: requireInteger(player.canonical_id),
    name: requireString(player.name),
    teamId: player.team_id,
    tricode: requireString(player.tricode),
    postedMarkets,
    provenance: decodeProvenance(player.provenance, postedMarkets),
    seasonScoring: player.season_scoring === null ? null : requireNumber(player.season_scoring),
    last10Minutes: player.last_10_minutes.map(requireNumber),
    dietShares: decodeDietShares(player.diet_shares),
    injuryBadgeRef:
      player.injury_badge_ref === null ? null : requireString(player.injury_badge_ref),
    scores: decodeScores(player.scores, postedMarkets),
  };
};

function decodeProvenance(provenance, postedMarkets) {
  if (!isRecord(provenance) || Object.keys(provenance).length === 0) throw invalid();
  const decoded = Object.fromEntries(
    Object.entries(provenance).map(([provider, markets]) => {
      if (!provider || !Array.isArray(markets) || markets.length === 0) throw invalid();
      const categories = requireStringList(markets);
      if (categories.some((market) => !postedMarkets.includes(market))) throw invalid();
      return [provider, categories];
    }),
  );
  if (
    postedMarkets.some(
      (market) => !Object.values(decoded).some((markets) => markets.includes(market)),
    )
  ) {
    throw invalid();
  }
  return decoded;
}

const decodeLeagueRowWindow = (value) => {
  if (!isRecord(value)) throw invalid();
  return {
    averageAllowedPer48: requireNumber(value.average_allowed_per_48),
    sigma: requireNumber(value.sigma),
  };
};

const decodeLeague = (league) => {
  if (
    !isRecord(league) ||
    !isRecord(league.defense_sheet) ||
    !isRecord(league.defensive_columns) ||
    !isRecord(league.surface_availability)
  ) {
    throw invalid();
  }
  const surfaceAvailability = decodeSurfaceAvailability(league.surface_availability);
  if (Object.keys(league.defense_sheet).sort().join() !== [...DEFENSE_BASES].sort().join()) {
    throw invalid();
  }
  const defenseSheet = Object.fromEntries(
    DEFENSE_BASES.map((base) => {
      const rows = league.defense_sheet[base];
      if (!Array.isArray(rows)) throw invalid();
      const decodedRows = rows.map((row) => {
        if (!isRecord(row)) throw invalid();
        const key = requireString(row.key);
        return {
          key,
          season: decodeSheetWindow(
            row.season,
            surfaceAvailability[camelKey(base)].season,
            decodeLeagueRowWindow,
            base,
            key,
          ),
          last15: decodeSheetWindow(
            row.last_15,
            surfaceAvailability[camelKey(base)].last15,
            decodeLeagueRowWindow,
            base,
            key,
          ),
        };
      });
      if (new Set(decodedRows.map((row) => row.key)).size !== decodedRows.length) throw invalid();
      return [camelKey(base), decodedRows];
    }),
  );
  const defensiveColumns = Object.fromEntries(
    DEFENSIVE_COLUMN_KEYS.map((key) => {
      const column = league.defensive_columns[key];
      if (!isRecord(column)) throw invalid();
      const decodeWindow = (value) => {
        if (!isRecord(value)) throw invalid();
        return {
          averagePer48: requireNumber(value.average_per_48),
          sigma: requireNumber(value.sigma),
        };
      };
      return [
        key,
        {
          season: decodeAvailableWindow(
            column.season,
            surfaceAvailability.traditional.season,
            decodeWindow,
          ),
          last15: decodeAvailableWindow(
            column.last_15,
            surfaceAvailability.traditional.last15,
            decodeWindow,
          ),
        },
      ];
    }),
  );
  if (
    Object.keys(league.defensive_columns).sort().join() !== [...DEFENSIVE_COLUMN_KEYS].sort().join()
  ) {
    throw invalid();
  }
  return { defenseSheet, defensiveColumns, surfaceAvailability };
};

const validateLeagueCoverage = (league, teams) => {
  for (const [base, leagueRows] of Object.entries(league.defenseSheet)) {
    const leagueKeys = new Set(leagueRows.map((row) => row.key));
    const teamKeys = new Set(
      teams.flatMap((team) => team.defenseSheet[base].map((row) => row.key)),
    );
    if ([...teamKeys].some((key) => !leagueKeys.has(key))) {
      throw invalid();
    }
  }
};

const decodeScoreCell = (cell) => {
  if (!isRecord(cell) || typeof cell.thin !== 'boolean') throw invalid();
  return { value: requireNumber(cell.value), thin: cell.thin };
};

const DEFENSIVE_SCORE_MARKETS = new Set(['TOV', 'STL', 'BLK', 'STKS']);

const decodeScoreWindow = (window, market) => {
  if (!isRecord(window) || !isRecord(window.components)) throw invalid();
  const defensive = DEFENSIVE_SCORE_MARKETS.has(market);
  const componentBases = Object.keys(window.components);
  if (
    componentBases.some((base) => !DEFENSE_BASES.includes(base)) ||
    (defensive && componentBases.some((base) => base !== 'traditional'))
  )
    throw invalid();
  const componentCount = Object.keys(window.components).length;
  const validOffensiveBlend = componentCount === 0 ? window.blend === null : isRecord(window.blend);
  if ((!defensive && !validOffensiveBlend) || (defensive && window.blend != null)) {
    throw invalid();
  }
  return {
    components: Object.fromEntries(
      Object.entries(window.components).map(([base, cell]) => [
        camelKey(base),
        decodeScoreCell(cell),
      ]),
    ),
    blend: defensive || window.blend === null ? null : decodeScoreCell(window.blend),
  };
};

function decodeScores(scores, postedMarkets) {
  if (
    !isRecord(scores) ||
    Object.keys(scores).sort().join() !== [...postedMarkets].sort().join() ||
    postedMarkets.some(
      (market) =>
        !isRecord(scores[market]) ||
        Object.keys(scores[market]).sort().join() !== ['season', 'last_15'].sort().join(),
    )
  ) {
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
    entry.canonical_status !== null &&
    !['Probable', 'Questionable', 'Doubtful', 'Out'].includes(entry.canonical_status)
  ) {
    throw invalid();
  }
  return {
    id: requireString(entry.entry_id),
    sourcePlayerId: entry.source_player_id === null ? null : requireString(entry.source_player_id),
    playerId: entry.canonical_player_id === null ? null : requireInteger(entry.canonical_player_id),
    playerName: requireString(entry.source_player_name),
    teamId: requireInteger(entry.team_id),
    tricode: requireString(entry.tricode),
    status: entry.canonical_status,
    rawStatus: entry.raw_status || null,
    reason: requireString(entry.reason),
    sourceUrl: requireString(entry.source_url),
  };
};

const decodeInjuries = (injuries, matchupTeams) => {
  if (!isRecord(injuries) || !['fresh', 'stale', 'unavailable'].includes(injuries.status)) {
    throw invalid();
  }
  if (!Object.hasOwn(injuries, 'unavailable_reason') || !Object.hasOwn(injuries, 'retrieved_at')) {
    throw invalid();
  }
  const unavailableReasons = ['disabled', 'permission_required', 'fetch_failed', null];
  if (
    !unavailableReasons.includes(injuries.unavailable_reason) ||
    (injuries.status === 'unavailable' && injuries.unavailable_reason === null) ||
    (injuries.status !== 'unavailable' && injuries.unavailable_reason !== null)
  ) {
    throw invalid();
  }
  if (
    !Array.isArray(injuries.teams) ||
    (injuries.status === 'unavailable'
      ? ![0, matchupTeams.length].includes(injuries.teams.length)
      : injuries.teams.length !== matchupTeams.length)
  ) {
    throw invalid();
  }
  const expectedTeams = new Map(matchupTeams.map((team) => [team.teamId, team.tricode]));
  const seenTeams = new Set();
  return {
    status: injuries.status,
    unavailableReason: injuries.unavailable_reason || null,
    retrievedAt: decodeRetrievedAt(injuries.retrieved_at),
    source: requireString(injuries.source),
    sourceUrl: requireString(injuries.source_url),
    teams: injuries.teams.map((team) => {
      if (
        !isRecord(team) ||
        !Array.isArray(team.entries) ||
        !Number.isInteger(team.team_id) ||
        team.submission_state !== 'unknown'
      )
        throw invalid();
      const tricode = requireString(team.tricode);
      if (seenTeams.has(team.team_id) || expectedTeams.get(team.team_id) !== tricode) {
        throw invalid();
      }
      seenTeams.add(team.team_id);
      const entries = team.entries.map(decodeInjuryEntry);
      if (entries.some((entry) => entry.teamId !== team.team_id || entry.tricode !== tricode)) {
        throw invalid();
      }
      return {
        teamId: team.team_id,
        tricode,
        submissionState: team.submission_state,
        entries,
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
  const league = decodeLeague(data.league);
  const teams = data.teams.map((team) => decodeTeam(team, league.surfaceAvailability));
  validateLeagueCoverage(league, teams);
  const injuries = decodeInjuries(data.injuries, teams);
  const freshness = decodeFreshness(data.freshness);
  if (
    freshness.injuries.status !== injuries.status ||
    freshness.injuries.retrievedAt !== injuries.retrievedAt
  )
    throw invalid();
  return {
    game: decodeGame(data.game),
    league,
    teams,
    players: data.players.map(decodePlayer),
    injuries,
    freshness,
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
  if (!Number.isInteger(data.player_id) || data.player_id !== expectedPlayerId) {
    throw selectionInvalid();
  }
  return {
    playerId: data.player_id,
    h2h: decodeLogTable(data.h2h, postedMarkets),
    archetype: decodeLogTable(data.archetype, postedMarkets),
  };
};

export const fetchMatchupSelection = async (gameId, playerId, postedMarkets, { signal } = {}) => {
  if (
    typeof gameId !== 'string' ||
    !gameId ||
    !Number.isInteger(playerId) ||
    !Array.isArray(postedMarkets) ||
    postedMarkets.length === 0
  )
    throw selectionInvalid();
  const response = await apiClient.get(getApiUrl('MATCHUP_SELECTION'), {
    params: { game_id: gameId, player_id: playerId },
    signal,
  });
  return decodeMatchupSelection(response.data, postedMarkets, playerId);
};
