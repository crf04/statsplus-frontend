import { act, fireEvent, render, screen, within } from '@testing-library/react';
import App from '../App';
import { decodeReport } from '../reportsApi';
import blockFixture from '../../e2e/fixtures/report-blocks.json';

/*
 * Block documents (crf04/statsplus#380): a report written as an ordered list
 * of blocks renders each block where the writer put it, and its author hides
 * blocks and reorders or removes their cards by block id.
 */

const mockAuth = {
  currentUser: null,
  loading: false,
  error: null,
  signInWithGoogle: jest.fn(),
  logout: jest.fn(),
  getToken: jest.fn(),
  isAuthenticated: false,
  isAdmin: false,
  waitlist: null,
};
jest.mock('../contexts/AuthContext', () => ({
  AuthProvider: ({ children }) => children,
  useAuth: () => mockAuth,
}));

const mockGet = jest.fn();
const mockPut = jest.fn();
jest.mock('../utils/axiosConfig', () => ({
  __esModule: true,
  default: {
    get: (...args) => mockGet(...args),
    put: (...args) => mockPut(...args),
    patch: jest.fn(),
    post: jest.fn(),
    delete: jest.fn(),
  },
}));

const ID = 'r7b10cks28';
const TITLE = 'Reaves assists without Dončić';
const EDITS_URL = `http://127.0.0.1:8000/api/user/reports/${ID}/edits`;

const calls = [
  {
    id: 'reaves-ast',
    tool: 'query_game_logs',
    card: 'game-logs',
    structured: {
      player: { name: 'Austin Reaves' },
      chart_stat: 'AST',
      applied: { without: [{ name: 'Luka Dončić' }] },
    },
  },
  { id: 'lal-onoff', tool: 'get_on_off', card: 'on-off', structured: { team: 'LAL' } },
  {
    id: 'reaves-matchup',
    tool: 'get_matchup',
    card: 'matchup',
    structured: { player: { name: 'Austin Reaves' } },
  },
];
const cards = {
  'game-logs': '<p>game logs card</p>',
  'on-off': '<p>on/off card</p>',
  matchup: '<p>matchup card</p>',
};

const spot = {
  id: 'spot-reaves',
  type: 'spot',
  tag: 'lean',
  title: 'Austin Reaves o6.5 AST',
  subtitle: 'FanDuel −140',
  key: '8.0 AST in 10 games without Dončić',
  cards: ['reaves-ast', 'reaves-matchup'],
};
const row = { id: 'season-cards', type: 'cards', cards: ['lal-onoff', 'reaves-matchup'] };
const blocks = () => [
  {
    id: 'lede',
    type: 'paragraph',
    lede: true,
    text: 'Dončić is out. **At 6.5 it does;** 7.5 needs his *full* role.',
  },
  spot,
  { id: 'card-onoff', type: 'card', card: 'lal-onoff' },
  { id: 'market', type: 'heading', text: 'The market' },
  {
    id: 'body',
    type: 'paragraph',
    text: 'See https://example.com/x for more.\n- One reason\n- Another *reason*\nAfter the list.',
  },
  row,
  { id: 'ghost-card', type: 'card', card: 'not-a-call' },
  { id: 'steps', type: 'list', ordered: true, items: ['Check the line', 'Check the **report**'] },
  { id: 'risk', type: 'callout', title: 'What loses it', tone: 'warn', text: '- A blowout' },
  { id: 'note', type: 'callout', tone: 'plain', text: 'Prices as posted.' },
  {
    id: 'prices',
    type: 'table',
    columns: ['Line', 'Prices'],
    rows: [
      ['Over 6.5', 'FanDuel −140'],
      ['Over 7.5', 'DraftKings +107'],
    ],
  },
  {
    id: 'tabs',
    type: 'tabs',
    tabs: [
      {
        title: 'Spots',
        blocks: [
          {
            id: 'spots',
            type: 'items',
            layout: 'rows',
            items: [{ title: 'Rui Hachimura o9.5 PTS', tag: 'thin', body: ['Bench role.'] }],
          },
        ],
      },
      { title: 'Notes', blocks: [{ id: 'notes', type: 'paragraph', text: 'Second tab.' }] },
    ],
  },
  {
    id: 'sources',
    type: 'sources',
    sources: [
      ['Dončić out', 'https://www.nba.com/report'],
      ['Bad link', 'javascript:alert(1)'],
    ],
  },
];
const published = (title = TITLE, list = blocks()) => ({ title, date: '2026-10-28', blocks: list });

const payload = (overrides = {}) => ({
  report: {
    id: ID,
    created_at: '2026-10-28T21:19:40Z',
    author: { label: '@bighatprops' },
    is_author: false,
    listed: false,
    featured: false,
    notes: null,
    edited_at: null,
    calls,
    cards,
    document: published(),
    ...overrides,
  },
});
const authorPayload = (overrides = {}) =>
  payload({
    is_author: true,
    original: { document: published(), calls },
    edits: null,
    ...overrides,
  });

const open = async (data = payload(), title = TITLE) => {
  mockGet.mockResolvedValue({ data });
  window.history.pushState({}, '', `/reports/${ID}`);
  render(<App />);
  return screen.findByRole('heading', { level: 1, name: title });
};

const frames = () => [...document.querySelectorAll('iframe.report-card')];
const frameTitles = (node = document) =>
  [...node.querySelectorAll('iframe.report-card')].map((frame) => frame.title);

beforeEach(() => {
  mockGet.mockReset();
  mockPut.mockReset();
});

afterEach(() => {
  Object.assign(mockAuth, { currentUser: null, isAuthenticated: false });
});

describe('reading a block report', () => {
  test('every block renders in the order written, with its cards drawn in place', async () => {
    await open();
    const article = document.querySelector('.report-blocks');
    // The lede, the spot's first card behind chips, the inline card, the row of two.
    expect(frameTitles(article)).toEqual([
      'Reaves AST w/o Dončić',
      'LAL on/off',
      'LAL on/off',
      'Reaves matchup',
    ]);
    expect(screen.getByRole('heading', { level: 2, name: 'The market' })).toBeInTheDocument();
    const text = article.textContent;
    const order = ['Dončić is out.', 'Austin Reaves o6.5 AST', 'The market', 'Check the line'];
    expect(order.map((words) => text.indexOf(words))).toEqual(
      [...order.map((words) => text.indexOf(words))].sort((a, b) => a - b),
    );
    expect(frames()).toHaveLength(4);
  });

  test('a lede paragraph reads as the lede, with bold and italic and nothing else parsed', async () => {
    await open();
    const lede = screen.getByText('Dončić is out.', { exact: false });
    expect(lede.tagName).toBe('P');
    expect(lede).toHaveClass('report-lede');
    expect(within(lede).getByText('At 6.5 it does;').tagName).toBe('STRONG');
    expect(within(lede).getByText('full').tagName).toBe('EM');
    expect(lede).toHaveTextContent('Dončić is out. At 6.5 it does; 7.5 needs his full role.');
  });

  test('a URL in a paragraph stays text, and "- " lines become a bulleted list', async () => {
    await open();
    const url = screen.getByText('See https://example.com/x for more.');
    expect(url.tagName).toBe('P');
    expect(url.querySelector('a')).toBeNull();
    expect(screen.queryByRole('link', { name: /example\.com/ })).not.toBeInTheDocument();
    const bullets = url.nextElementSibling;
    expect(bullets.tagName).toBe('UL');
    expect(
      within(bullets)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual(['One reason', 'Another reason']);
    expect(within(bullets).getByText('reason').tagName).toBe('EM');
    expect(bullets.nextElementSibling).toHaveTextContent('After the list.');
  });

  test('a list block is numbered when ordered and its items are plain text', async () => {
    await open();
    const list = screen.getByText('Check the line').closest('ol');
    expect(
      within(list)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual(['Check the line', 'Check the **report**']);
  });

  test('callouts carry their title and tone, and format their text', async () => {
    await open();
    const risk = screen.getByText('What loses it').closest('aside');
    expect(risk).toHaveClass('report-block-callout', 'warn');
    expect(within(risk).getByRole('listitem')).toHaveTextContent('A blowout');
    const note = screen.getByText('Prices as posted.').closest('aside');
    expect(note).toHaveClass('plain');
  });

  test('a spot shows its grade, title, line and key, then its cards behind chips', async () => {
    await open();
    const region = screen.getByRole('region', { name: 'Austin Reaves o6.5 AST' });
    expect(within(region).getByText('Lean')).toHaveClass('report-tag', 'lean');
    expect(region).toHaveTextContent('FanDuel −140');
    expect(region).toHaveTextContent('8.0 AST in 10 games without Dončić');
    expect(frameTitles(region)).toEqual(['Reaves AST w/o Dončić']);
    fireEvent.click(within(region).getByRole('button', { name: 'Reaves matchup' }));
    expect(frameTitles(region)).toEqual(['Reaves matchup']);
  });

  test('a row of cards draws every card side by side, and a card with no call draws nothing', async () => {
    await open();
    const rowNode = document.querySelector('.report-block-card-row');
    expect(frameTitles(rowNode)).toEqual(['LAL on/off', 'Reaves matchup']);
    expect(document.querySelectorAll('.report-block-card')).toHaveLength(3);
  });

  test('a table has its columns as headers and each row led by its first cell', async () => {
    await open();
    const table = screen.getByRole('table');
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((th) => th.textContent),
    ).toEqual(['Line', 'Prices']);
    expect(within(table).getByRole('rowheader', { name: 'Over 7.5' })).toBeInTheDocument();
    expect(within(table).getByRole('cell', { name: 'DraftKings +107' })).toBeInTheDocument();
  });

  test('a tab group switches between its blocks, by click and by arrow key, with items in their layout', async () => {
    await open();
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((tab) => tab.textContent)).toEqual(['Spots', 'Notes']);
    // Every tab controls a panel that exists; only the chosen one shows.
    tabs.forEach((tab) => {
      expect(document.getElementById(tab.getAttribute('aria-controls'))).toHaveAttribute(
        'aria-labelledby',
        tab.id,
      );
    });
    expect(screen.getByText('Rui Hachimura o9.5 PTS')).toBeInTheDocument();
    expect(screen.queryByText('Second tab.')).not.toBeInTheDocument();
    // Items keep today's rows: one opens into its read.
    fireEvent.click(screen.getByText('Rui Hachimura o9.5 PTS'));
    expect(await screen.findByText('Bench role.')).toBeInTheDocument();
    fireEvent.keyDown(tabs[0], { key: 'ArrowRight' });
    expect(screen.getByText('Second tab.')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Notes' })).toHaveFocus();
    fireEvent.click(screen.getByRole('tab', { name: 'Spots' }));
    expect(screen.getByText('Rui Hachimura o9.5 PTS')).toBeInTheDocument();
  });

  test('sources link only their web addresses', async () => {
    await open();
    expect(screen.getByRole('link', { name: 'Dončić out' })).toHaveAttribute(
      'href',
      'https://www.nba.com/report',
    );
    expect(screen.queryByText('Bad link')).not.toBeInTheDocument();
  });

  test('the Reaves fixture renders every card live, in the order it was written', async () => {
    await open(blockFixture, 'Austin Reaves assists without Dončić · LAL @ LAC');
    expect(frameTitles()).toEqual([
      'LAL on/off',
      'Reaves AST w/o Dončić',
      'Reaves POTENTIAL_AST season',
      'Reaves matchup',
    ]);
    expect(screen.getByRole('region', { name: 'Austin Reaves o6.5 AST' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'This season, already' })).toBeVisible();
  });
});

describe('decoding both shapes', () => {
  const decode = (document) => decodeReport(payload({ document }));

  test('a tab document still decodes as tabs, a block document as blocks', () => {
    const tabs = decode({
      title: 'T',
      tabs: [{ title: 'A', layout: 'list', items: [{ title: 'x' }] }],
    }).document;
    expect(tabs.tabs[0].items[0].title).toBe('x');
    expect(tabs.blocks).toBeUndefined();
    const doc = decode(published()).document;
    expect(doc.tabs).toBeUndefined();
    expect(doc.blocks.map((block) => block.type)).toEqual([
      'paragraph',
      'spot',
      'card',
      'heading',
      'paragraph',
      'cards',
      'card',
      'list',
      'callout',
      'callout',
      'table',
      'tabs',
      'sources',
    ]);
    // A card the page cannot draw is dropped; a source that is not a web link too.
    expect(doc.blocks[6].card).toBeNull();
    expect(doc.blocks[12].sources).toEqual([['Dončić out', 'https://www.nba.com/report']]);
  });

  test('a blank table cell is valid and renders as an empty cell', async () => {
    const list = [{ id: 't', type: 'table', columns: ['Line', ''], rows: [['Over 6.5', '']] }];
    await open(payload({ document: published(TITLE, list) }));
    const table = screen.getByRole('table');
    expect(
      within(table)
        .getAllByRole('cell')
        .map((td) => td.textContent),
    ).toEqual(['']);
    expect(within(table).getByRole('rowheader', { name: 'Over 6.5' })).toBeInTheDocument();
  });

  test('a card an items block cannot draw is left out of its item, in a tab too', () => {
    const items = {
      id: 'spots',
      type: 'items',
      layout: 'rows',
      items: [{ title: 'A', cards: ['ghost', 'lal-onoff', 'no-html'] }],
    };
    const report = decodeReport(
      payload({
        calls: [
          ...calls,
          { id: 'no-html', tool: 'get_rotation', card: 'rotation', structured: {} },
        ],
        document: published(TITLE, [
          items,
          {
            id: 'group',
            type: 'tabs',
            tabs: [{ title: 'One', blocks: [{ ...items, id: 'inner' }] }],
          },
        ]),
      }),
    );
    expect(report.document.blocks[0].items[0].cards).toEqual(['lal-onoff']);
    expect(report.document.blocks[1].tabs[0].blocks[0].items[0].cards).toEqual(['lal-onoff']);
  });

  test.each([
    [
      'both tabs and blocks',
      {
        ...published(),
        tabs: [{ title: 'A', layout: 'list', items: [{ title: 'x' }] }],
      },
    ],
    ['neither tabs nor blocks', { title: 'T' }],
    ['an unknown block type', published(TITLE, [{ id: 'a', type: 'video', text: 'x' }])],
    ['a block id with capitals', published(TITLE, [{ id: 'A', type: 'heading', text: 'x' }])],
    [
      'a duplicate id inside a tab',
      published(TITLE, [
        { id: 'a', type: 'heading', text: 'x' },
        {
          id: 't',
          type: 'tabs',
          tabs: [{ title: 'One', blocks: [{ id: 'a', type: 'heading', text: 'y' }] }],
        },
      ]),
    ],
    [
      'tabs inside tabs',
      published(TITLE, [
        {
          id: 't',
          type: 'tabs',
          tabs: [{ title: 'One', blocks: [{ id: 'u', type: 'tabs', tabs: [] }] }],
        },
      ]),
    ],
    [
      'a table row of the wrong width',
      published(TITLE, [{ id: 't', type: 'table', columns: ['A', 'B'], rows: [['1']] }]),
    ],
    [
      'an unknown callout tone',
      published(TITLE, [{ id: 'c', type: 'callout', text: 'x', tone: 'loud' }]),
    ],
    [
      'an unknown spot grade',
      published(TITLE, [{ id: 's', type: 'spot', title: 'x', tag: 'lock' }]),
    ],
    ['an items block with no layout', published(TITLE, [{ id: 'i', type: 'items', items: [] }])],
  ])('refuses %s', (_, document) => {
    expect(() => decode(document)).toThrow('The report endpoint returned an invalid response.');
  });

  test('block edits decode by id, with cards only where the author changed them', () => {
    const report = decodeReport(
      authorPayload({
        edits: {
          title: TITLE,
          notes: null,
          blocks: [
            { id: 'market', hidden: true },
            { id: 'season-cards', hidden: false, cards: ['reaves-matchup'] },
          ],
        },
      }),
    );
    expect(report.edits).toEqual({
      title: TITLE,
      notes: null,
      blocks: [
        { id: 'market', hidden: true, cards: null },
        { id: 'season-cards', hidden: false, cards: ['reaves-matchup'] },
      ],
    });
    expect(report.original.document.blocks).toHaveLength(13);
    expect(() =>
      decodeReport(authorPayload({ edits: { title: TITLE, blocks: [{ id: 'market' }] } })),
    ).toThrow();
  });
});

describe('editing a block report', () => {
  const signIn = () =>
    Object.assign(mockAuth, { currentUser: { uid: 'u1' }, isAuthenticated: true });
  const startEditing = async (data = authorPayload()) => {
    signIn();
    await open(data);
    fireEvent.click(screen.getByRole('button', { name: 'Edit report' }));
    return screen.getByRole('form', { name: 'Edit report' });
  };
  const block = (name) => screen.getByRole('region', { name });
  const press = (name, region) =>
    fireEvent.click(within(block(region)).getByRole('button', { name }));
  const cardOrder = (name) =>
    within(within(block(name)).getByRole('list', { name: `Cards in ${name}` }))
      .getAllByRole('listitem')
      .map((li) => li.querySelector('.report-edit-card-label').textContent);
  const save = async () => {
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save edits' }));
    });
  };
  const sentBody = () => {
    expect(mockPut).toHaveBeenCalledTimes(1);
    expect(mockPut.mock.calls[0][0]).toBe(EDITS_URL);
    return mockPut.mock.calls[0][1];
  };
  const ROW = 'Cards: LAL on/off, Reaves matchup';

  test('every block is listed by id-stable label, card blocks with their cards', async () => {
    await startEditing();
    expect(block('Heading: The market')).toBeInTheDocument();
    expect(
      block('Lede: Dončić is out. At 6.5 it does; 7.5 needs his full role.'),
    ).toBeInTheDocument();
    expect(cardOrder('Austin Reaves o6.5 AST')).toEqual([
      'Reaves AST w/o Dončić',
      'Reaves matchup',
    ]);
    expect(cardOrder(ROW)).toEqual(['LAL on/off', 'Reaves matchup']);
    // A paragraph has nothing to edit but its visibility.
    expect(within(block('Heading: The market')).queryByText('No cards.')).not.toBeInTheDocument();
    // A tab group lists the blocks in its tabs.
    expect(
      within(block('Tabs: Spots · Notes')).getByRole('region', { name: 'Paragraph: Second tab.' }),
    ).toBeInTheDocument();
  });

  test('the author hides a block, reorders and removes cards, and saves edits addressed by id', async () => {
    await startEditing();
    press('Hide block Heading: The market', 'Heading: The market');
    press('Move Reaves matchup up', ROW);
    press('Remove Reaves AST w/o Dončić', 'Austin Reaves o6.5 AST');
    press('Hide tabs Tabs: Spots · Notes', 'Tabs: Spots · Notes');
    expect(
      within(block('Tabs: Spots · Notes')).getByText(
        'Hidden from readers, with every block in it.',
      ),
    ).toBeInTheDocument();
    expect(cardOrder('Austin Reaves o6.5 AST')).toEqual([
      'Reaves matchup',
      'Reaves AST w/o DončićRemoved',
    ]);

    const list = blocks().filter((b) => !['market', 'tabs'].includes(b.id));
    const shown = list.map((b) =>
      b.id === 'season-cards'
        ? { ...b, cards: ['reaves-matchup', 'lal-onoff'] }
        : b.id === 'spot-reaves'
          ? { ...b, cards: ['reaves-matchup'] }
          : b,
    );
    mockPut.mockResolvedValue({
      data: authorPayload({ document: published(TITLE, shown), edited_at: '2026-10-28T23:00:00Z' }),
    });
    await save();

    expect(sentBody()).toEqual({
      title: TITLE,
      notes: null,
      blocks: [
        { id: 'spot-reaves', hidden: false, cards: ['reaves-matchup'] },
        { id: 'market', hidden: true },
        { id: 'season-cards', hidden: false, cards: ['reaves-matchup', 'lal-onoff'] },
        { id: 'tabs', hidden: true },
      ],
    });
    // Readers see the saved version: no heading, no tabs, the row in its new order.
    await screen.findByRole('heading', { level: 1, name: TITLE });
    expect(screen.queryByRole('heading', { level: 2, name: 'The market' })).not.toBeInTheDocument();
    expect(screen.queryAllByRole('tab')).toEqual([]);
    expect(frameTitles(document.querySelector('.report-block-card-row'))).toEqual([
      'Reaves matchup',
      'LAL on/off',
    ]);
  });

  test('the editor opens on the saved block edits, and restoring sends only what still differs', async () => {
    await startEditing(
      authorPayload({
        edits: {
          title: TITLE,
          notes: null,
          blocks: [
            { id: 'market', hidden: true },
            { id: 'season-cards', hidden: false, cards: ['reaves-matchup'] },
          ],
        },
      }),
    );
    expect(within(block('Heading: The market')).getByText('Hidden')).toBeInTheDocument();
    expect(cardOrder(ROW)).toEqual(['Reaves matchup', 'LAL on/offRemoved']);

    press('Restore block Heading: The market', 'Heading: The market');
    mockPut.mockResolvedValue({ data: authorPayload() });
    await save();
    expect(sentBody()).toEqual({
      title: TITLE,
      notes: null,
      blocks: [{ id: 'season-cards', hidden: false, cards: ['reaves-matchup'] }],
    });
  });

  test('an items block offers its items’ cards once each', async () => {
    const list = [
      {
        id: 'spots',
        type: 'items',
        layout: 'list',
        items: [
          { title: 'A', cards: ['reaves-ast', 'lal-onoff'] },
          { title: 'B', cards: ['lal-onoff'] },
        ],
      },
    ];
    await startEditing(
      authorPayload({
        document: published(TITLE, list),
        original: { document: published(TITLE, list), calls },
      }),
    );
    expect(cardOrder('Items: A · B')).toEqual(['Reaves AST w/o Dončić', 'LAL on/off']);
    press('Remove LAL on/off', 'Items: A · B');
    mockPut.mockResolvedValue({ data: authorPayload() });
    await save();
    expect(sentBody().blocks).toEqual([{ id: 'spots', hidden: false, cards: ['reaves-ast'] }]);
  });
});
