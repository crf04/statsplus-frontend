import { CARD_TOOLS } from './cardsApi';

/*
 * The Report Builder's draft (crf04/statsplus#382): a block document
 * (crf04/statsplus#380) of text blocks and Cards, kept within the backend's
 * limits as it is typed, so the draft is the document that gets published.
 * Each Card is a call, `{id, tool, args, preview}`, that a `card` block or a
 * `cards` row of 2-3 names; a call no block names is dropped. One draft lives
 * in this browser's local storage until it is published or discarded.
 */

export const LIMITS = {
  title: 120,
  blocks: 120,
  calls: 48,
  row: 3,
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
    case 'card':
      return { id, type, card: fields.card };
    case 'cards':
      return { id, type, cards: fields.cards };
    default:
      throw new Error(`Unknown block type ${type}`);
  }
};

export const emptyDraft = () => ({ title: '', date: null, blocks: [], calls: [] });

// Ids match [a-z0-9-]{1,40} and never repeat within the draft: b1, b2… for blocks, c1, c2… for calls.
const nextId = (prefix, items) =>
  `${prefix}${Math.max(0, ...items.map((item) => Number(item.id.slice(1)) || 0)) + 1}`;

const replace = (blocks, id, change) =>
  blocks.map((block) => (block.id === id ? change(block) : block));

/* The call ids a block shows, in order. */
export const blockCalls = (block) =>
  block.type === 'card' ? [block.card] : block.type === 'cards' ? block.cards : [];

/* The draft with only the calls some block still shows. */
const prune = (draft) => {
  const shown = new Set(draft.blocks.flatMap(blockCalls));
  return { ...draft, calls: draft.calls.filter((call) => shown.has(call.id)) };
};

/* A row of the given calls: two or three make a `cards` row, one a `card` block. */
const row = (id, cards) =>
  cards.length === 1 ? { id, type: 'card', card: cards[0] } : { id, type: 'cards', cards };

/* Whether a new Card can go into this block: a lone card or a row with room. */
export const hasRoom = (block) =>
  block.type === 'card' || (block.type === 'cards' && block.cards.length < LIMITS.row);

/*
 * Whether a Card can be inserted: into the block `into` names, or as a new
 * block at the end when it names none.
 */
export const canInsert = (draft, into = null) => {
  if (draft.calls.length >= LIMITS.calls) return false;
  if (!into) return draft.blocks.length < LIMITS.blocks;
  const target = draft.blocks.find((block) => block.id === into);
  return Boolean(target && hasRoom(target));
};

export const draftReducer = (draft, action) => {
  switch (action.type) {
    case 'add':
      return {
        ...draft,
        blocks: [
          ...draft.blocks,
          normalize({ id: nextId('b', draft.blocks), type: action.block, ...BLANK[action.block] }),
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
      return prune({ ...draft, blocks: draft.blocks.filter((block) => block.id !== action.id) });
    case 'insertCard': {
      if (!canInsert(draft, action.into)) return draft;
      const id = nextId('c', draft.calls);
      const call = { id, tool: action.call.tool, args: action.call.args, preview: action.preview };
      const blocks = action.into
        ? replace(draft.blocks, action.into, (block) => row(block.id, [...blockCalls(block), id]))
        : [...draft.blocks, row(nextId('b', draft.blocks), [id])];
      return { ...draft, blocks, calls: [...draft.calls, call] };
    }
    case 'removeCard':
      return prune({
        ...draft,
        blocks: replace(draft.blocks, action.id, (block) =>
          row(
            block.id,
            block.cards.filter((card) => card !== action.card),
          ),
        ),
      });
    case 'preview':
      return {
        ...draft,
        calls: draft.calls.map((call) =>
          call.id === action.call ? { ...call, preview: action.preview } : call,
        ),
      };
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
    case 'card':
    case 'cards':
      return null;
    default:
      return blank(block.text) ? 'Write something here, or delete this block.' : null;
  }
};

export const isEmpty = (draft) => !draft.title && !draft.date && !draft.blocks.length;

/* The backend's POST body for a text-only Report: no calls, no cards, written in the builder. */
export const publishBody = (draft, { date, showAuthor, listed }) => ({
  report: { title: draft.title.trim(), date, blocks: draft.blocks },
  calls: [],
  cards: {},
  show_author: showAuthor,
  listed,
  origin: 'builder',
});

/* The MCP server's POST body for a Report with Cards: each call as previewed, which it reruns. */
export const cardPublishBody = (draft, { date, showAuthor, listed }) => ({
  report: { title: draft.title.trim(), date, blocks: draft.blocks },
  calls: draft.calls.map(({ id, tool, args }) => ({ id, tool, args })),
  show_author: showAuthor,
  listed,
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
  card: (block) => isText(block.card),
  cards: (block) =>
    Array.isArray(block.cards) &&
    block.cards.length >= 2 &&
    block.cards.length <= LIMITS.row &&
    block.cards.every(isText),
};

const isCall = (call) =>
  /^c\d{1,6}$/.test(call?.id) &&
  CARD_TOOLS.includes(call.tool) &&
  Boolean(call.args) &&
  typeof call.args === 'object' &&
  !Array.isArray(call.args);

/*
 * The stored draft, or an empty one when there is none or it no longer reads.
 * Its Cards come back without previews, which the author asks for again.
 */
export const loadDraft = () => {
  try {
    const stored = JSON.parse(window.localStorage.getItem(DRAFT_STORAGE_KEY));
    if (!stored || !isText(stored.title) || !Array.isArray(stored.blocks)) return emptyDraft();
    const storedCalls = stored.calls ?? [];
    if (!Array.isArray(storedCalls) || !storedCalls.every(isCall)) return emptyDraft();
    const calls = storedCalls
      .slice(0, LIMITS.calls)
      .map(({ id, tool, args }) => ({ id, tool, args, preview: null }));
    const callIds = new Set(calls.map((call) => call.id));
    if (callIds.size !== calls.length) return emptyDraft();
    const ids = new Set();
    const blocks = stored.blocks.slice(0, LIMITS.blocks).map((block) => {
      if (
        !/^b\d{1,6}$/.test(block?.id) ||
        ids.has(block.id) ||
        !BLOCK_SHAPES[block.type]?.(block) ||
        !blockCalls(block).every((call) => callIds.has(call))
      ) {
        throw new Error('Unreadable draft block');
      }
      ids.add(block.id);
      return normalize(block);
    });
    const date =
      isText(stored.date) && /^\d{4}-\d{2}-\d{2}$/.test(stored.date) ? stored.date : null;
    return prune({ title: fit(stored.title, LIMITS.title), date, blocks, calls });
  } catch {
    return emptyDraft();
  }
};

/*
 * Previews stay out of storage: one is 40-90 KB (a game-log Card's result is
 * about 11 KB and its HTML 30 KB; a Matchup's are 55 KB and 35 KB), so 48 of
 * them could pass the 5 MB a browser gives the site and stop the text saving too.
 */
export const saveDraft = (draft) => {
  try {
    const calls = draft.calls.map(({ id, tool, args }) => ({ id, tool, args }));
    if (isEmpty(draft)) window.localStorage.removeItem(DRAFT_STORAGE_KEY);
    else window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify({ ...draft, calls }));
  } catch {
    // Storage full or unavailable: the draft lives only in this tab.
  }
};

export const clearDraft = () => saveDraft(emptyDraft());
