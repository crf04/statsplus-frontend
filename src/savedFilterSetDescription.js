import { filterSetFromSearchParams } from './filterUtils';
import { opponentFilterLabel } from './opponentFilters';

/*
 * Describe a Saved Filter Set by the parameters it carries.
 *
 * A Saved Filter Set stores a name and a query string and nothing else, and the
 * name is typed in a hurry, so the parameters are the only reliable account of
 * what an item points at. They are read back through the decoder the Log
 * Workspace itself uses, so a row is described by exactly the rules that decide
 * whether the link will be honoured.
 */

const listNames = (names) =>
  names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;

const SELF_FILTER_KEY = /^self_filters\[(.+)\]$/;

/** A self filter arrives as a "low,high" pair, with 0 and 999 as open ends. */
const describeSelfFilter = (stat, value) => {
  const [low, high] = String(value).split(',');
  if (high === '999') return `${stat} ≥ ${low}`;
  if (low === '0') return `${stat} ≤ ${high}`;
  if (low === high) return `${stat} = ${low}`;
  return `${stat} ${low}–${high}`;
};

/*
 * The defensive filter is one condition carried by two parameters. Despite its
 * name, `teams_against[]` holds a defensive category rather than a team, and
 * `rank_filter[]` is a league position whose sign is the whole meaning:
 * positive counts from the best defenses, negative from the worst. A bare
 * "(5)" says none of that, so the description spells out top or bottom.
 */
export const describeDefensiveFilter = (category, rank) =>
  rank === undefined || rank === null
    ? `vs ${opponentFilterLabel(category)} D`
    : `vs ${rank > 0 ? 'top' : 'bottom'} ${Math.abs(rank)} ${opponentFilterLabel(category)} D`;

/**
 * Read a saved query string back as the facts a list row shows.
 *
 * Returns the player, the parameters in reading order, and whether this is a
 * link the app now refuses. The decoder withholds the whole Filter Set when any
 * one parameter is unhonourable, so a refused link has no parameters to show;
 * its player is read back off the raw query string instead, because a row still
 * has to be identifiable enough to rename or delete.
 */
export const describeSavedFilterSet = (queryString) => {
  const searchParams = new URLSearchParams(queryString || '');
  const { filters, invalid } = filterSetFromSearchParams(searchParams);
  const parameters = [];
  const add = (key, label, tone) => parameters.push(tone ? { key, label, tone } : { key, label });

  if (filters.season_filter) add('season_filter', filters.season_filter);
  if (filters.game_filter) add('game_filter', `last ${filters.game_filter}`);
  // "Both" is the absence of a location filter, so it earns no parameter.
  if (filters.location_filter && filters.location_filter !== 'Both') {
    add('location_filter', filters.location_filter.toLowerCase());
  }
  // One specific opponent, not a defensive rank bucket: the tricode is the
  // whole description, so it is spelled exactly as the link fixed it.
  if (filters.opponent_tricode) add('opponent_tricode', `vs ${filters.opponent_tricode}`);
  filters['teams_against[]']?.forEach((category, index) => {
    add(
      `teams_against[]-${index}`,
      describeDefensiveFilter(category, filters['rank_filter[]']?.[index]),
    );
  });
  if (filters.minutes_filter) {
    const [low, high] = String(filters.minutes_filter).split(',');
    add('minutes_filter', `${low}–${high} min`);
  }
  if (filters.date_filter) add('date_filter', `since ${filters.date_filter}`);
  if (filters['players_on[]']?.length) {
    add('players_on[]', `with ${listNames(filters['players_on[]'])}`, 'on');
  }
  if (filters['players_off[]']?.length) {
    add('players_off[]', `without ${listNames(filters['players_off[]'])}`, 'off');
  }
  Object.entries(filters).forEach(([key, value]) => {
    const match = key.match(SELF_FILTER_KEY);
    if (match && value) add(key, describeSelfFilter(match[1], value));
  });
  const ratingMin = filters.playstyle_RTG_min;
  const ratingMax = filters.playstyle_RTG_max;
  if (ratingMin !== undefined || ratingMax !== undefined) {
    if (ratingMin !== undefined && ratingMax !== undefined) {
      add('playstyle_RTG', `PLAYTYPE_RTG ${ratingMin}–${ratingMax}`);
    } else if (ratingMin !== undefined) {
      add('playstyle_RTG_min', `PLAYTYPE_RTG ≥ ${ratingMin}`);
    } else {
      add('playstyle_RTG_max', `PLAYTYPE_RTG ≤ ${ratingMax}`);
    }
  }

  return {
    player: filters.player_name || searchParams.get('player_name')?.trim() || null,
    parameters,
    refused: invalid.length > 0,
  };
};
