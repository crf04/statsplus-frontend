const definitions = {
  fresh: {
    allowedSurfaces: ['schedule', 'pool'],
    allowsNullRetrievedAt: false,
    providerRank: 0,
    warning: false,
    currentPoolMessage: 'Targetable counts use the current player pool.',
    historicalPoolMessage:
      'Past slate — the current player pool is not displayed for historical dates. Final game cards retain the posted targetable counts returned for this slate.',
  },
  stale: {
    allowedSurfaces: ['schedule'],
    allowsNullRetrievedAt: false,
    providerRank: null,
    warning: true,
  },
  'stale-served': {
    allowedSurfaces: ['pool'],
    allowsNullRetrievedAt: false,
    providerRank: 1,
    warning: true,
    currentPoolMessage:
      'Player pool is stale-served; targetable counts use the latest available snapshot.',
    historicalPoolMessage:
      'Past slate — the latest available snapshot is not displayed for historical dates. Final game cards retain the posted targetable counts returned for this slate.',
  },
  missing: {
    allowedSurfaces: ['schedule', 'pool'],
    allowsNullRetrievedAt: true,
    providerRank: 2,
    warning: true,
    currentPoolMessage: 'Player pool unavailable; no targetable players are currently available.',
    historicalPoolMessage:
      'Past slate — the player pool is missing and no current pool is displayed. Game cards retain the targetable counts returned for this slate.',
  },
  unavailable: {
    allowedSurfaces: ['pool'],
    allowsNullRetrievedAt: true,
    providerRank: 3,
    warning: true,
    currentPoolMessage: 'Player pool unavailable; no targetable players are currently available.',
    historicalPoolMessage:
      'Past slate — the player pool is unavailable and no current pool is displayed. Game cards retain the returned targetable counts for this slate.',
  },
};

export const getStatusPresentation = (status) => definitions[status];

export const isStatusAllowed = (status, surface) =>
  Boolean(definitions[status]?.allowedSurfaces.includes(surface));

export const statusAllowsNullRetrievedAt = (status) =>
  Boolean(definitions[status]?.allowsNullRetrievedAt);

export const derivePoolStatusFromProviders = (providers) => {
  return providers.reduce((highest, provider) => {
    const rank = definitions[provider.status]?.providerRank;
    if (rank === null || rank === undefined) return highest;
    if (!highest || rank > definitions[highest].providerRank) return provider.status;
    return highest;
  }, null);
};

export const SCHEDULE_STALE_AFTER_MS = 30 * 60 * 60 * 1000;
export const POOL_STALE_AFTER_MS = 15 * 60 * 1000;

export const deriveScheduleStatus = (retrievedAt, now = Date.now()) =>
  now - new Date(retrievedAt).getTime() <= SCHEDULE_STALE_AFTER_MS ? 'fresh' : 'stale';

export const getSurfaceFreshnessPresentation = (surface, surfaceName, now = Date.now()) => {
  let status = surface.status;
  let warning = definitions[status].warning;
  let thresholdNote = null;

  if (status === 'fresh' && surface.retrievedAt) {
    if (surfaceName === 'schedule' && deriveScheduleStatus(surface.retrievedAt, now) === 'stale') {
      status = 'stale';
      warning = true;
    }
    if (
      surfaceName === 'pool' &&
      now - new Date(surface.retrievedAt).getTime() > POOL_STALE_AFTER_MS
    ) {
      warning = true;
      thresholdNote = 'older than 15m freshness bar';
    }
  }

  return { status, warning, thresholdNote };
};
