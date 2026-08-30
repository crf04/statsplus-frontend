import { filterSetFromSearchParams } from './filterUtils';

export const SITE_NAME = 'CourtAI';
export const DEFAULT_TITLE = 'CourtAI | NBA Game Log Analytics';
export const DEFAULT_DESCRIPTION =
  'CourtAI helps explore NBA player game logs with advanced filters, natural language search, and performance analytics.';

const listNames = (names) =>
  names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;

const describeFilters = (filters) => {
  const parts = [];
  if (filters.season_filter) parts.push(`${filters.season_filter} season`);
  if (filters.game_filter) parts.push(`last ${filters.game_filter} games`);
  if (filters.location_filter && filters.location_filter !== 'Both') {
    parts.push(`${filters.location_filter.toLowerCase()} games`);
  }
  if (filters['teams_against[]']?.length) parts.push(`vs ${listNames(filters['teams_against[]'])}`);
  if (filters.minutes_filter) {
    const [low, high] = filters.minutes_filter.split(',');
    parts.push(`${low}-${high} minutes`);
  }
  if (filters.date_filter) parts.push(`since ${filters.date_filter}`);
  if (filters['players_on[]']?.length) parts.push(`with ${listNames(filters['players_on[]'])}`);
  if (filters['players_off[]']?.length)
    parts.push(`without ${listNames(filters['players_off[]'])}`);
  return parts;
};

/**
 * Describe a shared Workspace link for the browser tab and for link unfurlers.
 *
 * Returns null when the URL names no player, including when it is a link we
 * refuse: a refused link shows a refusal, so its preview must not promise the
 * logs it will not show.
 */
export const linkPreviewFor = (searchParams) => {
  const { filters } = filterSetFromSearchParams(searchParams);
  if (!filters.player_name) return null;
  const details = describeFilters(filters);
  const title = `${filters.player_name} Game Logs | ${SITE_NAME}`;
  const summary = details.length > 0 ? details.join(', ') : 'every logged game';
  const description = `${summary[0].toUpperCase()}${summary.slice(1)}. Explore on ${SITE_NAME}.`;
  return { title, description };
};

const escapeHtml = (value) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

const replaceContent = (html, attribute, name, value) =>
  html.replace(
    new RegExp(`(<meta\\s+${attribute}="${name}"\\s+content=")[^"]*(")`),
    `$1${escapeHtml(value)}$2`,
  );

/** Rewrite the static document head so a fetch of the link describes its logs. */
export const applyLinkPreview = (html, preview) => {
  let next = html.replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(preview.title)}</title>`);
  next = replaceContent(next, 'name', 'description', preview.description);
  next = replaceContent(next, 'property', 'og:title', preview.title);
  next = replaceContent(next, 'property', 'og:description', preview.description);
  next = replaceContent(next, 'name', 'twitter:title', preview.title);
  next = replaceContent(next, 'name', 'twitter:description', preview.description);
  return next;
};
