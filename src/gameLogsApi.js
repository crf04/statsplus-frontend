import { apiClient, getApiUrl } from './config';

const parseJsonValue = (value, fallback, fieldName) => {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value !== 'string') return value;

  try {
    return JSON.parse(value);
  } catch (error) {
    const parseError = new Error(`Invalid ${fieldName} response from the API.`);
    parseError.cause = error;
    throw parseError;
  }
};

const firstRecord = (value) => {
  if (Array.isArray(value)) return value[0] || {};
  if (value && typeof value === 'object') return value;
  return {};
};

// How many games the unfiltered season holds (crf04/statsplus#88). An older
// backend or a malformed value must not invent a season size, so anything but a
// non-negative integer is unknown.
const seasonGameCount = (value) => (Number.isInteger(value) && value >= 0 ? value : null);

/** Decode the backend's JSON-string-or-object response once at the API seam. */
export const decodeGameLogsResponse = (payload = {}) => {
  if (!payload || typeof payload !== 'object') {
    throw new Error('The game logs API returned an invalid response.');
  }

  const gameLogs = parseJsonValue(payload.game_logs, [], 'game logs');
  if (!Array.isArray(gameLogs)) {
    throw new Error('The game logs API returned an invalid game logs list.');
  }

  const averages = parseJsonValue(payload.averages, [], 'averages');
  const seasonAverages = parseJsonValue(payload.season_averages, [], 'season averages');

  return {
    gameLogs: [...gameLogs].reverse(),
    averages: [firstRecord(averages), firstRecord(seasonAverages)],
    seasonGameCount: seasonGameCount(payload.season_game_count),
    nextGame: payload.next_game || null,
  };
};

/** Fetch and decode game logs. The caller owns state; this module only returns data. */
export const fetchGameLogsData = async (params = {}, { signal } = {}) => {
  const response = await apiClient.get(getApiUrl('GAME_LOGS'), {
    params,
    signal,
    // Game-log queries can legitimately be slower than ordinary API calls.
    // Keep AbortController cancellation available without inheriting the
    // short default timeout used by the shared client.
    timeout: 0,
  });

  return decodeGameLogsResponse(response.data);
};

export const isRequestCancelled = (error) =>
  Boolean(
    error &&
    (error.code === 'ERR_CANCELED' ||
      error.name === 'CanceledError' ||
      error.name === 'AbortError' ||
      error.message === 'canceled' ||
      error.message === 'The operation was aborted.'),
  );

export const getRequestErrorMessage = (
  error,
  fallback = 'The request failed. Please try again.',
) => {
  const responseError = error?.response?.data?.error;
  if (!responseError && ['ECONNABORTED', 'ETIMEDOUT'].includes(error?.code)) {
    return 'The request took too long. Please try again.';
  }
  return (
    (typeof responseError === 'string' ? responseError : responseError?.message) ||
    error?.response?.data?.message ||
    error?.message ||
    fallback
  );
};
