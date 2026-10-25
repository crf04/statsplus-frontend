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
  return {
    id: requireString(report.id),
    createdAt: requireString(report.created_at),
    author: isRecord(report.author) ? optionalString(report.author.label) : null,
    isAuthor: report.is_author === true,
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

/* One report, or null when it does not exist, was deleted or was taken down (404). */
export const fetchReport = async (id, { signal } = {}) => {
  try {
    const response = await apiClient.get(`${getApiUrl('REPORTS')}/${encodeURIComponent(id)}`, {
      signal,
    });
    return decodeReport(response.data);
  } catch (error) {
    if (error?.response?.status === 404) return null;
    throw error;
  }
};

export const deleteReport = (id) =>
  apiClient.delete(`${getApiUrl('USER_REPORTS')}/${encodeURIComponent(id)}`);
