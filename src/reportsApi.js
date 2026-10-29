import { REPORT_PUBLISH_TIMEOUT } from './apiSettings';
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

/*
 * A block document (crf04/statsplus#380): an ordered list of blocks, each with
 * an id unique across the document. A tabs block holds blocks but never
 * another tabs block. The served document may have blocks its author hid
 * already left out, so a tab or the document can come empty.
 */
const BLOCK_ID = /^[a-z0-9-]{1,40}$/;
const TONES = ['warn', 'plain'];

const required = (value) => {
  if (!Array.isArray(value)) fail();
  return value;
};

// A table cell may be blank; any other text field may not.
const cell = (value) => {
  if (typeof value !== 'string') fail();
  return value;
};

const decodeTable = (block) => {
  const columns = required(block.columns).map(cell);
  const rows = required(block.rows).map((row) => {
    if (!Array.isArray(row) || row.length !== columns.length) fail();
    return row.map(cell);
  });
  return { columns, rows };
};

const decodeBlock = (block, nested = false) => {
  if (!isRecord(block) || typeof block.id !== 'string' || !BLOCK_ID.test(block.id)) fail();
  const { id, type } = block;
  switch (type) {
    case 'heading':
      return { id, type, text: requireString(block.text) };
    case 'paragraph':
      return { id, type, text: requireString(block.text), lede: block.lede === true };
    case 'list':
      return {
        id,
        type,
        items: required(block.items).map(requireString),
        ordered: block.ordered === true,
      };
    case 'callout': {
      const tone = block.tone ?? null;
      if (tone !== null && !TONES.includes(tone)) fail();
      return {
        id,
        type,
        title: optionalString(block.title),
        text: requireString(block.text),
        tone,
      };
    }
    case 'card':
      return { id, type, card: requireString(block.card) };
    case 'cards':
      return { id, type, cards: required(block.cards).map(requireString) };
    case 'spot': {
      const tag = block.tag ?? null;
      if (tag !== null && !TAGS.includes(tag)) fail();
      return {
        id,
        type,
        tag,
        title: requireString(block.title),
        subtitle: optionalString(block.subtitle),
        key: optionalString(block.key),
        cards: strings(block.cards),
      };
    }
    case 'table':
      return { id, type, ...decodeTable(block) };
    case 'items':
      if (!LAYOUTS.includes(block.layout)) fail();
      return { id, type, layout: block.layout, items: required(block.items).map(decodeItem) };
    case 'sources':
      return { id, type, sources: sources(required(block.sources)) };
    case 'tabs':
      if (nested) fail();
      return {
        id,
        type,
        tabs: required(block.tabs).map((tab) => {
          if (!isRecord(tab)) fail();
          return {
            title: requireString(tab.title),
            blocks: required(tab.blocks).map((inner) => decodeBlock(inner, true)),
          };
        }),
      };
    default:
      return fail();
  }
};

/* Every block in document order, the blocks inside a tabs block right after it. */
export const allBlocks = (blocks) =>
  blocks.flatMap((block) =>
    block.type === 'tabs' ? [block, ...block.tabs.flatMap((tab) => tab.blocks)] : [block],
  );

const decodeBlocks = (value) => {
  const blocks = required(value).map((block) => decodeBlock(block));
  const ids = allBlocks(blocks).map((block) => block.id);
  if (new Set(ids).size !== ids.length) fail();
  return blocks;
};

/* A document has exactly one of `tabs` (items in tabs) or `blocks`. */
const decodeDocument = (document) => {
  if (!isRecord(document)) fail();
  const hasTabs = document.tabs !== undefined;
  const hasBlocks = document.blocks !== undefined;
  if (hasTabs === hasBlocks) fail();
  if (hasTabs && (!Array.isArray(document.tabs) || !document.tabs.length)) fail();
  return {
    title: requireString(document.title),
    date: optionalString(document.date),
    opening: strings(document.opening),
    skill: decodeSkill(document.skill),
    footnote: optionalString(document.footnote),
    ...(hasTabs
      ? { tabs: document.tabs.map(decodeTab) }
      : { blocks: decodeBlocks(document.blocks) }),
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

const decodeCalls = (calls) => {
  if (!Array.isArray(calls)) fail();
  return Object.fromEntries(calls.map(decodeCall).map((call) => [call.id, call]));
};

// A card the page cannot draw (no stored call or no HTML for it) is left out, not shown broken.
const drawableDocument = (document, calls, cards) => {
  const drawable = (ids) => ids.filter((id) => calls[id] && cards[calls[id].card]);
  const drawableItem = (item) => ({ ...item, cards: drawable(item.cards) });
  const drawableBlock = (block) => {
    switch (block.type) {
      case 'card':
        return { ...block, card: drawable([block.card])[0] ?? null };
      case 'cards':
      case 'spot':
        return { ...block, cards: drawable(block.cards) };
      case 'items':
        return { ...block, items: block.items.map(drawableItem) };
      case 'tabs':
        return {
          ...block,
          tabs: block.tabs.map((tab) => ({ ...tab, blocks: tab.blocks.map(drawableBlock) })),
        };
      default:
        return block;
    }
  };
  if (document.blocks) return { ...document, blocks: document.blocks.map(drawableBlock) };
  return {
    ...document,
    tabs: document.tabs.map((tab) => ({ ...tab, items: tab.items.map(drawableItem) })),
  };
};

/*
 * The author's own words (crf04/statsplus#377): plain text, kept as sent.
 * Absent until the backend serves it, which reads the same as no notes.
 */
const decodeNotes = (value) => {
  if (value === undefined || value === null) return null;
  // Empty text is valid notes (and reads as none), unlike other strings here.
  if (typeof value !== 'string') fail();
  return value;
};

const decodeEditedAt = (value) =>
  value === undefined || value === null ? null : requireTimestamp(value);

const position = (value) => {
  if (!Number.isInteger(value) || value < 0) fail();
  return value;
};

/*
 * The stored edits body, as PUT /api/user/reports/<id>/edits took it: item
 * overrides addressed by tab and position for a tab document, block overrides
 * addressed by id for a block document.
 */
const decodeEdits = (edits) => {
  if (edits === undefined || edits === null) return null;
  if (!isRecord(edits)) fail();
  const base = { title: requireString(edits.title), notes: decodeNotes(edits.notes) };
  if (Array.isArray(edits.blocks)) {
    return {
      ...base,
      blocks: edits.blocks.map((block) => {
        if (!isRecord(block) || typeof block.hidden !== 'boolean') fail();
        return {
          id: requireString(block.id),
          hidden: block.hidden,
          cards: block.cards === undefined ? null : required(block.cards).map(requireString),
        };
      }),
    };
  }
  if (!Array.isArray(edits.items)) fail();
  return {
    ...base,
    items: edits.items.map((item) => {
      if (!isRecord(item) || typeof item.hidden !== 'boolean' || !Array.isArray(item.cards)) fail();
      return {
        tab: position(item.tab),
        item: position(item.item),
        hidden: item.hidden,
        cards: item.cards.map(requireString),
      };
    }),
  };
};

/* The report exactly as published, which only its author receives, to restore from. */
const decodeOriginal = (original, cards) => {
  if (original === undefined || original === null) return null;
  if (!isRecord(original)) fail();
  const calls = decodeCalls(original.calls);
  return { document: drawableDocument(decodeDocument(original.document), calls, cards), calls };
};

/*
 * Who wrote it (crf04/statsplus#382): an AI assistant through publish_report,
 * or its author in the Report Builder. Reports from before the field read as
 * the assistant's.
 */
const ORIGINS = ['assistant', 'builder'];
const decodeOrigin = (value) => {
  if (value === undefined || value === null) return 'assistant';
  if (!ORIGINS.includes(value)) fail();
  return value;
};

export const decodeReport = (payload) => {
  const report = isRecord(payload) ? payload.report : null;
  if (!isRecord(report) || !Array.isArray(report.calls) || !isRecord(report.cards)) fail();
  const cards = Object.fromEntries(
    Object.entries(report.cards).map(([name, html]) => [name, requireString(html)]),
  );
  const calls = decodeCalls(report.calls);
  const document = decodeDocument(report.document);
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
    origin: decodeOrigin(report.origin),
    notes: decodeNotes(report.notes),
    editedAt: decodeEditedAt(report.edited_at),
    document: drawableDocument(document, calls, cards),
    calls,
    cards,
    original: decodeOriginal(report.original, cards),
    edits: decodeEdits(report.edits),
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

/*
 * The author's edits: the title, notes, and the items (tab document) or
 * blocks (block document) they override, each with its hidden flag and its
 * cards in display order. The body replaces every
 * earlier edit. Resolves to the report as the author now reads it; refusals
 * carry notes_links, notes_too_long or invalid_edits.
 */
export const saveReportEdits = async (id, edits) => {
  const response = await apiClient.put(
    `${getApiUrl('USER_REPORTS')}/${encodeURIComponent(id)}/edits`,
    edits,
  );
  return decodeReport(response.data);
};

/*
 * Publishes a Report written in the Report Builder (crf04/statsplus#382) and
 * resolves to its id. Refusals carry handle_required or listed_limit when it
 * asks to be listed, and nothing is stored then.
 */
export const publishReport = async (body) => {
  const response = await apiClient.post(getApiUrl('USER_REPORTS'), body, {
    timeout: REPORT_PUBLISH_TIMEOUT,
  });
  const report = isRecord(response.data) ? response.data.report : null;
  if (!isRecord(report)) fail();
  return { id: requireString(report.id) };
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
