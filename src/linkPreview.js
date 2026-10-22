import {
  filterSetFromSearchParams,
  filterSetToSearchParams,
  lineFromSearch,
  lineTypeFromSearch,
  withLine,
  withLineType,
} from './filterUtils';
import { describeDefensiveFilter } from './savedFilterSetDescription';

export const SITE_NAME = 'CourtAI';
export const DEFAULT_TITLE = 'CourtAI | NBA Game Log Analytics';

const listNames = (names) =>
  names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;

const describeFilters = (filters) => {
  const parts = [];
  if (filters.season_filter) parts.push(`${filters.season_filter} season`);
  if (filters.game_filter) parts.push(`last ${filters.game_filter} games`);
  if (filters.location_filter && filters.location_filter !== 'Both') {
    parts.push(`${filters.location_filter.toLowerCase()} games`);
  }
  if (filters.opponent_tricode) parts.push(`vs ${filters.opponent_tricode}`);
  // The defensive filter is one condition across two parameters, and the rank's
  // sign is the whole meaning. Naming the category alone described a link as
  // asking about isolation defense in general when it asked for the best five.
  filters['teams_against[]']?.forEach((category, index) => {
    parts.push(describeDefensiveFilter(category, filters['rank_filter[]']?.[index]));
  });
  if (filters.minutes_filter) {
    const [low, high] = filters.minutes_filter.split(',');
    parts.push(`${low}-${high} minutes`);
  }
  if (filters.date_filter) parts.push(`since ${filters.date_filter}`);
  if (filters.date_to) parts.push(`through ${filters.date_to}`);
  if (filters['players_on[]']?.length) parts.push(`with ${listNames(filters['players_on[]'])}`);
  if (filters['players_off[]']?.length)
    parts.push(`without ${listNames(filters['players_off[]'])}`);
  return parts;
};

// The backend draws the link's results as a picture (crf04/statsplus#285).
// `line` is the sender's own line, drawn instead of the posted one. `line_date`
// is the day whose posted line the picture uses, and a new day is a new URL, so
// a chat app that keeps the first image it fetched shows that day's.
const previewImagePath = (filters, lineType, line, lineDate) => {
  const params = withLine(withLineType(filterSetToSearchParams(filters), lineType), line);
  params.set('line_date', lineDate);
  return `/api/games/game_logs/preview.png?${params}`;
};

/**
 * Describe a shared Workspace link for the browser tab and for link unfurlers.
 *
 * Returns null when the URL names no player, including when it is a link we
 * refuse: a refused link shows a refusal, so its preview must not promise the
 * logs it will not show. Given the ET `lineDate`, it also names the path of the
 * link's results image, unless the link charts no stat.
 */
export const linkPreviewFor = (searchParams, { lineDate } = {}) => {
  const { filters } = filterSetFromSearchParams(searchParams);
  if (!filters.player_name) return null;
  const details = describeFilters(filters);
  const title = `${filters.player_name} Game Logs | ${SITE_NAME}`;
  const summary = details.length > 0 ? details.join(', ') : 'every logged game';
  const description = `${summary[0].toUpperCase()}${summary.slice(1)}. Explore on ${SITE_NAME}.`;
  const lineType = lineTypeFromSearch(searchParams);
  if (!lineDate || lineType === 'None') return { title, description };
  return {
    title,
    description,
    image: previewImagePath(filters, lineType, lineFromSearch(searchParams), lineDate),
  };
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

const metaTags = (attribute, entries) =>
  entries
    .map(([name, value]) => `<meta ${attribute}="${name}" content="${escapeHtml(value)}" />`)
    .join('\n    ');

const replaceTag = (html, attribute, name, replacement) =>
  html.replace(
    new RegExp(`<meta\\s+${attribute}="${name}"\\s+content="[^"]*"\\s*/>`),
    () => replacement,
  );

/**
 * Rewrite the static document head so a fetch of the link describes its logs.
 * `preview.image`, an absolute URL, replaces the logo and the small card.
 */
export const applyLinkPreview = (html, preview) => {
  let next = html.replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(preview.title)}</title>`);
  next = replaceContent(next, 'name', 'description', preview.description);
  next = replaceContent(next, 'property', 'og:title', preview.title);
  next = replaceContent(next, 'property', 'og:description', preview.description);
  next = replaceContent(next, 'name', 'twitter:title', preview.title);
  next = replaceContent(next, 'name', 'twitter:description', preview.description);
  if (!preview.image) return next;
  next = replaceTag(
    next,
    'property',
    'og:image',
    metaTags('property', [
      ['og:image', preview.image],
      ['og:image:width', '1200'],
      ['og:image:height', '630'],
      ['og:image:alt', preview.title],
    ]),
  );
  return replaceTag(
    next,
    'name',
    'twitter:card',
    metaTags('name', [
      ['twitter:card', 'summary_large_image'],
      ['twitter:image', preview.image],
    ]),
  );
};
