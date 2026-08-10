import { apiClient, getApiUrl } from './config';
import { isCalendarDate } from './calendarDate';

const createInvalidSlateError = () => new Error('The slate endpoint returned an invalid response.');

const scheduleStatuses = new Set(['fresh', 'stale', 'missing']);
const poolStatuses = new Set(['fresh', 'stale-served', 'missing', 'unavailable']);

const decodeRetrievedAt = (value) => {
  if (value === null) return null;
  if (typeof value !== 'string') throw createInvalidSlateError();
  const retrievedAt = new Date(value);
  if (Number.isNaN(retrievedAt.getTime())) throw createInvalidSlateError();
  return retrievedAt.toISOString();
};

const decodeFreshnessSurface = (surface, statuses) => {
  if (!surface || !statuses.has(surface.status) || !('retrieved_at' in surface)) {
    throw createInvalidSlateError();
  }
  const retrievedAt = decodeRetrievedAt(surface.retrieved_at);
  if (!retrievedAt && !['missing', 'unavailable'].includes(surface.status)) {
    throw createInvalidSlateError();
  }
  return { status: surface.status, retrievedAt };
};

const decodeFreshness = (freshness) => {
  if (!freshness || typeof freshness !== 'object') throw createInvalidSlateError();
  const schedule = decodeFreshnessSurface(freshness.schedule, scheduleStatuses);
  const poolSurface = decodeFreshnessSurface(freshness.pool, poolStatuses);
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
    return { name, ...decodeFreshnessSurface(surface, poolStatuses) };
  });
  return { schedule, pool: { ...poolSurface, providers } };
};

const derivePoolStatus = (aggregateStatus, pool) => {
  if (['fresh', 'stale-served'].includes(pool.status)) return pool.status;
  const providerStatuses = pool.providers.map(({ status }) => status);
  if (providerStatuses.includes('fresh')) return 'fresh';
  if (providerStatuses.includes('stale-served')) return 'stale-served';
  return aggregateStatus || pool.status;
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
    typeof game.status.label !== 'string' ||
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
    statusLabel: game.status.label,
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
    (data.pool_status !== undefined && !poolStatuses.has(data.pool_status))
  ) {
    throw createInvalidSlateError();
  }

  const freshness = decodeFreshness(data.freshness);

  return {
    slateDate: data.slate_date,
    freshness,
    poolStatus: derivePoolStatus(data.pool_status, freshness.pool),
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
