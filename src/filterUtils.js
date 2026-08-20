import { defensiveOptions } from './utils';
import { parseCalendarDate } from './calendarDate';
/**
 * Shared filter translation and cleaning.
 *
 * This module is the seam between filter-producing UI code and the game-log
 * request module.  Callers can hand it incomplete form/NL output and receive
 * a stable, request-ready object without needing to know which values are
 * omitted by the backend adapter.
 */

const hasValue = (value) => value !== null && value !== undefined && value !== '';

export const isEmptyFilterValue = (value) => {
  if (!hasValue(value)) return true;
  if (typeof value === 'string' && value.trim() === '') return true;
  return Array.isArray(value) && value.length === 0;
};

/** Remove nullish, blank, and empty-array values while preserving 0 and false. */
export const cleanFilterParams = (filters = {}) => {
  if (!filters || typeof filters !== 'object') return {};

  return Object.entries(filters).reduce((cleaned, [key, value]) => {
    if (isEmptyFilterValue(value)) return cleaned;

    if (Array.isArray(value)) {
      const nonEmptyValues = value.filter((item) => !isEmptyFilterValue(item));
      if (nonEmptyValues.length === 0) return cleaned;
      cleaned[key] = nonEmptyValues;
      return cleaned;
    }

    cleaned[key] = value;
    return cleaned;
  }, {});
};

/**
 * Convert the frontend-only selectedPlayer key to the backend's player_name
 * key.  The natural-language result keeps selectedPlayer until this seam so
 * the UI can still display the resolved player name.
 */
export const toGameLogParams = (filters = {}) => {
  const cleaned = cleanFilterParams(filters);
  const selectedPlayer = cleaned.selectedPlayer;

  delete cleaned.selectedPlayer;
  if (hasValue(selectedPlayer) && selectedPlayer !== 'None' && !hasValue(cleaned.player_name)) {
    cleaned.player_name = selectedPlayer;
  }

  return cleaned;
};

const toNumericValue = (value) => {
  const numericValue = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
};

const addMinutesFilter = (filters, minutesFilter) => {
  if (Array.isArray(minutesFilter) && minutesFilter.length === 2) {
    filters.minutes_filter = minutesFilter.join(',');
  } else if (typeof minutesFilter === 'string') {
    filters.minutes_filter = minutesFilter;
  } else if (
    minutesFilter &&
    typeof minutesFilter === 'object' &&
    hasValue(minutesFilter.min) &&
    hasValue(minutesFilter.max)
  ) {
    filters.minutes_filter = `${minutesFilter.min},${minutesFilter.max}`;
  }
};

const addSelfFilters = (filters, selfFilters) => {
  if (Array.isArray(selfFilters)) {
    selfFilters.forEach((filter) => {
      if (!filter || !filter.stat_column || !filter.operator || !hasValue(filter.value)) {
        return;
      }

      const firstValue = toNumericValue(filter.value);
      const secondValue = toNumericValue(filter.value2);
      let minValue;
      let maxValue;

      if (filter.operator === 'between' && secondValue !== null && firstValue !== null) {
        minValue = firstValue;
        maxValue = secondValue;
      } else if (filter.operator === 'gte' && firstValue !== null) {
        minValue = firstValue;
        maxValue = 999;
      } else if (filter.operator === 'gt' && firstValue !== null) {
        minValue = firstValue + 1;
        maxValue = 999;
      } else if (filter.operator === 'lte' && firstValue !== null) {
        minValue = 0;
        maxValue = firstValue;
      } else if (filter.operator === 'lt' && firstValue !== null) {
        minValue = 0;
        maxValue = firstValue - 1;
      } else if (filter.operator === 'eq' && firstValue !== null) {
        minValue = firstValue;
        maxValue = firstValue;
      }

      if (minValue !== undefined && maxValue !== undefined) {
        filters[`self_filters[${filter.stat_column}]`] = `${minValue},${maxValue}`;
      }
    });
    return;
  }

  if (selfFilters && typeof selfFilters === 'object') {
    Object.entries(selfFilters).forEach(([statName, value]) => {
      if (isEmptyFilterValue(value)) return;

      if (Array.isArray(value)) {
        filters[`self_filters[${statName}]`] = value.join(',');
      } else if (value && typeof value === 'object' && hasValue(value.min) && hasValue(value.max)) {
        filters[`self_filters[${statName}]`] = `${value.min},${value.max}`;
      } else {
        filters[`self_filters[${statName}]`] = String(value);
      }
    });
  }
};

/** Convert the backend's natural-language result into the UI filter shape. */
export const convertNLToFilters = (nlResult = {}) => {
  if (!nlResult || typeof nlResult !== 'object') return {};

  const filters = {};

  if (hasValue(nlResult.player_name)) {
    filters.selectedPlayer = nlResult.player_name;
  }

  if (hasValue(nlResult.game_count)) {
    filters.game_filter = nlResult.game_count;
  }

  if (hasValue(nlResult.location)) {
    filters.location_filter =
      nlResult.location === 'home' ? 'Home' : nlResult.location === 'away' ? 'Away' : 'Both';
  }

  if (Array.isArray(nlResult.players_on) && nlResult.players_on.length > 0) {
    filters['players_on[]'] = nlResult.players_on;
  }

  if (Array.isArray(nlResult.players_off) && nlResult.players_off.length > 0) {
    filters['players_off[]'] = nlResult.players_off;
  }

  if (hasValue(nlResult.season)) {
    filters.season_filter = nlResult.season;
  }

  if (Array.isArray(nlResult.teams_against) && nlResult.teams_against.length > 0) {
    filters['teams_against[]'] = nlResult.teams_against;
  }

  if (Array.isArray(nlResult.rank_filter) && nlResult.rank_filter.length > 0) {
    filters['rank_filter[]'] = nlResult.rank_filter;
  }

  if (hasValue(nlResult.minutes_filter)) {
    addMinutesFilter(filters, nlResult.minutes_filter);
  }

  if (hasValue(nlResult.self_filters)) {
    addSelfFilters(filters, nlResult.self_filters);
  }

  return cleanFilterParams(filters);
};

/** Keep default playstyle bounds out of the applied-filter badges for NL. */
export const filtersForDisplay = (filters = {}, { naturalLanguage = false } = {}) => {
  const cleaned = cleanFilterParams(filters);
  if (!naturalLanguage) return cleaned;

  const hasExplicitPlaystyleRange =
    hasValue(filters.playstyle_RTG_min) && hasValue(filters.playstyle_RTG_max);

  if (!hasExplicitPlaystyleRange) {
    delete cleaned.playstyle_RTG_min;
    delete cleaned.playstyle_RTG_max;
  }

  return cleaned;
};

/**
 * URL decoding.
 *
 * A shared link carries the game-log API's own parameter names, so a link is
 * self-describing against the API documentation and needs no alias vocabulary.
 * An unrecognised name is ignored, because a stray tracking parameter must not
 * break someone's link. A recognised name carrying a value we cannot honour
 * names itself and blocks the whole Filter Set: showing results that quietly
 * disagree with the URL is worse than refusing.
 */

const LOCATION_VALUES = new Set(['Both', 'Home', 'Away']);
const RANKABLE_FILTERS = new Set(defensiveOptions.filter((option) => option !== 'None'));
const SELF_FILTER_KEY = /^self_filters\[(.+)\]$/;
const MINUTES_BOUNDS = { min: 0, max: 48 };

const finiteNumber = (value) => {
  if (typeof value !== 'string' || value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const wholeNumber = (value) => {
  const parsed = finiteNumber(value);
  return parsed !== null && Number.isInteger(parsed) ? parsed : null;
};

/**
 * Decode a "low,high" pair, optionally constrained to an inclusive envelope.
 *
 * Returns the pair re-spelled as plain decimals. Exponent and hex forms satisfy
 * `Number()` but are not the decimals the API reads, so a link we accepted would
 * otherwise produce a request it rejects with an error naming nothing.
 */
const boundedRange = (value, bounds) => {
  if (typeof value !== 'string') return null;
  const parts = value.split(',');
  if (parts.length !== 2) return null;
  const [low, high] = parts.map(finiteNumber);
  if (low === null || high === null || low > high) return null;
  if (bounds && (low < bounds.min || high > bounds.max)) return null;
  return `${low},${high}`;
};

const SEASON_FORMAT = /^\d{4}-\d{2}$/;

export const filterSetFromSearchParams = (searchParams) => {
  const filters = {};
  const invalid = [];
  const reject = (name) => {
    if (!invalid.includes(name)) invalid.push(name);
  };

  // `get` returns only the first value, so a repeated scalar would hide any
  // later one from validation entirely. Refuse rather than pick.
  const readOnce = (name) => {
    const values = searchParams.getAll(name);
    if (values.length === 0) return null;
    if (values.length > 1) {
      reject(name);
      return null;
    }
    return values[0];
  };

  const readText = (name, isValid) => {
    const raw = readOnce(name);
    if (raw === null) return;
    const value = raw.trim();
    if (value === '' || (isValid && !isValid(value))) return reject(name);
    filters[name] = value;
  };

  const readDecoded = (name, decode) => {
    const raw = readOnce(name);
    if (raw === null) return;
    const value = decode(raw);
    if (value === null) return reject(name);
    filters[name] = value;
  };

  const readNames = (name) => {
    const values = searchParams.getAll(name);
    if (values.length === 0) return;
    const trimmed = values.map((value) => value.trim());
    if (trimmed.some((value) => value === '')) return reject(name);
    filters[name] = trimmed;
  };

  readText('player_name');
  readText('season_filter', (value) => SEASON_FORMAT.test(value));
  readDecoded('minutes_filter', (value) => boundedRange(value, MINUTES_BOUNDS));
  readDecoded('date_filter', parseCalendarDate);
  readDecoded('location_filter', (value) => (LOCATION_VALUES.has(value) ? value : null));
  readDecoded('game_filter', (value) => {
    const parsed = wholeNumber(value);
    return parsed !== null && parsed >= 1 ? parsed : null;
  });
  readDecoded('playstyle_RTG_min', finiteNumber);
  readDecoded('playstyle_RTG_max', finiteNumber);
  if (
    hasValue(filters.playstyle_RTG_min) &&
    hasValue(filters.playstyle_RTG_max) &&
    filters.playstyle_RTG_min > filters.playstyle_RTG_max
  ) {
    reject('playstyle_RTG_max');
  }

  readNames('players_on[]');
  readNames('players_off[]');

  // Opponent filters and their ranks are one filter expressed across two
  // parameters: the API pairs them by position and rejects any length mismatch.
  const teams = searchParams.getAll('teams_against[]');
  const ranks = searchParams.getAll('rank_filter[]');
  if (teams.length > 0 || ranks.length > 0) {
    if (teams.some((team) => !RANKABLE_FILTERS.has(team))) reject('teams_against[]');
    // Zero asks for the top nothing, which matches no team and empties the table.
    const parsedRanks = ranks.map(wholeNumber);
    if (parsedRanks.some((rank) => rank === null || rank === 0)) reject('rank_filter[]');
    if (teams.length !== ranks.length) reject('rank_filter[]');
    if (invalid.length === 0) {
      filters['teams_against[]'] = teams;
      filters['rank_filter[]'] = parsedRanks;
    }
  }

  for (const key of new Set(searchParams.keys())) {
    if (!SELF_FILTER_KEY.test(key)) continue;
    const raw = readOnce(key);
    if (raw === null) continue;
    const range = boundedRange(raw);
    if (range === null) reject(key);
    else filters[key] = range;
  }

  // A known filter is never partially applied: what is on screen must always
  // match what the URL says, so one bad value withholds the whole Filter Set.
  return invalid.length > 0 ? { filters: {}, invalid } : { filters, invalid };
};
