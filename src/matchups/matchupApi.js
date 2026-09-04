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
const decodeRelativePercentage = (value) => (value === null ? null : requireNumber(value));
const requireNumberOrNull = (value) => (value === null ? null : requireNumber(value));
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
const EXPERIENCE_MODES = ['historical', 'current'];
const PLAYER_SOURCES = ['game_logs', 'player_pool'];
const EXPERIENCE_SECTIONS = [
  'schedule',
  'participants',
  'season_defense',
  'last_15_defense',
  'injuries',
];
const MISSING_INPUT_PATTERN = new RegExp(
  `^(?:player_season_rate|(?:team_defense|player_diet):(?:${DEFENSE_BASES.join('|')}))$`,
);
const PLAY_TYPE_SLICES = new Set([
  'Transition',
  'Isolation',
  'PRBallHandler',
  'PRRollMan',
  'OffRebound',
  'Spotup',
  'Cut',
  'Handoff',
  'OffScreen',
  'Postup',
]);
const TWO_POINT_SHOT_ZONE_SLICES = new Set([
  'Restricted Area',
  'In The Paint (Non-RA)',
  'Mid-Range',
]);
const THREE_POINT_SHOT_ZONE_SLICES = new Set(['Corner 3', 'Above the Break 3']);
const SHOT_ZONE_SLICES = new Set([...TWO_POINT_SHOT_ZONE_SLICES, ...THREE_POINT_SHOT_ZONE_SLICES]);
const SHOT_TYPE_SLICES = new Set(['Catch and Shoot', 'Pullups', 'Less Than 10 ft']);
const ASSIST_LOCATION_SLICES = new Set([
  'Arc3Assists',
  'Corner3Assists',
  'AtRimAssists',
  'ShortMidRangeAssists',
  'LongMidRangeAssists',
]);
const TRADITIONAL_SLICES = new Set(['OPP_REB', 'OPP_TOV', 'OPP_STL', 'OPP_BLK']);
const ADDITIVE_SHEET_BASES = new Set(['play_types', 'assist_locations', 'traditional']);

const expectedSheetMarkets = (base, sliceKey, statKey) => {
  if (base === 'play_types') {
    return statKey === 'PTS' ? ['PTS', 'PA', 'PR', 'PRA'] : ['PTS'];
  }
  if (base === 'shot_zones') {
    if (statKey === 'FGA') {
      return TWO_POINT_SHOT_ZONE_SLICES.has(sliceKey) ? ['FGA', 'FG2A'] : ['FGA', 'FG3A'];
    }
    return THREE_POINT_SHOT_ZONE_SLICES.has(sliceKey) ? ['PTS', '3PM'] : ['PTS'];
  }
  if (base === 'shot_types') {
    return {
      FG2M: ['PTS'],
      FG2A: ['FGA', 'FG2A'],
      FG3M: ['3PM', 'PTS'],
      FG3A: ['FGA', 'FG3A'],
    }[statKey];
  }
  if (base === 'assist_locations') return ['AST', 'PA', 'RA', 'PRA'];
  return {
    OPP_REB: ['REB', 'PR', 'RA', 'PRA'],
    OPP_TOV: ['TOV'],
    OPP_STL: ['STL', 'STKS'],
    OPP_BLK: ['BLK', 'STKS'],
  }[statKey];
};

const decodeSheetIdentity = (base, key) => {
  let sliceKey;
  let statKey;
  if (base === 'assist_locations' || base === 'traditional') {
    sliceKey = key;
    statKey = key;
  } else {
    const parts = key.split(':');
    if (parts.length !== 2 || !parts[0] || !parts[1]) throw invalid();
    [sliceKey, statKey] = parts;
  }
  const recognizedSlice =
    (base === 'play_types' && PLAY_TYPE_SLICES.has(sliceKey)) ||
    (base === 'shot_zones' && SHOT_ZONE_SLICES.has(sliceKey)) ||
    (base === 'shot_types' && SHOT_TYPE_SLICES.has(sliceKey)) ||
    (base === 'assist_locations' && ASSIST_LOCATION_SLICES.has(sliceKey)) ||
    (base === 'traditional' && TRADITIONAL_SLICES.has(sliceKey));
  if (!recognizedSlice && ADDITIVE_SHEET_BASES.has(base)) return null;
  const valid =
    (base === 'play_types' &&
      PLAY_TYPE_SLICES.has(sliceKey) &&
      ['PTS', 'POSS'].includes(statKey)) ||
    (base === 'shot_zones' && SHOT_ZONE_SLICES.has(sliceKey) && ['FGA', 'FGM'].includes(statKey)) ||
    (base === 'shot_types' &&
      SHOT_TYPE_SLICES.has(sliceKey) &&
      ['FG2M', 'FG2A', 'FG3M', 'FG3A'].includes(statKey)) ||
    (base === 'assist_locations' && ASSIST_LOCATION_SLICES.has(sliceKey)) ||
    (base === 'traditional' && TRADITIONAL_SLICES.has(sliceKey));
  if (!valid) throw invalid();
  return { sliceKey, markets: expectedSheetMarkets(base, sliceKey, statKey) };
};

const decodeRetrievedAt = (value) => {
  if (value === null) return null;
  const date = new Date(requireString(value));
  if (Number.isNaN(date.getTime())) throw invalid();
  return date.toISOString();
};

const SECTION_STATE_KEYS = ['status', 'source', 'context', 'unavailable_reason'];
// The mode owns its evidence vocabulary. A completed season cannot be described
// as pregame, and a live slate cannot be described as hindsight, so a response
// that mixes them is incoherent rather than merely unusual.
const MODE_PLAYER_SOURCES = { historical: 'game_logs', current: 'player_pool' };
// Provenance is owned by the section, not the mode. Each section names the one
// source and context its own evidence can truthfully have. Historical Last-15
// and injuries describe archived pregame snapshots when any were captured.
const SECTION_PROVENANCE = {
  historical: {
    schedule: { source: 'event_catalog', context: 'completed_season_catalog' },
    participants: { source: 'player_game_logs', context: 'completed_season' },
    season_defense: { source: 'team_matchup_publication', context: 'completed_season' },
    last_15_defense: { source: 'team_matchup_publication', context: 'pregame' },
    injuries: { source: 'rotowire', context: 'pregame' },
  },
  current: {
    schedule: { source: 'event_catalog', context: 'current_season_catalog' },
    participants: { source: 'player_pool', context: 'posted_markets' },
    season_defense: { source: 'team_matchup_publication', context: 'pregame' },
    last_15_defense: { source: 'team_matchup_publication', context: 'pregame' },
    injuries: { source: 'rotowire', context: 'current' },
  },
};

// Only the schedule section carries collection provenance. It is immutable
// evidence of a completed season, never an age-based staleness signal.
const decodeExperienceSection = (section, name, mode) => {
  const allowedKeys =
    name === 'schedule' ? [...SECTION_STATE_KEYS, 'collected_at'] : SECTION_STATE_KEYS;
  if (
    !isRecord(section) ||
    SECTION_STATE_KEYS.some((key) => !Object.hasOwn(section, key)) ||
    Object.keys(section).some((key) => !allowedKeys.includes(key)) ||
    !['available', 'unavailable', 'missing'].includes(section.status) ||
    (section.source !== null && section.source !== SECTION_PROVENANCE[mode][name].source) ||
    (section.context !== null && section.context !== SECTION_PROVENANCE[mode][name].context) ||
    // An available section owns its evidence, so it must name where that
    // evidence came from and what it describes.
    (section.status === 'available'
      ? section.unavailable_reason !== null || section.source === null || section.context === null
      : typeof section.unavailable_reason !== 'string' || !section.unavailable_reason)
  ) {
    throw invalid();
  }
  return {
    status: section.status,
    source: section.source,
    context: section.context,
    unavailableReason: section.unavailable_reason,
    collectedAt: decodeRetrievedAt(section.collected_at ?? null),
  };
};

// The rollout is backend-first, so an absent block means the pre-historical
// live contract rather than an unreadable response.
const decodeExperience = (experience) => {
  if (experience === undefined || experience === null) {
    return { mode: 'current', playerSource: 'player_pool', sections: null };
  }
  if (
    !isRecord(experience) ||
    !EXPERIENCE_MODES.includes(experience.mode) ||
    !PLAYER_SOURCES.includes(experience.player_source) ||
    experience.player_source !== MODE_PLAYER_SOURCES[experience.mode] ||
    !isRecord(experience.sections) ||
    Object.keys(experience.sections).sort().join() !== [...EXPERIENCE_SECTIONS].sort().join()
  ) {
    throw invalid();
  }
  return {
    mode: experience.mode,
    playerSource: experience.player_source,
    sections: Object.fromEntries(
      EXPERIENCE_SECTIONS.map((section) => [
        camelKey(section),
        decodeExperienceSection(experience.sections[section], section, experience.mode),
      ]),
    ),
  };
};

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
    percentVsLeagueAverage: decodeRelativePercentage(value.percent_vs_league_average),
    sigmaDeviation: requireNumber(value.sigma_deviation),
    rank: requireNumber(value.rank),
  };
};

const decodeSheetRow = (row, availability, base) => {
  if (!isRecord(row)) throw invalid();
  const key = requireString(row.key);
  const identity = decodeSheetIdentity(base, key);
  if (identity === null) return null;
  const markets = requireStringList(row.markets);
  if (markets.join() !== identity.markets.join()) throw invalid();
  return {
    key,
    sliceKey: identity.sliceKey,
    label: requireString(row.label),
    markets,
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
        rows
          .map((row) => decodeSheetRow(row, surfaceAvailability[camelKey(base)], base))
          .filter(Boolean),
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
    percentVsLeagueAverage: decodeRelativePercentage(value.percent_vs_league_average),
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
          const leagueAverageShare = requireNumberOrNull(season.league_average_share);
          const sigmaDeviation = requireNumberOrNull(season.sigma_deviation);
          return {
            key: requireString(entry.key),
            season: {
              share,
              volume,
              gamesPlayed: season.games_played,
              volumeUnit: requireString(season.volume_unit),
              volumePerGame: volume / season.games_played,
              leagueAverageShare,
              sigmaDeviation,
            },
          };
        }),
      ];
    }),
  );
};

const decodeCategoryList = (value) => {
  const categories = requireStringList(value);
  if (
    new Set(categories).size !== categories.length ||
    categories.some((category) => !MARKET_CATEGORIES.has(category))
  ) {
    throw invalid();
  }
  return categories;
};

// The focal line has one shape. The matchup and selection responses only differ
// in which rejection they raise, so they share this translation.
const decodeFocalLine = (line, statCategories, { fail, requireText, requireValue }) => {
  if (line === null || line === undefined) return null;
  if (!isRecord(line) || !isRecord(line.stats)) throw fail();
  if (statCategories.some((category) => !Object.hasOwn(line.stats, category))) throw fail();
  return {
    gameId: requireText(line.game_id),
    gameDate: requireText(line.game_date),
    matchup: requireText(line.matchup),
    minutes: requireValue(line.minutes),
    stats: Object.fromEntries(
      Object.entries(line.stats).map(([category, value]) => [category, requireValue(value)]),
    ),
  };
};

const decodeFocalGameLine = (line, statCategories) =>
  decodeFocalLine(line, statCategories, {
    fail: invalid,
    requireText: requireString,
    requireValue: requireNumber,
  });

const DAY_MS = 24 * 60 * 60 * 1000;

// A date fence is only meaningful over real calendar dates, so a string that
// merely looks sortable is not one.
const isCalendarDate = (value) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};

// A game's local calendar date is either the UTC date of its tip or the day
// before it, for every North American time zone the league plays in.
const focalDateFits = (gameDate, scheduledAt) => {
  if (!isCalendarDate(gameDate)) return false;
  const utcDate = scheduledAt.slice(0, 10);
  const dayBefore = new Date(new Date(`${utcDate}T00:00:00Z`).getTime() - DAY_MS)
    .toISOString()
    .slice(0, 10);
  return gameDate === utcDate || gameDate === dayBefore;
};

const decodePlayer = (player, experience, game) => {
  if (!isRecord(player) || !Number.isInteger(player.team_id)) throw invalid();
  if (!Array.isArray(player.last_10_minutes)) throw invalid();
  // A participant played for one of this game's two teams, under the identity
  // the game header records for it.
  const tricode = requireString(player.tricode);
  const focalTeam = [game.away, game.home].find((team) => team.teamId === player.team_id);
  if (!focalTeam || focalTeam.tricode !== tricode) throw invalid();
  // A participant cannot claim a different source than its own experience.
  const playerSource = player.player_source ?? experience.playerSource;
  if (!PLAYER_SOURCES.includes(playerSource) || playerSource !== experience.playerSource)
    throw invalid();
  const gameLogSourced = playerSource === 'game_logs';
  const postedMarkets = decodeCategoryList(player.posted_markets);
  // A game-log participant carries no posted-market claim at all.
  if (gameLogSourced ? postedMarkets.length !== 0 : postedMarkets.length === 0) throw invalid();
  const statCategories =
    player.stat_categories === undefined
      ? postedMarkets
      : decodeCategoryList(player.stat_categories);
  if (statCategories.length === 0) throw invalid();
  // Current-mode categories are the posted markets. Keeping them identical is
  // what lets the live Player Pool controls and selection stay unchanged.
  if (!gameLogSourced && statCategories.join() !== postedMarkets.join()) throw invalid();
  if (gameLogSourced && (!isRecord(player.provenance) || Object.keys(player.provenance).length))
    throw invalid();
  const focalGameLine = decodeFocalGameLine(player.focal_game_line, statCategories);
  // A historical participant always has a focal line; a pool player never does.
  // The line is evidence about this game, so its game, matchup identity, and
  // date must all be this game's.
  if (gameLogSourced ? focalGameLine === null : focalGameLine !== null) throw invalid();
  const isHome = focalTeam.teamId === game.home.teamId;
  const opposingTeam = isHome ? game.away : game.home;
  const expectedMatchup = `${tricode} ${isHome ? 'vs.' : '@'} ${opposingTeam.tricode}`;
  if (
    focalGameLine !== null &&
    (focalGameLine.gameId !== game.gameId ||
      focalGameLine.matchup !== expectedMatchup ||
      !focalDateFits(focalGameLine.gameDate, game.scheduledAt))
  ) {
    throw invalid();
  }
  return {
    id: requireInteger(player.canonical_id),
    name: requireString(player.name),
    teamId: player.team_id,
    tricode,
    playerSource,
    postedMarkets,
    statCategories,
    provenance: gameLogSourced ? {} : decodeProvenance(player.provenance, postedMarkets),
    focalGameLine,
    seasonScoring: player.season_scoring === null ? null : requireNumber(player.season_scoring),
    last10Minutes: player.last_10_minutes.map(requireNumber),
    dietShares: decodeDietShares(player.diet_shares),
    injuryBadgeRef:
      player.injury_badge_ref === null ? null : requireString(player.injury_badge_ref),
    scores: decodeScores(player.scores, statCategories, gameLogSourced),
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
      const decodedRows = rows
        .map((row) => {
          if (!isRecord(row)) throw invalid();
          const key = requireString(row.key);
          const identity = decodeSheetIdentity(base, key);
          if (identity === null) return null;
          return {
            key,
            sliceKey: identity.sliceKey,
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
        })
        .filter(Boolean);
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

const validateStructuralZeroPercentages = (league, teams) => {
  for (const team of teams) {
    for (const [base, rows] of Object.entries(team.defenseSheet)) {
      const leagueRows = new Map(league.defenseSheet[base].map((row) => [row.key, row]));
      for (const row of rows) {
        for (const windowKey of ['season', 'last15']) {
          const value = row[windowKey];
          if (value?.percentVsLeagueAverage !== null) continue;
          const leagueValue = leagueRows.get(row.key)?.[windowKey];
          if (value.allowedPer48 !== 0 && (!leagueValue || leagueValue.averageAllowedPer48 !== 0)) {
            throw invalid();
          }
        }
      }
    }
    for (const [key, windows] of Object.entries(team.defensiveColumns)) {
      for (const windowKey of ['season', 'last15']) {
        const value = windows[windowKey];
        if (value?.percentVsLeagueAverage !== null) continue;
        const leagueValue = league.defensiveColumns[key][windowKey];
        if (value.per48 !== 0 && (!leagueValue || leagueValue.averagePer48 !== 0)) {
          throw invalid();
        }
      }
    }
  }
};

const decodeScoreCell = (cell) => {
  if (!isRecord(cell) || typeof cell.thin !== 'boolean') throw invalid();
  return { value: requireNumber(cell.value), thin: cell.thin };
};

const DEFENSIVE_SCORE_MARKETS = new Set(['TOV', 'STL', 'BLK', 'STKS']);

const decodeScoreWindow = (window, market, historical) => {
  if (!isRecord(window) || !isRecord(window.components)) throw invalid();
  const defensive = DEFENSIVE_SCORE_MARKETS.has(market);
  const componentBases = Object.keys(window.components);
  if (
    componentBases.some((base) => !DEFENSE_BASES.includes(base)) ||
    (defensive && componentBases.some((base) => base !== 'traditional'))
  )
    throw invalid();
  const missingInputs =
    window.missing_inputs === undefined ? [] : requireStringList(window.missing_inputs);
  if (
    new Set(missingInputs).size !== missingInputs.length ||
    missingInputs.some((input) => !MISSING_INPUT_PATTERN.test(input))
  ) {
    throw invalid();
  }
  const componentCount = componentBases.length;
  // A historical window may show its components while withholding a Blend the
  // score contract could not complete, and names what was missing. It may never
  // present a Blend as complete while naming a missing input.
  const withheldBlend = historical && window.blend === null && missingInputs.length > 0;
  const validOffensiveBlend =
    componentCount === 0 ? window.blend === null : isRecord(window.blend) || withheldBlend;
  if ((!defensive && !validOffensiveBlend) || (defensive && window.blend != null)) {
    throw invalid();
  }
  if (historical && isRecord(window.blend) && missingInputs.length > 0) throw invalid();
  // A withheld historical score has to say what it was missing, or the page has
  // nothing truthful to explain the gap with.
  const withheldScore = defensive ? componentCount === 0 : window.blend === null;
  if (historical && withheldScore && missingInputs.length === 0) throw invalid();
  return {
    components: Object.fromEntries(
      Object.entries(window.components).map(([base, cell]) => [
        camelKey(base),
        decodeScoreCell(cell),
      ]),
    ),
    blend: defensive || window.blend === null ? null : decodeScoreCell(window.blend),
    missingInputs,
  };
};

function decodeScores(scores, statCategories, historical) {
  if (
    !isRecord(scores) ||
    Object.keys(scores).sort().join() !== [...statCategories].sort().join() ||
    statCategories.some(
      (category) =>
        !isRecord(scores[category]) ||
        Object.keys(scores[category]).sort().join() !== ['season', 'last_15'].sort().join(),
    )
  ) {
    throw invalid();
  }
  return Object.fromEntries(
    statCategories.map((category) => [
      category,
      {
        season: decodeScoreWindow(scores[category].season, category, historical),
        last15: decodeScoreWindow(scores[category].last_15, category, historical),
      },
    ]),
  );
}

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

// A defense section speaks for one window's Surfaces and for nothing else, so
// each window's section status must agree with what that window delivered.
const validateSectionSurfaces = (sections, surfaceAvailability) => {
  [
    ['season', sections.seasonDefense],
    ['last15', sections.last15Defense],
  ].forEach(([windowKey, section]) => {
    const delivered = Object.values(surfaceAvailability).some(
      (windows) => windows[windowKey].status === 'available',
    );
    if (delivered !== (section.status === 'available')) throw invalid();
  });
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
  validateStructuralZeroPercentages(league, teams);
  const injuries = decodeInjuries(data.injuries, teams);
  const freshness = decodeFreshness(data.freshness);
  if (
    freshness.injuries.status !== injuries.status ||
    freshness.injuries.retrievedAt !== injuries.retrievedAt
  )
    throw invalid();
  const experience = decodeExperience(data.experience);
  const game = decodeGame(data.game);
  // The sheets the toggle switches between are this game's own two teams, under
  // the identities the game header records. Their delivered order is the live
  // contract's business; only a historical response is held to away-then-home.
  const focalTeams = [game.away, game.home];
  if (
    teams.some(
      (team) =>
        !focalTeams.some((focal) => focal.teamId === team.teamId && focal.tricode === team.tricode),
    ) ||
    new Set(teams.map((team) => team.teamId)).size !== teams.length ||
    (experience.mode === 'historical' &&
      teams.some((team, index) => team.teamId !== focalTeams[index].teamId))
  ) {
    throw invalid();
  }
  // Historical mode describes a completed, non-postponed Regular Season game.
  // The mode itself stays backend-declared; only its coherence is checked.
  if (experience.mode === 'historical' && (game.status !== 'final' || game.preseason)) {
    throw invalid();
  }
  if (experience.sections) validateSectionSurfaces(experience.sections, league.surfaceAvailability);
  const players = data.players.map((player) => decodePlayer(player, experience, game));
  // One game is focal, so every participant's line has to date it the same way.
  const focalDates = new Set(
    players.map((player) => player.focalGameLine?.gameDate).filter(Boolean),
  );
  if (focalDates.size > 1) throw invalid();
  return { game, experience, league, teams, players, injuries, freshness };
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

const decodeLogLine = (line, markets, focalGame) => {
  if (!isRecord(line)) throw selectionInvalid();
  if (!['game', 'average'].includes(line.row_type)) throw selectionInvalid();
  const average = line.row_type === 'average';
  if (
    (average && (line.game_date !== null || line.matchup !== null)) ||
    (!average && (typeof line.game_date !== 'string' || typeof line.matchup !== 'string'))
  ) {
    throw selectionInvalid();
  }
  // A pregame sample is strictly earlier than the game it contextualizes, which
  // is what excludes the focal game itself rather than a flag claiming so.
  if (
    !average &&
    focalGame &&
    (!isCalendarDate(line.game_date) || line.game_date >= focalGame.gameDate)
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

const decodeLogTable = (table, markets, focalGame) => {
  if (!isRecord(table) || !Array.isArray(table.rows) || typeof table.thin !== 'boolean')
    throw selectionInvalid();
  const rows = table.rows.map((row) => decodeLogLine(row, markets, focalGame));
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

const decodeFocalGame = (focalGame, statCategories) =>
  decodeFocalLine(focalGame, statCategories, {
    fail: selectionInvalid,
    requireText: requireSelectionString,
    requireValue: requireSelectionNumber,
  });

// The dossier's separation labels are driven by these fields, so a response
// that mislabels them would silently drop a required disclosure.
const SELECTION_MODE_CONTRACT = {
  historical: {
    focalGame: true,
    samplesContext: 'pregame',
    excludesFocalGame: true,
    baselineContext: 'completed_season',
    hindsight: true,
  },
  current: {
    focalGame: false,
    samplesContext: 'season_to_date',
    excludesFocalGame: false,
    baselineContext: 'season_to_date',
    hindsight: false,
  },
};

const decodeSelectionExperience = (experience, statCategories, expected) => {
  if (experience === undefined || experience === null) {
    // A historical dossier must carry its own evidence, or its strict-before
    // and hindsight disclosures would silently disappear.
    if (expected.mode === 'historical') throw selectionInvalid();
    return null;
  }
  if (
    !isRecord(experience) ||
    !EXPERIENCE_MODES.includes(experience.mode) ||
    (expected.mode !== undefined && experience.mode !== expected.mode) ||
    experience.player_source !== MODE_PLAYER_SOURCES[experience.mode] ||
    !isRecord(experience.samples) ||
    !isRecord(experience.baseline) ||
    typeof experience.samples.excludes_focal_game !== 'boolean' ||
    typeof experience.baseline.hindsight !== 'boolean'
  ) {
    throw selectionInvalid();
  }
  const required = SELECTION_MODE_CONTRACT[experience.mode];
  if (
    isRecord(experience.focal_game) !== required.focalGame ||
    experience.samples.context !== required.samplesContext ||
    experience.samples.excludes_focal_game !== required.excludesFocalGame ||
    experience.baseline.context !== required.baselineContext ||
    experience.baseline.hindsight !== required.hindsight
  ) {
    throw selectionInvalid();
  }
  const focalGame = decodeFocalGame(experience.focal_game, statCategories);
  if (focalGame !== null && !isCalendarDate(focalGame.gameDate)) throw selectionInvalid();
  // The dossier contextualizes the focal game the client asked about, and it
  // cannot contradict the participant's own line for that game.
  if (focalGame !== null && expected.gameId !== undefined && focalGame.gameId !== expected.gameId) {
    throw selectionInvalid();
  }
  const line = expected.focalGameLine;
  if (
    focalGame !== null &&
    line &&
    (focalGame.gameId !== line.gameId ||
      focalGame.gameDate !== line.gameDate ||
      focalGame.matchup !== line.matchup ||
      focalGame.minutes !== line.minutes ||
      Object.entries(line.stats).some(
        ([category, value]) =>
          focalGame.stats[category] !== undefined && focalGame.stats[category] !== value,
      ))
  ) {
    throw selectionInvalid();
  }
  return {
    mode: experience.mode,
    playerSource: experience.player_source,
    focalGame,
    samples: {
      context: requireSelectionString(experience.samples.context),
      excludesFocalGame: experience.samples.excludes_focal_game,
    },
    baseline: {
      context: requireSelectionString(experience.baseline.context),
      hindsight: experience.baseline.hindsight,
    },
  };
};

// `expected` binds the response to the matchup the client asked about: the
// game it must contextualize, and the experience it must disclose.
export const decodeMatchupSelection = (data, statCategories, expectedPlayerId, expected = {}) => {
  if (!isRecord(data) || !Array.isArray(statCategories) || statCategories.length === 0)
    throw selectionInvalid();
  if (!Number.isInteger(data.player_id) || data.player_id !== expectedPlayerId) {
    throw selectionInvalid();
  }
  const experience = decodeSelectionExperience(data.experience, statCategories, expected);
  const focalGame = experience?.mode === 'historical' ? experience.focalGame : null;
  return {
    playerId: data.player_id,
    experience,
    h2h: decodeLogTable(data.h2h, statCategories, focalGame),
    archetype: decodeLogTable(data.archetype, statCategories, focalGame),
  };
};

export const fetchMatchupSelection = async (
  gameId,
  playerId,
  statCategories,
  { signal, mode, focalGameLine } = {},
) => {
  if (
    typeof gameId !== 'string' ||
    !gameId ||
    !Number.isInteger(playerId) ||
    !Array.isArray(statCategories) ||
    statCategories.length === 0
  )
    throw selectionInvalid();
  const response = await apiClient.get(getApiUrl('MATCHUP_SELECTION'), {
    params: { game_id: gameId, player_id: playerId },
    signal,
  });
  return decodeMatchupSelection(response.data, statCategories, playerId, {
    gameId,
    mode,
    focalGameLine,
  });
};
