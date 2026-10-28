import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { StrictMode } from 'react';
import userEvent from '@testing-library/user-event';
import App from '../App';
import { decodeReport } from '../reportsApi';

/*
 * Report edits (crf04/statsplus#377): the author's Notes and the "Edited"
 * marker every reader sees, and the author's Edit mode, which saves the whole
 * edit with one PUT and shows the report the server returns.
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

const ID = 'k3x9q2mtzr';
const TITLE = 'Injury brief · Sunday, October 25';
const EDITS_URL = `http://127.0.0.1:8000/api/user/reports/${ID}/edits`;

const calls = [
  {
    id: 'bane-pts',
    tool: 'query_game_logs',
    card: 'game-logs',
    structured: {
      player: { name: 'Desmond Bane' },
      chart_stat: 'PTS',
      applied: { without: [{ name: 'Paolo Banchero' }] },
    },
  },
  { id: 'orl-onoff', tool: 'get_on_off', card: 'on-off', structured: { team: 'ORL' } },
  {
    id: 'bane-matchup',
    tool: 'get_matchup',
    card: 'matchup',
    structured: { player: { name: 'Desmond Bane' } },
  },
];
const cards = {
  'game-logs': '<p>game logs card</p>',
  'on-off': '<p>on/off card</p>',
  matchup: '<p>matchup card</p>',
};

const games = {
  title: 'ORL @ NYK',
  subtitle: 'Out: Paolo Banchero',
  body: ['Banchero leaves 16 FGA.'],
  cards: ['orl-onoff', 'bane-pts'],
};
const bane = {
  title: 'Desmond Bane o18.5 PTS',
  tag: 'lean',
  key: '23.1 PTS without Banchero',
  body: ['The usage case.'],
  cards: ['bane-pts', 'orl-onoff', 'bane-matchup'],
};
const isaac = { title: 'Jonathan Isaac (ORL)', key: 'Long absence.', cards: ['orl-onoff'] };

// The report as published.
const published = (title = TITLE) => ({
  title,
  date: '2026-10-25',
  opening: ['Banchero is out for weeks.', 'Splits are from last season.'],
  tabs: [
    { title: 'Games', layout: 'tiles', items: [games] },
    { title: 'Spots', layout: 'rows', items: [bane, isaac] },
  ],
});

// GET /api/reports/<id> as its author reads it: `document` with edits applied, plus the originals.
const payload = (overrides = {}) => ({
  report: {
    id: ID,
    created_at: '2026-10-25T22:30:00Z',
    author: null,
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

const signIn = () => Object.assign(mockAuth, { currentUser: { uid: 'u1' }, isAuthenticated: true });

let view;
const open = async (data, title = TITLE) => {
  mockGet.mockResolvedValue({ data });
  window.history.pushState({}, '', `/reports/${ID}`);
  view = render(<App />);
  return screen.findByRole('heading', { level: 1, name: title });
};

const startEditing = async (data) => {
  signIn();
  await open(data);
  fireEvent.click(screen.getByRole('button', { name: 'Edit report' }));
  return screen.getByRole('form', { name: 'Edit report' });
};

const item = (name) => screen.getByRole('region', { name });
// An item's cards in Edit mode, top to bottom: kept ones first, then the removed ones.
const cardOrder = (name) =>
  within(within(item(name)).getByRole('list', { name: `Cards in ${name}` }))
    .getAllByRole('listitem')
    .map((row) => row.querySelector('.report-edit-card-label').textContent);
const press = (name, within_ = 'Desmond Bane o18.5 PTS') =>
  fireEvent.click(within(item(within_)).getByRole('button', { name }));
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
const refused = (error) => Promise.reject({ response: { status: 400, data: { error } } });

beforeEach(() => {
  mockGet.mockReset();
  mockPut.mockReset();
});

afterEach(() => {
  Object.assign(mockAuth, { currentUser: null, isAuthenticated: false });
});

describe('Notes and the Edited marker', () => {
  test('notes sit under the opening as plain paragraphs from the shown handle, with no links', async () => {
    await open(
      payload({
        listed: true,
        author: { label: '@bighatprops', handle: 'bighatprops' },
        notes: 'Bane is my favourite spot.\nSee courtai.app/research for more.\n\nFade the rest.',
      }),
    );
    const notes = screen.getByRole('region', { name: 'Notes from @bighatprops' });
    expect(
      within(notes)
        .getAllByText(/./, { selector: 'p' })
        .map((p) => p.textContent),
    ).toEqual(['Bane is my favourite spot.\nSee courtai.app/research for more.', 'Fade the rest.']);
    expect(within(notes).queryByRole('link')).not.toBeInTheDocument();
    // Under the opening, in the header.
    const opening = screen.getByText('Splits are from last season.');
    expect(opening.compareDocumentPosition(notes) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  test('notes on a report that does not show its author come from "the author"', async () => {
    await open(payload({ notes: 'My take.' }));
    expect(screen.getByRole('region', { name: 'Notes from the author' })).toHaveTextContent(
      'My take.',
    );
  });

  test('a report without notes has no Notes block', async () => {
    await open(payload());
    expect(screen.queryByText(/^Notes from/)).not.toBeInTheDocument();
  });

  test('an edited report says when it was edited; an unedited one does not', async () => {
    await open(payload({ edited_at: '2026-10-28T15:00:00Z' }));
    expect(screen.getByText('Edited', { exact: false })).toHaveTextContent(
      'Edited October 28, 2026',
    );
  });

  test('an unedited report carries no Edited marker', async () => {
    await open(payload());
    expect(screen.queryByText(/Edited/)).not.toBeInTheDocument();
  });
});

describe('Edit mode', () => {
  test('only the signed-in author is offered Edit mode', async () => {
    signIn();
    await open(authorPayload({ is_author: false }));
    expect(screen.queryByRole('button', { name: 'Edit report' })).not.toBeInTheDocument();
  });

  test('a reader who is not signed in is never offered Edit mode', async () => {
    await open(authorPayload());
    expect(screen.queryByRole('button', { name: 'Edit report' })).not.toBeInTheDocument();
  });

  test('the author renames, removes, reorders and hides, saves once, and sees the saved report', async () => {
    await startEditing(authorPayload());
    expect(cardOrder('Desmond Bane o18.5 PTS')).toEqual([
      'Bane PTS w/o Banchero',
      'ORL on/off',
      'Bane matchup',
    ]);

    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Bane night' } });
    fireEvent.change(screen.getByLabelText('Notes'), { target: { value: 'Bane or nothing.' } });
    press('Remove ORL on/off');
    press('Move Bane matchup up');
    press('Hide item ORL @ NYK', 'ORL @ NYK');

    // A removed card stays in the item, marked, ready to restore.
    expect(cardOrder('Desmond Bane o18.5 PTS')).toEqual([
      'Bane matchup',
      'Bane PTS w/o Banchero',
      'ORL on/offRemoved',
    ]);
    expect(within(item('ORL @ NYK')).getByText('Hidden')).toBeInTheDocument();

    const saved = {
      ...published('Bane night'),
      tabs: [
        { title: 'Games', layout: 'tiles', items: [] },
        {
          title: 'Spots',
          layout: 'rows',
          items: [{ ...bane, cards: ['bane-matchup', 'bane-pts'] }, isaac],
        },
      ],
    };
    mockPut.mockResolvedValue({
      data: authorPayload({
        document: saved,
        notes: 'Bane or nothing.',
        edited_at: '2026-10-28T15:00:00Z',
      }),
    });
    await save();

    expect(sentBody()).toEqual({
      title: 'Bane night',
      notes: 'Bane or nothing.',
      items: [
        { tab: 0, item: 0, hidden: true, cards: ['orl-onoff', 'bane-pts'] },
        { tab: 1, item: 0, hidden: false, cards: ['bane-matchup', 'bane-pts'] },
      ],
    });
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Bane night' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('form', { name: 'Edit report' })).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Notes from the author' })).toHaveTextContent(
      'Bane or nothing.',
    );
    expect(screen.getByText('Edited', { exact: false })).toHaveTextContent(
      'Edited October 28, 2026',
    );
    // The hidden item's tab is gone; the spot shows its cards in the saved order.
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['Spots 2']);
    fireEvent.click(screen.getByText('Desmond Bane o18.5 PTS'));
    const chips = within(await screen.findByRole('group', { name: 'Cards' })).getAllByRole(
      'button',
    );
    expect(chips.map((chip) => chip.textContent)).toEqual([
      'Bane matchup',
      'Bane PTS w/o Banchero',
    ]);
  });

  test('a move keeps the keyboard on the moved card, and an end card cannot move past the end', async () => {
    await startEditing(authorPayload());
    const spot = within(item('Desmond Bane o18.5 PTS'));
    expect(spot.getByRole('button', { name: 'Move Bane PTS w/o Banchero up' })).toBeDisabled();
    expect(spot.getByRole('button', { name: 'Move Bane matchup down' })).toBeDisabled();
    press('Move Bane matchup up');
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'Move Bane matchup up' }),
    );
    press('Move Bane matchup up');
    // Now first, so its Move up is inert and the keyboard lands on Move down.
    expect(screen.getByRole('button', { name: 'Move Bane matchup up' })).toBeDisabled();
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'Move Bane matchup down' }),
    );
  });

  test('a save shows the saved report when the app runs in StrictMode, as it does in development', async () => {
    signIn();
    mockGet.mockResolvedValue({ data: authorPayload() });
    window.history.pushState({}, '', `/reports/${ID}`);
    render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Edit report' }));
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Bane night' } });
    mockPut.mockResolvedValue({ data: authorPayload({ document: published('Bane night') }) });
    await save();
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Bane night' }),
    ).toBeInTheDocument();
  });

  test('while a save is in flight the draft cannot change, so nothing typed is lost', async () => {
    await startEditing(authorPayload());
    let finish;
    mockPut.mockImplementation(() => new Promise((resolve) => (finish = resolve)));
    await save();
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled();
    expect(screen.getByLabelText('Notes')).toBeDisabled();
    expect(screen.getByLabelText('Title')).toBeDisabled();
    expect(
      within(item('Desmond Bane o18.5 PTS')).getByRole('button', { name: 'Remove ORL on/off' }),
    ).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Hide item ORL @ NYK' })).toBeDisabled();
    await act(async () => finish({ data: authorPayload() }));
  });

  test('Move down moves a card down and sends that order', async () => {
    await startEditing(authorPayload());
    press('Move Bane PTS w/o Banchero down');
    expect(cardOrder('Desmond Bane o18.5 PTS')).toEqual([
      'ORL on/off',
      'Bane PTS w/o Banchero',
      'Bane matchup',
    ]);
    expect(document.activeElement).toBe(
      within(item('Desmond Bane o18.5 PTS')).getByRole('button', {
        name: 'Move Bane PTS w/o Banchero down',
      }),
    );
    mockPut.mockResolvedValue({ data: authorPayload() });
    await save();
    expect(sentBody()).toEqual({
      title: TITLE,
      notes: null,
      items: [{ tab: 1, item: 0, hidden: false, cards: ['orl-onoff', 'bane-pts', 'bane-matchup'] }],
    });
  });

  test('removing a card another item also shows keeps the keyboard in this item', async () => {
    await startEditing(authorPayload());
    press('Remove ORL on/off');
    expect(document.activeElement).toBe(
      within(item('Desmond Bane o18.5 PTS')).getByRole('button', { name: 'Restore ORL on/off' }),
    );
    press('Restore ORL on/off');
    expect(document.activeElement).toBe(
      within(item('Desmond Bane o18.5 PTS')).getByRole('button', { name: 'Remove ORL on/off' }),
    );
  });

  test('a save that finishes after the account changed does not bring back Edit mode', async () => {
    await startEditing(authorPayload());
    let finish;
    mockPut.mockImplementation(() => new Promise((resolve) => (finish = resolve)));
    await save();
    // Another account signs in; it reads the report as a reader.
    Object.assign(mockAuth, { currentUser: { uid: 'u2' } });
    mockGet.mockResolvedValue({ data: payload() });
    view.rerender(<App />);
    expect(await screen.findByRole('heading', { level: 1, name: TITLE })).toBeInTheDocument();
    await act(async () => finish({ data: authorPayload({ document: published('Bane night') }) }));
    expect(screen.getByRole('heading', { level: 1, name: TITLE })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit report' })).not.toBeInTheDocument();
  });

  test('the editor opens on the saved edits, and restoring sends the whole edit again', async () => {
    await startEditing(
      authorPayload({
        document: {
          ...published(),
          tabs: [
            { title: 'Games', layout: 'tiles', items: [] },
            { title: 'Spots', layout: 'rows', items: [{ ...bane, cards: ['bane-pts'] }, isaac] },
          ],
        },
        notes: 'Old notes.',
        edited_at: '2026-10-27T15:00:00Z',
        edits: {
          title: TITLE,
          notes: 'Old notes.',
          items: [
            { tab: 0, item: 0, hidden: true, cards: ['orl-onoff', 'bane-pts'] },
            { tab: 1, item: 0, hidden: false, cards: ['bane-pts'] },
          ],
        },
      }),
    );
    expect(screen.getByLabelText('Notes')).toHaveValue('Old notes.');
    expect(cardOrder('Desmond Bane o18.5 PTS')).toEqual([
      'Bane PTS w/o Banchero',
      'ORL on/offRemoved',
      'Bane matchupRemoved',
    ]);
    expect(within(item('ORL @ NYK')).getByText('Hidden')).toBeInTheDocument();

    press('Restore item ORL @ NYK', 'ORL @ NYK');
    press('Restore Bane matchup');
    mockPut.mockResolvedValue({ data: authorPayload() });
    await save();

    // The Games item is back as published, so it is no longer listed; notes stay as they were.
    expect(sentBody()).toEqual({
      title: TITLE,
      notes: 'Old notes.',
      items: [{ tab: 1, item: 0, hidden: false, cards: ['bane-pts', 'bane-matchup'] }],
    });
  });

  test('clearing the notes and undoing every change sends no notes and no items', async () => {
    await startEditing(
      authorPayload({
        notes: 'Old notes.',
        edits: {
          title: TITLE,
          notes: 'Old notes.',
          items: [{ tab: 1, item: 0, hidden: false, cards: ['orl-onoff', 'bane-pts'] }],
        },
      }),
    );
    fireEvent.change(screen.getByLabelText('Notes'), { target: { value: '   ' } });
    press('Move Bane PTS w/o Banchero up');
    press('Restore Bane matchup');
    mockPut.mockResolvedValue({ data: authorPayload() });
    await save();
    expect(sentBody()).toEqual({ title: TITLE, notes: null, items: [] });
  });

  test('Cancel leaves the report as it was and sends nothing', async () => {
    await startEditing(authorPayload());
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Bane night' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('heading', { level: 1, name: TITLE })).toBeInTheDocument();
    expect(mockPut).not.toHaveBeenCalled();
  });

  test('the title and notes count their characters against the limits', async () => {
    await startEditing(authorPayload());
    expect(screen.getByText('33/120')).toBeInTheDocument();
    // Characters as the server counts them: 60 basketballs are 120 UTF-16 units, and
    // typing more still works; 130 keep 120.
    const title = screen.getByLabelText('Title');
    fireEvent.change(title, { target: { value: '🏀'.repeat(60) } });
    await userEvent.type(title, '🏀🏀');
    expect(title).toHaveValue('🏀'.repeat(62));
    expect(screen.getByText('62/120')).toBeInTheDocument();
    fireEvent.change(title, { target: { value: '🏀'.repeat(130) } });
    expect(title).toHaveValue('🏀'.repeat(120));
    fireEvent.change(screen.getByLabelText('Notes'), { target: { value: 'x'.repeat(2001) } });
    expect(screen.getByText('2,001/2,000')).toHaveClass('is-over');
  });

  test.each([
    [
      'notes_links',
      'Notes',
      'Notes can’t contain links. Take out anything starting http://, https:// or www.',
    ],
    ['notes_too_long', 'Notes', 'Notes can be at most 2,000 characters.'],
    [
      'invalid_edits',
      null,
      'Those card changes no longer match the report. Cancel, reload and try again.',
    ],
  ])('a %s refusal shows inline and keeps the draft', async (code, field, message) => {
    await startEditing(authorPayload());
    fireEvent.change(screen.getByLabelText('Notes'), { target: { value: 'See www.x.com' } });
    mockPut.mockImplementation(() => refused(code));
    await save();
    expect(screen.getByRole('alert')).toHaveTextContent(message);
    const besideSave = within(screen.getByRole('alert').parentElement).queryByRole('button', {
      name: 'Save edits',
    });
    if (field) {
      expect(screen.getByLabelText(field)).toHaveAttribute('aria-invalid', 'true');
      expect(screen.getByLabelText(field)).toHaveAccessibleDescription(
        expect.stringContaining(message),
      );
      expect(besideSave).not.toBeInTheDocument();
    } else {
      expect(screen.getByLabelText('Notes')).toHaveAttribute('aria-invalid', 'false');
      expect(besideSave).toBeInTheDocument();
    }
    expect(screen.getByLabelText('Notes')).toHaveValue('See www.x.com');
    expect(screen.getByRole('button', { name: 'Save edits' })).toBeEnabled();
  });
});

describe('decoding', () => {
  const INVALID = 'The report endpoint returned an invalid response.';

  test('notes, edited_at, the originals and the edits decode as served', () => {
    const decoded = decodeReport(
      authorPayload({
        notes: 'My take.',
        edited_at: '2026-10-28T15:00:00Z',
        edits: {
          title: 'Renamed',
          notes: null,
          items: [{ tab: 1, item: 0, hidden: true, cards: ['bane-pts'] }],
        },
      }),
    );
    expect(decoded.notes).toBe('My take.');
    expect(decoded.editedAt).toBe('2026-10-28T15:00:00Z');
    expect(decoded.edits).toEqual({
      title: 'Renamed',
      notes: null,
      items: [{ tab: 1, item: 0, hidden: true, cards: ['bane-pts'] }],
    });
    expect(decoded.original.document.tabs[1].items[0].cards).toEqual([
      'bane-pts',
      'orl-onoff',
      'bane-matchup',
    ]);
    expect(Object.keys(decoded.original.calls)).toEqual(['bane-pts', 'orl-onoff', 'bane-matchup']);
  });

  test('empty notes are valid text, in the report and in its edits', () => {
    const decoded = decodeReport(
      authorPayload({ notes: '', edits: { title: TITLE, notes: '', items: [] } }),
    );
    expect(decoded.notes).toBe('');
    expect(decoded.edits.notes).toBe('');
  });

  test('a report from before edits reads as unedited with no notes', () => {
    const old = payload();
    delete old.report.notes;
    delete old.report.edited_at;
    expect(decodeReport(old)).toMatchObject({
      notes: null,
      editedAt: null,
      original: null,
      edits: null,
    });
  });

  test.each([
    ['notes that are not text', { notes: 42 }],
    ['an edited_at that is not a time', { edited_at: 'yesterday' }],
    ['originals without calls', { original: { document: published() } }],
    ['originals without a document', { original: { calls } }],
    ['originals that are not a record', { original: 'v1' }],
    ['edits without a title', { edits: { notes: null, items: [] } }],
    ['edits whose items are not a list', { edits: { title: 'T', notes: null, items: {} } }],
    [
      'an edited item without a hidden flag',
      { edits: { title: 'T', notes: null, items: [{ tab: 0, item: 0, cards: [] }] } },
    ],
    [
      'an edited item at a negative position',
      {
        edits: { title: 'T', notes: null, items: [{ tab: -1, item: 0, hidden: false, cards: [] }] },
      },
    ],
    [
      'an edited item whose cards are not ids',
      {
        edits: { title: 'T', notes: null, items: [{ tab: 0, item: 0, hidden: false, cards: [1] }] },
      },
    ],
    ['edits whose notes are not text', { edits: { title: 'T', notes: 7, items: [] } }],
  ])('the decoder refuses %s', (_, overrides) => {
    expect(() => decodeReport(authorPayload(overrides))).toThrow(INVALID);
  });
});
