const definitions = {
  fresh: {
    schedule: true,
    pool: true,
    warning: false,
    currentPoolMessage: 'Targetable counts use the current player pool.',
    historicalPoolMessage:
      'Past slate — the current player pool is not displayed for historical dates. Final game cards retain the posted targetable counts returned for this slate.',
  },
  stale: { schedule: true, pool: false, warning: true },
  'stale-served': {
    schedule: false,
    pool: true,
    warning: true,
    currentPoolMessage:
      'Player pool is stale-served; targetable counts use the latest available snapshot.',
    historicalPoolMessage:
      'Past slate — the latest available snapshot is not displayed for historical dates. Final game cards retain the posted targetable counts returned for this slate.',
  },
  missing: {
    schedule: true,
    pool: true,
    warning: true,
    currentPoolMessage: 'Player pool unavailable; no targetable players are currently available.',
    historicalPoolMessage:
      'Past slate — the player pool is missing and no current pool is displayed. Game cards retain the targetable counts returned for this slate.',
  },
  unavailable: {
    schedule: false,
    pool: true,
    warning: true,
    currentPoolMessage: 'Player pool unavailable; no targetable players are currently available.',
    historicalPoolMessage:
      'Past slate — the player pool is unavailable and no current pool is displayed. Game cards retain the returned targetable counts for this slate.',
  },
};

export const scheduleStatuses = new Set(
  Object.entries(definitions)
    .filter(([, definition]) => definition.schedule)
    .map(([status]) => status),
);

export const poolStatuses = new Set(
  Object.entries(definitions)
    .filter(([, definition]) => definition.pool)
    .map(([status]) => status),
);

export const getStatusPresentation = (status) => definitions[status];

export const derivePoolStatusFromProviders = (providers) => {
  const statuses = providers.map(({ status }) => status);
  if (statuses.includes('fresh')) return 'fresh';
  if (statuses.includes('stale-served')) return 'stale-served';
  if (statuses.includes('unavailable')) return 'unavailable';
  if (statuses.includes('missing')) return 'missing';
  return null;
};
