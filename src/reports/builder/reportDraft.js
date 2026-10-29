/*
 * The Report Builder's draft (crf04/statsplus#382): a block document
 * (crf04/statsplus#380) of text blocks, kept within the backend's limits as
 * it is typed, so the draft is the document that gets published. One draft
 * lives in this browser's local storage until it is published or discarded.
 */

export const LIMITS = {
  title: 120,
  blocks: 120,
  heading: 120,
  paragraph: 1500,
  listItem: 300,
  listItems: 12,
  calloutTitle: 40,
  callout: 1000,
  fact: 200,
  url: 500,
  sources: 12,
};

// Characters as the server counts them (code points, not UTF-16 units).
export const length = (text) => [...text].length;

// The server refuses control characters other than tab and newline.
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u0008\u000b-\u001f\u007f-\u009f]/g;

const fit = (text, limit) => {
  const clean = String(text ?? '').replace(CONTROL, '');
  return length(clean) > limit ? [...clean].slice(0, limit).join('') : clean;
};

const BLANK = {
  heading: { text: '' },
  paragraph: { text: '', lede: false },
  list: { items: [''], ordered: false },
  callout: { text: '', tone: 'plain' },
  sources: { sources: [['', '']] },
};

export const BLOCK_TYPES = Object.keys(BLANK);

/* One block exactly as the backend takes it; an empty callout title is left out. */
const normalize = ({ id, type, ...fields }) => {
  switch (type) {
    case 'heading':
      return { id, type, text: fit(fields.text, LIMITS.heading) };
    case 'paragraph':
      return { id, type, text: fit(fields.text, LIMITS.paragraph), lede: fields.lede === true };
    case 'list':
      return {
        id,
        type,
        items: fields.items.slice(0, LIMITS.listItems).map((item) => fit(item, LIMITS.listItem)),
        ordered: fields.ordered === true,
      };
    case 'callout': {
      const title = fit(fields.title, LIMITS.calloutTitle);
      return {
        id,
        type,
        ...(title.trim() && { title }),
        text: fit(fields.text, LIMITS.callout),
        tone: fields.tone === 'warn' ? 'warn' : 'plain',
      };
    }
    case 'sources':
      return {
        id,
        type,
        sources: fields.sources
          .slice(0, LIMITS.sources)
          .map(([fact, url]) => [fit(fact, LIMITS.fact), fit(url, LIMITS.url)]),
      };
    default:
      throw new Error(`Unknown block type ${type}`);
  }
};

export const emptyDraft = () => ({ title: '', date: null, blocks: [] });

// Ids match [a-z0-9-]{1,40} and never repeat within the draft.
const nextId = (blocks) =>
  `b${Math.max(0, ...blocks.map((block) => Number(block.id.slice(1)) || 0)) + 1}`;

const replace = (blocks, id, change) =>
  blocks.map((block) => (block.id === id ? change(block) : block));

export const draftReducer = (draft, action) => {
  switch (action.type) {
    case 'add':
      return {
        ...draft,
        blocks: [
          ...draft.blocks,
          normalize({ id: nextId(draft.blocks), type: action.block, ...BLANK[action.block] }),
        ],
      };
    case 'update':
      return {
        ...draft,
        blocks: replace(draft.blocks, action.id, (block) =>
          normalize({ ...block, ...action.patch }),
        ),
      };
    case 'move': {
      const from = draft.blocks.findIndex((block) => block.id === action.id);
      const to = from + action.step;
      if (from < 0 || to < 0 || to >= draft.blocks.length) return draft;
      const blocks = [...draft.blocks];
      [blocks[from], blocks[to]] = [blocks[to], blocks[from]];
      return { ...draft, blocks };
    }
    case 'remove':
      return { ...draft, blocks: draft.blocks.filter((block) => block.id !== action.id) };
    case 'meta':
      return {
        ...draft,
        ...('title' in action && { title: fit(action.title, LIMITS.title) }),
        ...('date' in action && { date: action.date || null }),
      };
    case 'discard':
      return emptyDraft();
    default:
      throw new Error(`Unknown draft action ${action.type}`);
  }
};

const HTTP_URL = /^https?:\/\/[^\s/?#]+\S*$/i;
const blank = (text) => !text.trim();

/* Why a block can't be published yet, or null when it can. */
export const blockProblem = (block) => {
  switch (block.type) {
    case 'list':
      return block.items.some(blank) ? 'Fill in every item, or remove the empty ones.' : null;
    case 'sources':
      return block.sources.some(([fact, url]) => blank(fact) || !HTTP_URL.test(url))
        ? 'Each source needs a fact and a link starting http:// or https://.'
        : null;
    default:
      return blank(block.text) ? 'Write something here, or delete this block.' : null;
  }
};

export const isEmpty = (draft) => !draft.title && !draft.date && !draft.blocks.length;

/* The POST body for a text-only Report: no calls, no cards, written in the builder. */
export const publishBody = (draft, { date, showAuthor, listed }) => ({
  report: { title: draft.title.trim(), date, blocks: draft.blocks },
  calls: [],
  cards: {},
  show_author: showAuthor,
  listed,
  origin: 'builder',
});

/* Today in the author's own time zone, as YYYY-MM-DD. */
export const today = () => {
  const now = new Date(Date.now());
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};

export const DRAFT_STORAGE_KEY = 'courtai:report-draft';

const isText = (value) => typeof value === 'string';
const BLOCK_SHAPES = {
  heading: (block) => isText(block.text),
  paragraph: (block) => isText(block.text),
  list: (block) => Array.isArray(block.items) && block.items.every(isText),
  callout: (block) => isText(block.text) && (block.title === undefined || isText(block.title)),
  sources: (block) =>
    Array.isArray(block.sources) &&
    block.sources.every((pair) => Array.isArray(pair) && pair.length === 2 && pair.every(isText)),
};

/* The stored draft, or an empty one when there is none or it no longer reads. */
export const loadDraft = () => {
  try {
    const stored = JSON.parse(window.localStorage.getItem(DRAFT_STORAGE_KEY));
    if (!stored || !isText(stored.title) || !Array.isArray(stored.blocks)) return emptyDraft();
    const ids = new Set();
    const blocks = stored.blocks.slice(0, LIMITS.blocks).map((block) => {
      if (
        !/^b\d{1,6}$/.test(block?.id) ||
        ids.has(block.id) ||
        !BLOCK_SHAPES[block.type]?.(block)
      ) {
        throw new Error('Unreadable draft block');
      }
      ids.add(block.id);
      return normalize(block);
    });
    const date =
      isText(stored.date) && /^\d{4}-\d{2}-\d{2}$/.test(stored.date) ? stored.date : null;
    return { title: fit(stored.title, LIMITS.title), date, blocks };
  } catch {
    return emptyDraft();
  }
};

export const saveDraft = (draft) => {
  try {
    if (isEmpty(draft)) window.localStorage.removeItem(DRAFT_STORAGE_KEY);
    else window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
  } catch {
    // Storage full or unavailable: the draft lives only in this tab.
  }
};

export const clearDraft = () => saveDraft(emptyDraft());
