/*
 * PROTOTYPE — throwaway.
 *
 * A Saved Filter Set carries only { id, name, queryString }. Everything the
 * variants show beyond the name is decoded here, client-side, from the query
 * string the user actually saved. This is the design question in miniature:
 * how much of the link should the list say out loud?
 */
import { filterSetFromSearchParams } from '../filterUtils';

const listNames = (names) =>
  names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;

const SELF_FILTER_KEY = /^self_filters\[(.+)\]$/;

const describeSelfFilter = (stat, value) => {
  const [min, max] = String(value).split(',');
  if (max === '999') return `${stat} ≥ ${min}`;
  if (min === '0') return `${stat} ≤ ${max}`;
  return `${stat} ${min}–${max}`;
};

/** The facts a variant can put on a row, in the order a reader wants them. */
export const describeSavedFilterSet = (queryString) => {
  const params = new URLSearchParams(queryString || '');
  const { filters, invalid } = filterSetFromSearchParams(params);
  const chips = [];

  if (filters.season_filter) chips.push({ key: 'season', label: `${filters.season_filter}` });
  if (filters.game_filter) chips.push({ key: 'games', label: `last ${filters.game_filter}` });
  if (filters.location_filter && filters.location_filter !== 'Both') {
    chips.push({ key: 'location', label: filters.location_filter.toLowerCase() });
  }
  if (filters['teams_against[]']?.length) {
    chips.push({ key: 'opp', label: `vs ${listNames(filters['teams_against[]'])}` });
  }
  if (filters.minutes_filter) {
    const [low, high] = String(filters.minutes_filter).split(',');
    chips.push({ key: 'min', label: `${low}–${high} min` });
  }
  if (filters.date_filter) chips.push({ key: 'date', label: `since ${filters.date_filter}` });
  if (filters['players_on[]']?.length) {
    chips.push({ key: 'on', tone: 'on', label: `with ${listNames(filters['players_on[]'])}` });
  }
  if (filters['players_off[]']?.length) {
    chips.push({
      key: 'off',
      tone: 'off',
      label: `without ${listNames(filters['players_off[]'])}`,
    });
  }
  Object.entries(filters).forEach(([key, value]) => {
    const match = key.match(SELF_FILTER_KEY);
    if (match && value) chips.push({ key, label: describeSelfFilter(match[1], value) });
  });
  if (filters.playstyle_RTG_min !== undefined || filters.playstyle_RTG_max !== undefined) {
    const min = filters.playstyle_RTG_min ?? 0;
    const max = filters.playstyle_RTG_max ?? 200;
    chips.push({ key: 'rtg', label: `RTG ${min}–${max}` });
  }

  return {
    // A refused link decodes to no Filter Set at all, but the row still has to
    // be identifiable enough to delete, so the raw name is read straight out.
    player: filters.player_name || params.get('player_name') || null,
    chips,
    // A link the app would refuse still deserves to be findable and deletable.
    refused: invalid.length > 0,
    sentence: chips.length > 0 ? chips.map((chip) => chip.label).join(' · ') : 'every logged game',
  };
};
