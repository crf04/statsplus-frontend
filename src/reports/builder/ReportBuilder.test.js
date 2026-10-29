import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../../App';
import { researchPage } from '../../research/researchFixtures';

/*
 * The Report Builder (crf04/statsplus#382) at /reports/new: an author writes
 * text blocks, the draft survives a reload, and publishing posts the block
 * document and opens the published Report.
 */

const mockAuth = {
  currentUser: { uid: 'u1', email: 'author@example.com' },
  loading: false,
  error: null,
  signInWithGoogle: jest.fn(),
  logout: jest.fn(),
  getToken: jest.fn(),
  isAuthenticated: true,
  isAdmin: false,
  waitlist: null,
};
jest.mock('../../contexts/AuthContext', () => ({
  AuthProvider: ({ children }) => children,
  useAuth: () => mockAuth,
}));

const mockGet = jest.fn();
const mockPost = jest.fn();
const mockPut = jest.fn();
jest.mock('../../utils/axiosConfig', () => ({
  __esModule: true,
  default: {
    get: (...args) => mockGet(...args),
    post: (...args) => mockPost(...args),
    put: (...args) => mockPut(...args),
    patch: jest.fn(),
    delete: jest.fn(),
  },
}));

const API = 'http://127.0.0.1:8000';
const DRAFT_KEY = 'courtai:report-draft';

const published = {
  report: {
    id: 'n3wr3p0rt1',
    created_at: '2026-10-28T03:00:00Z',
    author: { label: 'Chris' },
    is_author: true,
    listed: false,
    featured: false,
    origin: 'builder',
    calls: [],
    cards: {},
    document: {
      title: 'Bane without Banchero',
      date: '2026-10-28',
      blocks: [{ id: 'b1', type: 'paragraph', text: 'Bane takes the shots.', lede: true }],
    },
  },
};

beforeEach(() => {
  window.localStorage.clear();
  mockGet.mockReset();
  mockPost.mockReset();
  mockPut.mockReset();
  mockGet.mockImplementation((url) => {
    if (url === `${API}/api/reports/n3wr3p0rt1`) return Promise.resolve({ data: published });
    if (url === `${API}/api/research`) return Promise.resolve({ data: researchPage() });
    if (url === `${API}/api/user/saved-filter-sets`) {
      return Promise.resolve({ data: { saved_filter_sets: [] } });
    }
    return Promise.reject({ response: { status: 404 } });
  });
  // 2026-10-28 12:00 in Tokyo, the test time zone.
  jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-10-28T03:00:00Z'));
});

afterEach(() => {
  Object.assign(mockAuth, {
    currentUser: { uid: 'u1', email: 'author@example.com' },
    isAuthenticated: true,
    waitlist: null,
  });
  jest.restoreAllMocks();
});

const open = (path = '/reports/new') => {
  window.history.pushState({}, '', path);
  return render(<App />);
};

const openBuilder = async () => {
  const view = open();
  await screen.findByRole('heading', { level: 1, name: 'Write a report' });
  return view;
};

const add = (type) => fireEvent.click(screen.getByRole('button', { name: `Add ${type}` }));
const blocks = () => screen.queryAllByRole('region', { name: /^Block \d+: / });
const blockNames = () => blocks().map((block) => block.getAttribute('aria-label'));
const block = (place) => blocks()[place - 1];
const type = (field, value) => fireEvent.change(field, { target: { value } });

/* A heading, a lede paragraph, a list, a callout and a source, all filled in. */
const writeReport = () => {
  add('heading');
  type(within(block(1)).getByLabelText('Heading'), 'The spot');
  add('paragraph');
  type(within(block(2)).getByLabelText('Text'), 'Bane takes the shots.\nEvery night.');
  fireEvent.click(within(block(2)).getByLabelText('Lede: the opening that stands out'));
  add('list');
  type(within(block(3)).getByLabelText('Item 1'), 'Usage up');
  fireEvent.click(within(block(3)).getByRole('button', { name: 'Add item' }));
  type(within(block(3)).getByLabelText('Item 2'), 'Minutes up');
  fireEvent.click(within(block(3)).getByLabelText('Numbered'));
  add('callout');
  type(within(block(4)).getByLabelText('Title (optional)'), 'What loses it');
  type(within(block(4)).getByLabelText('Text'), 'Black returns.');
  fireEvent.change(within(block(4)).getByLabelText('Tone'), { target: { value: 'warn' } });
  add('sources');
  type(within(block(5)).getByLabelText('Source 1 fact'), 'Banchero out');
  type(within(block(5)).getByLabelText('Source 1 link'), 'https://www.espn.com/x');
};

const WRITTEN_BLOCKS = [
  { id: 'b1', type: 'heading', text: 'The spot' },
  { id: 'b2', type: 'paragraph', text: 'Bane takes the shots.\nEvery night.', lede: true },
  { id: 'b3', type: 'list', items: ['Usage up', 'Minutes up'], ordered: true },
  { id: 'b4', type: 'callout', title: 'What loses it', text: 'Black returns.', tone: 'warn' },
  { id: 'b5', type: 'sources', sources: [['Banchero out', 'https://www.espn.com/x']] },
];

const openPublish = () => {
  fireEvent.click(screen.getByRole('button', { name: 'Publish…' }));
  return screen.getByRole('dialog', { name: 'Publish your report' });
};

test('a signed-out visitor is asked to sign in, and sees no builder', async () => {
  Object.assign(mockAuth, { currentUser: null, isAuthenticated: false });
  open();
  expect(
    await screen.findByRole('heading', { level: 1, name: 'Sign in to write a report' }),
  ).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Add paragraph' })).not.toBeInTheDocument();
});

test('a waitlisted account sees the waitlist message, not the builder', async () => {
  Object.assign(mockAuth, { waitlist: { message: 'We will let you in soon.' } });
  open();
  expect(await screen.findByText('We will let you in soon.')).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'Write a report' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Add paragraph' })).not.toBeInTheDocument();
});

const WAITLISTED = {
  response: { status: 403, data: { error: { code: 'waitlisted', message: 'Soon.' } } },
};

const refuseAdmission = (refusal) => {
  const served = mockGet.getMockImplementation();
  mockGet.mockImplementation((url, ...rest) =>
    url === `${API}/api/user/saved-filter-sets` ? refusal : served(url, ...rest),
  );
};

test('a waitlisted account the app has not yet heard about sees no builder on first load', async () => {
  refuseAdmission(Promise.reject(WAITLISTED));
  open();
  expect(await screen.findByRole('region', { name: 'Beta waitlist' })).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'Write a report' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Add paragraph' })).not.toBeInTheDocument();
});

test('a waitlisted account the app has not yet heard about gets no Write a report link', async () => {
  refuseAdmission(Promise.reject(WAITLISTED));
  open('/research');
  await screen.findByText('Nothing has been listed yet.');
  await act(async () => {});
  expect(screen.queryByRole('link', { name: 'Write a report' })).not.toBeInTheDocument();
});

test('while admission is unknown, neither the builder nor the link shows', async () => {
  refuseAdmission(new Promise(() => {}));
  const { unmount } = open();
  expect(await screen.findByText('Checking your account…')).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'Write a report' })).not.toBeInTheDocument();
  unmount();
  open('/research');
  await screen.findByText('Nothing has been listed yet.');
  expect(screen.queryByRole('link', { name: 'Write a report' })).not.toBeInTheDocument();
});

test('when admission cannot be checked, the builder waits for a retry', async () => {
  refuseAdmission(Promise.reject({ response: { status: 500 } }));
  open();
  expect(await screen.findByRole('alert')).toHaveTextContent('We couldn’t check your account.');
  expect(screen.queryByRole('heading', { name: 'Write a report' })).not.toBeInTheDocument();
});

test('the Research feed offers Write a report to an active account only', async () => {
  open('/research');
  const write = await screen.findByRole('link', { name: 'Write a report' });
  expect(write).toHaveAttribute('href', '/reports/new');
});

test('the Research feed offers no Write a report to a waitlisted account or a visitor', async () => {
  Object.assign(mockAuth, { waitlist: { message: 'Soon.' } });
  const { unmount } = open('/research');
  await screen.findByText('Nothing has been listed yet.');
  expect(screen.queryByRole('link', { name: 'Write a report' })).not.toBeInTheDocument();
  unmount();
  Object.assign(mockAuth, { waitlist: null, currentUser: null, isAuthenticated: false });
  open('/research');
  await screen.findByText('Nothing has been listed yet.');
  expect(screen.queryByRole('link', { name: 'Write a report' })).not.toBeInTheDocument();
});

test("the author's own report offers Write a report in its menu", async () => {
  open('/reports/n3wr3p0rt1');
  await screen.findByRole('heading', { level: 1, name: 'Bane without Banchero' });
  fireEvent.click(screen.getByRole('button', { name: 'More report actions' }));
  expect(await screen.findByRole('menuitem', { name: 'Write a report' })).toHaveAttribute(
    'href',
    '/reports/new',
  );
});

test('an author adds each block type, moves blocks and deletes one', async () => {
  await openBuilder();
  expect(blocks()).toHaveLength(0);
  writeReport();
  expect(blockNames()).toEqual([
    'Block 1: Heading',
    'Block 2: Paragraph',
    'Block 3: List',
    'Block 4: Callout',
    'Block 5: Sources',
  ]);

  fireEvent.click(screen.getByRole('button', { name: 'Move Block 4: Callout up' }));
  fireEvent.click(screen.getByRole('button', { name: 'Move Block 1: Heading down' }));
  expect(blockNames()).toEqual([
    'Block 1: Paragraph',
    'Block 2: Heading',
    'Block 3: Callout',
    'Block 4: List',
    'Block 5: Sources',
  ]);
  expect(screen.getByRole('button', { name: 'Move Block 1: Paragraph up' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Move Block 5: Sources down' })).toBeDisabled();
  // A moved block keeps what was typed in it.
  expect(within(block(3)).getByLabelText('Text')).toHaveValue('Black returns.');

  fireEvent.click(screen.getByRole('button', { name: 'Delete Block 4: List' }));
  expect(blockNames()).toEqual([
    'Block 1: Paragraph',
    'Block 2: Heading',
    'Block 3: Callout',
    'Block 4: Sources',
  ]);
  expect(screen.queryByDisplayValue('Usage up')).not.toBeInTheDocument();
});

test('list items and sources are added and removed within their block', async () => {
  await openBuilder();
  add('list');
  const list = block(1);
  expect(within(list).getByRole('button', { name: 'Remove item 1' })).toBeDisabled();
  type(within(list).getByLabelText('Item 1'), 'First');
  fireEvent.click(within(list).getByRole('button', { name: 'Add item' }));
  type(within(list).getByLabelText('Item 2'), 'Second');
  fireEvent.click(within(list).getByRole('button', { name: 'Remove item 1' }));
  expect(within(list).getByLabelText('Item 1')).toHaveValue('Second');
  expect(within(list).queryByLabelText('Item 2')).not.toBeInTheDocument();
  for (let i = 1; i < 12; i += 1) {
    fireEvent.click(within(list).getByRole('button', { name: 'Add item' }));
  }
  expect(within(list).getByLabelText('Item 12')).toBeInTheDocument();
  expect(within(list).getByRole('button', { name: 'Add item' })).toBeDisabled();

  add('sources');
  const sources = block(2);
  fireEvent.click(within(sources).getByRole('button', { name: 'Add source' }));
  type(within(sources).getByLabelText('Source 2 fact'), 'Kept');
  fireEvent.click(within(sources).getByRole('button', { name: 'Remove source 1' }));
  expect(within(sources).getByLabelText('Source 1 fact')).toHaveValue('Kept');
  for (let i = 1; i < 12; i += 1) {
    fireEvent.click(within(sources).getByRole('button', { name: 'Add source' }));
  }
  expect(within(sources).getByLabelText('Source 12 fact')).toBeInTheDocument();
  expect(within(sources).getByRole('button', { name: 'Add source' })).toBeDisabled();
  fireEvent.click(within(sources).getByRole('button', { name: 'Add source' }));
  expect(within(sources).queryByLabelText('Source 13 fact')).not.toBeInTheDocument();
});

test('the title takes 120 characters and refuses the 121st', async () => {
  await openBuilder();
  add('heading');
  type(within(block(1)).getByLabelText('Heading'), 'H');
  const title = within(openPublish()).getByLabelText('Title');
  type(title, 'a'.repeat(120));
  expect(title).toHaveValue('a'.repeat(120));
  type(title, 'a'.repeat(121));
  expect(title).toHaveValue('a'.repeat(120));
  expect(document.getElementById('report-build-title-count')).toHaveTextContent('120/120');
});

test('every field shows its limit and refuses text past it', async () => {
  await openBuilder();
  add('heading');
  add('paragraph');
  add('callout');
  add('list');
  add('sources');
  const cases = [
    [block(1), 'Heading', 120],
    [block(2), 'Text', 1500],
    [block(3), 'Title (optional)', 40],
    [block(3), 'Text', 1000],
    [block(4), 'Item 1', 300],
    [block(5), 'Source 1 fact', 200],
    [block(5), 'Source 1 link', 500],
  ];
  for (const [where, label, limit] of cases) {
    const field = within(where).getByLabelText(label);
    type(field, 'x'.repeat(limit + 5));
    expect(field.value).toHaveLength(limit);
    const count = document.getElementById(`${field.id}-count`);
    expect(count).toHaveTextContent(
      `${limit.toLocaleString('en-US')}/${limit.toLocaleString('en-US')}`,
    );
  }
  // The server counts characters as code points: an emoji is one, and is never split.
  const heading = within(block(1)).getByLabelText('Heading');
  type(heading, `${'x'.repeat(119)}😀`);
  expect(heading).toHaveValue(`${'x'.repeat(119)}😀`);
  expect(document.getElementById(`${heading.id}-count`)).toHaveTextContent('120/120');
  type(heading, `${'x'.repeat(119)}😀😀`);
  expect(heading).toHaveValue(`${'x'.repeat(119)}😀`);
  // Characters the server refuses are dropped as they are typed; tabs and line breaks stay.
  const text = within(block(2)).getByLabelText('Text');
  type(text, 'one\u0007\ttwo\nthree');
  expect(text).toHaveValue('one\ttwo\nthree');
});

test('a report holds at most 120 blocks', async () => {
  const stored = Array.from({ length: 119 }, (_, i) => ({
    id: `b${i + 1}`,
    type: 'heading',
    text: `H${i + 1}`,
  }));
  window.localStorage.setItem(DRAFT_KEY, JSON.stringify({ title: '', blocks: stored }));
  await openBuilder();
  add('heading');
  expect(document.querySelectorAll('[data-block]')).toHaveLength(120);
  expect(screen.getByRole('button', { name: 'Add paragraph' })).toBeDisabled();
  expect(screen.getByText('A report holds at most 120 blocks.')).toBeInTheDocument();
});

test('the draft survives a reload, and Discard draft starts over', async () => {
  const first = await openBuilder();
  writeReport();
  first.unmount();

  const second = await openBuilder();
  expect(blockNames()).toHaveLength(5);
  expect(within(block(2)).getByLabelText('Text')).toHaveValue(
    'Bane takes the shots.\nEvery night.',
  );
  expect(within(block(2)).getByLabelText('Lede: the opening that stands out')).toBeChecked();
  expect(within(block(3)).getByLabelText('Item 2')).toHaveValue('Minutes up');
  expect(within(block(4)).getByLabelText('Tone')).toHaveValue('warn');

  jest.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
  fireEvent.click(screen.getByRole('button', { name: 'Discard draft' }));
  expect(blocks()).toHaveLength(5);
  fireEvent.click(screen.getByRole('button', { name: 'Discard draft' }));
  expect(blocks()).toHaveLength(0);
  second.unmount();

  await openBuilder();
  expect(blocks()).toHaveLength(0);
  expect(window.localStorage.getItem(DRAFT_KEY)).toBeNull();
});

test('an unreadable stored draft opens an empty builder', async () => {
  window.localStorage.setItem(DRAFT_KEY, '{"title":"x","blocks":[{"id":"b1","type":"table"}]}');
  const first = await openBuilder();
  expect(blocks()).toHaveLength(0);
  first.unmount();

  // A known block type with a field of the wrong kind is as unreadable as an unknown type.
  window.localStorage.setItem(
    DRAFT_KEY,
    JSON.stringify({
      title: 'x',
      blocks: [
        { id: 'b1', type: 'heading', text: 'Fine' },
        { id: 'b2', type: 'paragraph', text: 42, lede: false },
      ],
    }),
  );
  await openBuilder();
  expect(blocks()).toHaveLength(0);
});

test('publishing waits until every block is filled in', async () => {
  await openBuilder();
  fireEvent.click(screen.getByRole('button', { name: 'Publish…' }));
  expect(screen.getByRole('alert')).toHaveTextContent('Add at least one block, then publish.');
  add('paragraph');
  add('sources');
  type(within(block(2)).getByLabelText('Source 1 fact'), 'A fact');
  type(within(block(2)).getByLabelText('Source 1 link'), 'espn.com/x');
  fireEvent.click(screen.getByRole('button', { name: 'Publish…' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(within(block(1)).getByRole('alert')).toHaveTextContent(
    'Write something here, or delete this block.',
  );
  expect(within(block(2)).getByRole('alert')).toHaveTextContent(
    'Each source needs a fact and a link starting http:// or https://.',
  );
});

test('publishing posts the block document with no cards and opens the Report', async () => {
  mockPost.mockResolvedValue({
    status: 201,
    data: {
      success: true,
      report: { id: 'n3wr3p0rt1', url: 'https://courtai.app/reports/n3wr3p0rt1' },
    },
  });
  await openBuilder();
  writeReport();
  const dialog = openPublish();
  expect(within(dialog).getByLabelText('Date')).toHaveValue('2026-10-28');
  expect(within(dialog).getByLabelText('Show my name')).not.toBeChecked();
  expect(within(dialog).getByLabelText('List in Research')).not.toBeChecked();
  expect(within(dialog).getByRole('button', { name: 'Publish' })).toBeDisabled();
  type(within(dialog).getByLabelText('Title'), '  Bane without Banchero ');
  fireEvent.click(within(dialog).getByLabelText('Show my name'));
  fireEvent.click(within(dialog).getByRole('button', { name: 'Publish' }));

  expect(
    await screen.findByRole('heading', { level: 1, name: 'Bane without Banchero' }),
  ).toBeInTheDocument();
  expect(mockPost.mock.calls).toEqual([
    [
      `${API}/api/user/reports`,
      {
        report: { title: 'Bane without Banchero', date: '2026-10-28', blocks: WRITTEN_BLOCKS },
        calls: [],
        cards: {},
        show_author: true,
        listed: false,
        origin: 'builder',
      },
    ],
  ]);
  expect(window.location.pathname).toBe('/reports/n3wr3p0rt1');
  expect(window.localStorage.getItem(DRAFT_KEY)).toBeNull();
});

test('a callout without a title publishes without one, on the date the author chose', async () => {
  mockPost.mockResolvedValue({ data: { report: { id: 'n3wr3p0rt1' } } });
  await openBuilder();
  add('callout');
  type(within(block(1)).getByLabelText('Title (optional)'), '   ');
  type(within(block(1)).getByLabelText('Text'), 'Plain note.');
  const dialog = openPublish();
  type(within(dialog).getByLabelText('Title'), 'Note');
  type(within(dialog).getByLabelText('Date'), '2026-10-30');
  fireEvent.click(within(dialog).getByLabelText('List in Research'));
  fireEvent.click(within(dialog).getByRole('button', { name: 'Publish' }));
  await screen.findByRole('heading', { level: 1, name: 'Bane without Banchero' });
  expect(mockPost.mock.calls[0][1]).toEqual({
    report: {
      title: 'Note',
      date: '2026-10-30',
      blocks: [{ id: 'b1', type: 'callout', text: 'Plain note.', tone: 'plain' }],
    },
    calls: [],
    cards: {},
    show_author: false,
    listed: true,
    origin: 'builder',
  });
});

const listedDraft = async () => {
  await openBuilder();
  add('paragraph');
  type(within(block(1)).getByLabelText('Text'), 'Words.');
  const dialog = openPublish();
  type(within(dialog).getByLabelText('Title'), 'Listed');
  fireEvent.click(within(dialog).getByLabelText('List in Research'));
  fireEvent.click(within(dialog).getByRole('button', { name: 'Publish' }));
  return dialog;
};

test('listing without a handle asks for one, then publishes listed', async () => {
  mockPost
    .mockRejectedValueOnce({ response: { status: 409, data: { error: 'handle_required' } } })
    .mockResolvedValueOnce({ data: { report: { id: 'n3wr3p0rt1' } } });
  mockPut
    .mockRejectedValueOnce({ response: { status: 409, data: { error: 'handle_taken' } } })
    .mockResolvedValueOnce({ data: { handle: 'bighat' } });
  const dialog = await listedDraft();

  const handle = await within(dialog).findByLabelText('Choose your public handle');
  type(handle, '@BigHat');
  fireEvent.click(within(dialog).getByRole('button', { name: 'Save and publish' }));
  expect(await within(dialog).findByRole('alert')).toHaveTextContent(
    'That handle is taken. Try another.',
  );
  fireEvent.click(within(dialog).getByRole('button', { name: 'Save and publish' }));

  await screen.findByRole('heading', { level: 1, name: 'Bane without Banchero' });
  expect(mockPut.mock.calls.map(([url, body]) => [url, body])).toEqual([
    [`${API}/api/user/public-handle`, { handle: 'bighat' }],
    [`${API}/api/user/public-handle`, { handle: 'bighat' }],
  ]);
  expect(mockPost.mock.calls.map(([, body]) => body.listed)).toEqual([true, true]);
});

test('past the listing cap the dialog says so and keeps the draft', async () => {
  mockPost.mockRejectedValue({ response: { status: 429, data: { error: 'listed_limit' } } });
  const dialog = await listedDraft();
  expect(await within(dialog).findByRole('alert')).toHaveTextContent(
    'You have listed 5 reports in the last 24 hours. Try again later.',
  );
  expect(within(dialog).getByRole('button', { name: 'Publish' })).toBeEnabled();
  fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(within(block(1)).getByLabelText('Text')).toHaveValue('Words.');
  expect(JSON.parse(window.localStorage.getItem(DRAFT_KEY)).title).toBe('Listed');
});

const headingDraft = async () => {
  await openBuilder();
  add('heading');
  type(within(block(1)).getByLabelText('Heading'), 'H');
  const opener = screen.getByRole('button', { name: 'Publish…' });
  opener.focus();
  return { opener, dialog: openPublish() };
};

test('Escape closes the publish dialog and returns focus to its opener', async () => {
  const { opener } = await headingDraft();
  expect(screen.getByLabelText('Title')).toHaveFocus();
  fireEvent.keyDown(screen.getByLabelText('Title'), { key: 'Escape' });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(opener).toHaveFocus();
});

test('Escape while publishing keeps the dialog open, and no second publish starts', async () => {
  let finish;
  mockPost.mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  const { dialog } = await headingDraft();
  type(within(dialog).getByLabelText('Title'), 'Once');
  fireEvent.click(within(dialog).getByRole('button', { name: 'Publish' }));
  fireEvent.keyDown(within(dialog).getByRole('button', { name: 'Publishing…' }), {
    key: 'Escape',
  });
  fireEvent.click(screen.getByRole('button', { name: 'Publish…' }));
  const again = screen.getByRole('dialog', { name: 'Publish your report' });
  type(within(again).getByLabelText('Title'), 'Once');
  fireEvent.submit(within(again).getByLabelText('Title').closest('form'));
  expect(within(again).getByRole('button', { name: 'Cancel' })).toBeDisabled();

  await act(async () => finish({ data: { report: { id: 'n3wr3p0rt1' } } }));
  await screen.findByRole('heading', { level: 1, name: 'Bane without Banchero' });
  expect(mockPost.mock.calls.map(([url, body]) => [url, body.report.title])).toEqual([
    [`${API}/api/user/reports`, 'Once'],
  ]);
});

test('Tab and Shift+Tab cycle inside the publish dialog', async () => {
  const { dialog } = await headingDraft();
  const title = within(dialog).getByLabelText('Title');
  type(title, 'Kept inside');
  const publish = within(dialog).getByRole('button', { name: 'Publish' });
  publish.focus();
  userEvent.tab();
  expect(title).toHaveFocus();
  userEvent.tab({ shift: true });
  expect(publish).toHaveFocus();
});
