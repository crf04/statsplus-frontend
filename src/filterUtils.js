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
