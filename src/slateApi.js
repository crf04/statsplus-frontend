import { apiClient, getApiUrl } from './config';
import { isCalendarDate } from './calendarDate';
import { isRecord } from './decoding';
import {
  derivePoolStatusFromProviders,
  deriveScheduleStatus,
  isStatusAllowed,
  statusAllowsNullRetrievedAt,
} from './slateStatus';
import { servingSeasonDecoders } from './servingSeason';

const createInvalidSlateError = () => new Error('The slate endpoint returned an invalid response.');
const MISSING_TEAM_NAME_SENTINEL = 'None';
const { decodeTrailing } = servingSeasonDecoders(createInvalidSlateError);

const decodeRetrievedAt = (value) => {
  if (value === null) return null;
  if (typeof value !== 'string') throw createInvalidSlateError();
  const retrievedAt = new Date(value);
  if (Number.isNaN(retrievedAt.getTime())) throw createInvalidSlateError();
  return retrievedAt.toISOString();
};

const decodeFreshnessSurface = (surface, surfaceName) => {
  if (
    !isRecord(surface) ||
    !isStatusAllowed(surface.status, surfaceName) ||
    !('retrieved_at' in surface)
  ) {
    throw createInvalidSlateError();
  }
  const retrievedAt = decodeRetrievedAt(surface.retrieved_at);
  if (!retrievedAt && !statusAllowsNullRetrievedAt(surface.status)) {
    throw createInvalidSlateError();
  }
  return { status: surface.status, retrievedAt };
};

const decodeDerivedSchedule = (surface) => {
  if (!isRecord(surface) || !('retrieved_at' in surface)) throw createInvalidSlateError();
  const retrievedAt = decodeRetrievedAt(surface.retrieved_at);
  if (!retrievedAt) throw createInvalidSlateError();
  return { status: deriveScheduleStatus(retrievedAt), retrievedAt };
};

const decodeFreshness = (freshness) => {
  if (!isRecord(freshness) || !isRecord(freshness.pool)) {
    throw createInvalidSlateError();
  }
  const schedule =
    freshness.schedule?.status === undefined
      ? decodeDerivedSchedule(freshness.schedule)
      : decodeFreshnessSurface(freshness.schedule, 'schedule');
  const providerSurfaces = freshness.pool.providers;
  if (
    providerSurfaces !== undefined &&
    (typeof providerSurfaces !== 'object' ||
      providerSurfaces === null ||
      Array.isArray(providerSurfaces))
  ) {
    throw createInvalidSlateError();
  }
  const providers = Object.entries(providerSurfaces || {}).map(([name, surface]) => {
    if (!name) throw createInvalidSlateError();
    return { name, ...decodeFreshnessSurface(surface, 'pool') };
  });
  let poolSurface;
  if (freshness.pool.status !== undefined) {
    poolSurface = decodeFreshnessSurface(freshness.pool, 'pool');
  } else {
    const status = derivePoolStatusFromProviders(providers);
    if (!status) throw createInvalidSlateError();
    const poolRetrievedAt =
      'retrieved_at' in freshness.pool ? decodeRetrievedAt(freshness.pool.retrieved_at) : null;
    const providerRetrievedAt = providers
      .map(({ retrievedAt }) => retrievedAt)
      .filter(Boolean)
      .sort()
      .at(0);
    const retrievedAt = poolRetrievedAt || providerRetrievedAt || null;
    poolSurface = { status, retrievedAt };
  }
  return { schedule, pool: { ...poolSurface, providers } };
};

const decodeTeam = (team) => {
  if (
    !team ||
    !Number.isInteger(team.team_id) ||
    typeof team.tricode !== 'string' ||
    typeof team.name !== 'string' ||
    !Number.isInteger(team.targetable_player_count)
  ) {
    throw createInvalidSlateError();
  }

  return {
    teamId: team.team_id,
    tricode: team.tricode,
    name: team.name === MISSING_TEAM_NAME_SENTINEL ? team.tricode : team.name,
    targetablePlayerCount: team.targetable_player_count,
  };
};

const decodeGame = (game) => {
  if (
    !game ||
    typeof game.game_id !== 'string' ||
    typeof game.scheduled_at !== 'string' ||
    !game.status ||
    !['scheduled', 'postponed', 'final'].includes(game.status.state) ||
    (game.status.label !== undefined && typeof game.status.label !== 'string') ||
    typeof game.preseason !== 'boolean'
  ) {
    throw createInvalidSlateError();
  }

  const scheduledAt = new Date(game.scheduled_at);
  if (Number.isNaN(scheduledAt.getTime())) throw createInvalidSlateError();

  return {
    gameId: game.game_id,
    away: decodeTeam(game.away_team),
    home: decodeTeam(game.home_team),
    scheduledAt: scheduledAt.toISOString(),
    status: game.status.state,
    statusLabel: game.status.label || null,
    classification: typeof game.classification === 'string' ? game.classification : null,
    preseason: game.preseason,
  };
};

// An older backend omits the neighbours, which reads the same as having none.
const decodeNeighbourDate = (value) => (isCalendarDate(value) ? value : null);

// The always-present `fallback` names a Slate answered for the previous game
// day, or for the next one, because the current one has no games
// (crf04/statsplus#217, #242). A backend that predates it omits the field,
// which reads as no fallback.
const FALLBACKS = new Set(['previous_game_day', 'next_game_day']);
const decodeFallback = (value) => {
  if (value === undefined || value === null) return null;
  if (!FALLBACKS.has(value)) throw createInvalidSlateError();
  return value;
};

export const decodeSlate = (data) => {
  if (!data || !isCalendarDate(data.slate_date) || !Array.isArray(data.games) || !data.freshness) {
    throw createInvalidSlateError();
  }

  const freshness = decodeFreshness(data.freshness);

  return {
    slateDate: data.slate_date,
    previousGameDate: decodeNeighbourDate(data.previous_game_date),
    nextGameDate: decodeNeighbourDate(data.next_game_date),
    fallback: decodeFallback(data.fallback),
    freshness,
    games: data.games.map(decodeGame),
    trailing: decodeTrailing(data.trailing),
  };
};

export const fetchSlate = async (date, { signal, fallback } = {}) => {
  const response = await apiClient.get(getApiUrl('SLATE'), {
    params: { ...(date ? { date } : {}), ...(fallback ? { fallback } : {}) },
    signal,
  });
  return decodeSlate(response.data);
};
