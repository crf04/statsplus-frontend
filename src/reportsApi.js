import { apiClient, getApiUrl } from './config';
import { isRecord, strictDecoders } from './decoding';

/*
 * CourtAI reports (crf04/statsplus#342): an AI assistant's research published
 * through the connector's publish_report as a public page. The backend serves
 * the stored document, each card call's result, and the card HTML it was
 * drawn with, so a report renders the same however the cards change later.
 */
const createInvalidReportError = () =>
  new Error('The report endpoint returned an invalid response.');

const { requireString } = strictDecoders(createInvalidReportError);
const fail = () => {
  throw createInvalidReportError();
};
const requireTimestamp = (value) => {
  if (Number.isNaN(Date.parse(requireString(value)))) fail();
  return value;
};

export const TAGS = ['strong', 'lean', 'thin', 'pass', 'tipped'];
const LAYOUTS = ['tiles', 'rows', 'list'];

const optionalString = (value) => {
  if (value === undefined || value === null) return null;
  return requireString(value);
};
const strings = (value) => {
  if (value === undefined) return [];
  if (!Array.isArray(value)) fail();
  return value.map(requireString);
};
const pairs = (value) => {
  if (value === undefined) return [];
  if (!Array.isArray(value)) fail();
  return value.map((pair) => {
    if (!Array.isArray(pair) || pair.length !== 2) fail();
    return [requireString(pair[0]), requireString(pair[1])];
  });
};
// A source opens in a new tab, so only web links are kept.
const sources = (value) => pairs(value).filter(([, url]) => /^https?:\/\//.test(url));

const decodeItem = (item) => {
  if (!isRecord(item)) fail();
  const tag = item.tag ?? null;
  if (tag !== null && !TAGS.includes(tag)) fail();
  return {
    title: requireString(item.title),
    tag,
    subtitle: optionalString(item.subtitle),
    key: optionalString(item.key),
    body: strings(item.body),
    bullets: pairs(item.bullets),
    watch: optionalString(item.watch),
    cards: strings(item.cards),
    sources: sources(item.sources),
  };
};

const decodeTab = (tab) => {
  if (!isRecord(tab) || !LAYOUTS.includes(tab.layout) || !Array.isArray(tab.items)) fail();
  return { title: requireString(tab.title), layout: tab.layout, items: tab.items.map(decodeItem) };
};

const decodeSkill = (skill) => {
  if (skill === undefined || skill === null) return null;
  if (!isRecord(skill)) fail();
  const url = optionalString(skill.url);
  return {
    name: requireString(skill.name),
    // Only a courtai.app page is linked as "the skill".
    url: url && url.startsWith('https://courtai.app/') ? url : null,
  };
};

const decodeDocument = (document) => {
  if (!isRecord(document) || !Array.isArray(document.tabs) || !document.tabs.length) fail();
  return {
    title: requireString(document.title),
    date: optionalString(document.date),
    opening: strings(document.opening),
    skill: decodeSkill(document.skill),
    footnote: optionalString(document.footnote),
    tabs: document.tabs.map(decodeTab),
  };
};

const decodeCall = (call) => {
  if (!isRecord(call) || !isRecord(call.structured)) fail();
  return {
    id: requireString(call.id),
    tool: requireString(call.tool),
    card: requireString(call.card),
    structured: call.structured,
    meta: isRecord(call.meta) ? call.meta : null,
  };
};

export const decodeReport = (payload) => {
  const report = isRecord(payload) ? payload.report : null;
  if (!isRecord(report) || !Array.isArray(report.calls) || !isRecord(report.cards)) fail();
  const cards = Object.fromEntries(
    Object.entries(report.cards).map(([name, html]) => [name, requireString(html)]),
  );
  const calls = Object.fromEntries(report.calls.map(decodeCall).map((call) => [call.id, call]));
  const document = decodeDocument(report.document);
  // A card the page cannot draw (no stored call or no HTML for it) is left out, not shown broken.
  const drawable = (id) => calls[id] && cards[calls[id].card];
  if (typeof report.listed !== 'boolean' || typeof report.featured !== 'boolean') fail();
  if (report.author !== undefined && report.author !== null && !isRecord(report.author)) fail();
  const author = report.author ?? {};
  const handle = optionalString(author.handle);
  // A listed report always names its author by handle (crf04/statsplus#372).
  if (report.listed && !handle) fail();
  return {
    id: requireString(report.id),
    createdAt: requireTimestamp(report.created_at),
    author: optionalString(author.label),
    authorHandle: handle,
    isAuthor: report.is_author === true,
    listed: report.listed,
    featured: report.featured,
    document: {
      ...document,
      tabs: document.tabs.map((tab) => ({
        ...tab,
        items: tab.items.map((item) => ({ ...item, cards: item.cards.filter(drawable) })),
      })),
    },
    calls,
    cards,
  };
};

// A refused request's error code: the contract's `{"error": "<code>"}`, or null.
export const errorCode = (error) => {
  const body = error?.response?.data;
  if (!isRecord(body)) return null;
  if (typeof body.error === 'string') return body.error;
  return isRecord(body.error) && typeof body.error.code === 'string' ? body.error.code : null;
};

const REMOVED_BY = ['author', 'takedown'];

/*
 * One report: `{ report }`, `{ removedBy: 'author' | 'takedown' }` for a
 * deleted or taken-down one (410), or null when no report has the id (404).
 */
export const fetchReport = async (id, { signal } = {}) => {
  try {
    const response = await apiClient.get(`${getApiUrl('REPORTS')}/${encodeURIComponent(id)}`, {
      signal,
    });
    return { report: decodeReport(response.data) };
  } catch (error) {
    const status = error?.response?.status;
    if (status === 404) return null;
    if (status === 410) {
      const body = error.response.data;
      if (!isRecord(body) || body.error !== 'removed' || !REMOVED_BY.includes(body.by)) fail();
      return { removedBy: body.by };
    }
    throw error;
  }
};

export const deleteReport = (id) =>
  apiClient.delete(`${getApiUrl('USER_REPORTS')}/${encodeURIComponent(id)}`);

/* The author lists or unlists a report; refusals carry handle_required or listed_limit. */
export const setReportListed = (id, listed) =>
  apiClient.patch(`${getApiUrl('USER_REPORTS')}/${encodeURIComponent(id)}`, { listed });

/* Sets the account's public handle once; refusals carry invalid_handle, handle_taken or handle_already_set. */
export const setPublicHandle = (handle) => apiClient.put(getApiUrl('PUBLIC_HANDLE'), { handle });

/*
 * Research (crf04/statsplus#372): the reports their authors listed, newest
 * first. A page is `{ featured, reports, nextCursor }`; Featured entries come
 * only on the first page of the feed and never on an author's page.
 */
const createInvalidResearchError = () =>
  new Error('The research endpoint returned an invalid response.');
const research = strictDecoders(createInvalidResearchError);
const failResearch = () => {
  throw createInvalidResearchError();
};
const researchTimestamp = (value) => {
  if (Number.isNaN(Date.parse(research.requireString(value)))) failResearch();
  return value;
};
const researchStrings = (value) => {
  if (!Array.isArray(value)) failResearch();
  return value.map(research.requireString);
};

const decodeEntry = (entry) => {
  if (!isRecord(entry) || !isRecord(entry.author) || !isRecord(entry.covers)) failResearch();
  if (entry.date !== null && entry.date !== undefined) research.requireString(entry.date);
  return {
    id: research.requireString(entry.id),
    title: research.requireString(entry.title),
    listedAt: researchTimestamp(entry.listed_at),
    createdAt: researchTimestamp(entry.created_at),
    date: entry.date ?? null,
    handle: research.requireString(entry.author.handle),
    games: researchStrings(entry.covers.games),
    players: researchStrings(entry.covers.players),
    previewUrl: research.requireString(entry.preview_url),
  };
};

export const decodeResearchPage = (payload) => {
  if (!isRecord(payload) || !Array.isArray(payload.featured) || !Array.isArray(payload.reports)) {
    failResearch();
  }
  const next = payload.next_cursor;
  if (next !== null && (typeof next !== 'string' || !next)) failResearch();
  return {
    featured: payload.featured.map(decodeEntry),
    reports: payload.reports.map(decodeEntry),
    nextCursor: next,
  };
};

/* One page of the feed; `cursor` is the previous page's nextCursor. */
export const fetchResearch = async ({ cursor = null, signal } = {}) => {
  const response = await apiClient.get(getApiUrl('RESEARCH'), {
    params: cursor ? { cursor } : undefined,
    signal,
  });
  return decodeResearchPage(response.data);
};

/* One page of an author's listed reports, or null for a handle nobody has (404). */
export const fetchAuthorResearch = async (handle, { cursor = null, signal } = {}) => {
  try {
    const response = await apiClient.get(
      `${getApiUrl('RESEARCH_AUTHORS')}/${encodeURIComponent(handle)}`,
      { params: cursor ? { cursor } : undefined, signal },
    );
    return decodeResearchPage(response.data);
  } catch (error) {
    if (error?.response?.status === 404) return null;
    throw error;
  }
};
