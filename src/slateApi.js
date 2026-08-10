import { apiClient, getApiUrl } from './config';
import { isCalendarDate } from './calendarDate';
import {
  derivePoolStatusFromProviders,
  deriveScheduleStatus,
  isStatusAllowed,
  statusAllowsNullRetrievedAt,
} from './slateStatus';

const createInvalidSlateError = () => new Error('The slate endpoint returned an invalid response.');

const decodeRetrievedAt = (value) => {
  if (value === null) return null;
  if (typeof value !== 'string') throw createInvalidSlateError();
  const retrievedAt = new Date(value);
  if (Number.isNaN(retrievedAt.getTime())) throw createInvalidSlateError();
  return retrievedAt.toISOString();
};

const decodeFreshnessSurface = (surface, surfaceName) => {
  if (!surface || !isStatusAllowed(surface.status, surfaceName) || !('retrieved_at' in surface)) {
    throw createInvalidSlateError();
  }
  const retrievedAt = decodeRetrievedAt(surface.retrieved_at);
  if (!retrievedAt && !statusAllowsNullRetrievedAt(surface.status)) {
    throw createInvalidSlateError();
  }
  return { status: surface.status, retrievedAt };
};

const decodeDerivedSchedule = (surface) => {
  if (!surface || !('retrieved_at' in surface)) throw createInvalidSlateError();
  const retrievedAt = decodeRetrievedAt(surface.retrieved_at);
  if (!retrievedAt) throw createInvalidSlateError();
  return { status: deriveScheduleStatus(retrievedAt), retrievedAt };
};

const decodeFreshness = (freshness) => {
  if (!freshness || typeof freshness !== 'object' || !freshness.pool) {
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
      .at(-1);
    const retrievedAt =
      poolRetrievedAt ||
      providers.find((provider) => provider.status === status)?.retrievedAt ||
      providerRetrievedAt ||
      null;
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
    name: team.name,
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

export const decodeSlate = (data) => {
  if (
    !data ||
    !isCalendarDate(data.slate_date) ||
    !Array.isArray(data.games) ||
    !data.freshness ||
    (data.pool_status !== undefined && !isStatusAllowed(data.pool_status, 'pool'))
  ) {
    throw createInvalidSlateError();
  }

  const freshness = decodeFreshness(data.freshness);

  return {
    slateDate: data.slate_date,
    freshness,
    poolStatus: data.pool_status ?? freshness.pool.status,
    games: data.games.map(decodeGame),
  };
};

export const fetchSlate = async (date, { signal } = {}) => {
  const response = await apiClient.get(getApiUrl('SLATE'), {
    params: date ? { date } : {},
    signal,
  });
  return decodeSlate(response.data);
};
