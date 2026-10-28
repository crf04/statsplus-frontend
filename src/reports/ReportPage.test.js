import { act, fireEvent, render, screen, within } from '@testing-library/react';
import App from '../App';
import { decodeReport } from '../reportsApi';
import { themeStore } from '../theme/useTheme';
import { fitScale } from './ReportCard';
import { cardLabel } from './ReportPage';

const mockAuth = {
  currentUser: null,
  loading: false,
  error: null,
  signInWithGoogle: jest.fn(),
  logout: jest.fn(),
  getToken: jest.fn(),
  isAuthenticated: false,
  isAdmin: false,
};
jest.mock('../contexts/AuthContext', () => ({
  AuthProvider: ({ children }) => children,
  useAuth: () => mockAuth,
}));

const mockGet = jest.fn();
const mockDelete = jest.fn();
jest.mock('../utils/axiosConfig', () => ({
  __esModule: true,
  default: { get: (...args) => mockGet(...args), delete: (...args) => mockDelete(...args) },
}));

const logsCall = {
  id: 'bane-pts',
  tool: 'query_game_logs',
  card: 'game-logs',
  structured: {
    player: { name: 'Desmond Bane' },
    chart_stat: 'PTS',
    applied: { without: [{ name: 'Paolo Banchero' }] },
  },
  meta: { 'courtai/game_logs': { rows: 10 } },
};
const onOffCall = {
  id: 'orl-onoff',
  tool: 'get_on_off',
  card: 'on-off',
  structured: { team: 'ORL' },
};

const payload = (overrides = {}) => ({
  report: {
    id: 'k3x9q2mtzr',
    created_at: '2026-10-25T22:30:00Z',
    author: { label: '@bighatprops' },
    is_author: false,
    listed: false,
    featured: false,
    calls: [logsCall, onOffCall],
    cards: { 'game-logs': '<p>game logs card</p>', 'on-off': '<p>on/off card</p>' },
    document: {
      title: 'Injury brief · Sunday, October 25',
      date: '2026-10-25',
      opening: ['Banchero is out for weeks.', 'Splits are from last season.'],
      skill: { name: 'Injury brief', url: 'https://courtai.app/skills/injury-brief' },
      tabs: [
        {
          title: 'Games',
          layout: 'tiles',
          items: [
            {
              title: 'ORL @ NYK',
              subtitle: 'Out: Paolo Banchero',
              bullets: [['Desmond Bane', 'Usage 21.2% → 26.4% with Banchero off']],
              body: ['Banchero leaves 16 FGA.'],
              cards: ['orl-onoff', 'ghost'],
            },
          ],
        },
        {
          title: 'Spots',
          layout: 'rows',
          items: [
            {
              title: 'Desmond Bane o18.5 PTS',
              tag: 'lean',
              bullets: [['Usage', '21.2% → 26.4%']],
              key: '23.1 PTS without Banchero',
              body: ['The usage case.'],
              watch: 'Black returning.',
              cards: ['bane-pts', 'orl-onoff'],
              sources: [
                ['Banchero out', 'https://www.espn.com/x'],
                ['Bad link', 'javascript:alert(1)'],
              ],
            },
          ],
        },
        {
          title: 'Set aside',
          layout: 'list',
          items: [
            { title: 'Noah Penda (ORL)', key: 'Bench.' },
            {
              title: 'Jonathan Isaac (ORL)',
              key: 'Long absence.',
              body: ['Out since the preseason.'],
              cards: ['orl-onoff'],
              sources: [['Isaac out', 'https://www.espn.com/isaac']],
            },
          ],
        },
      ],
    },
    ...overrides,
  },
});

const open = async (data = payload()) => {
  mockGet.mockResolvedValue({ data });
  window.history.pushState({}, '', '/reports/k3x9q2mtzr');
  render(<App />);
  return screen.findByRole('heading', { level: 1, name: 'Injury brief · Sunday, October 25' });
};

beforeEach(() => {
  mockGet.mockReset();
  mockDelete.mockReset();
});

afterEach(() => {
  Object.assign(mockAuth, { currentUser: null, isAuthenticated: false });
  jest.restoreAllMocks();
  act(() => themeStore.setPreference('system'));
});

const PUBLISHED = Date.parse('2026-10-25T22:30:00Z');
const DAY = 24 * 60 * 60 * 1000;

test('a report opens on its first tab and names its author and day', async () => {
  await open();
  expect(mockGet).toHaveBeenCalledWith(
    'http://127.0.0.1:8000/api/reports/k3x9q2mtzr',
    expect.anything(),
  );
  expect(screen.getByText('Sunday, October 25, 2026 · by @bighatprops')).toBeInTheDocument();
  expect(screen.getByRole('tab', { name: /^Games/ })).toHaveAttribute('aria-selected', 'true');
  expect(screen.getByText('Desmond Bane')).toBeInTheDocument();
});

test('an opened tile shows its read and only the cards the report can draw', async () => {
  await open();
  fireEvent.click(screen.getByText('The read and cards'));
  const frame = await screen.findByTitle('ORL on/off');
  expect(frame).toHaveAttribute('sandbox', 'allow-scripts');
  expect(frame).toHaveAttribute('srcdoc', '<p>on/off card</p>');
  // 'ghost' names no stored call, so there is one card and no chips.
  expect(screen.queryByRole('group', { name: 'Cards' })).not.toBeInTheDocument();
});

test('a spot row opens into its story, its watch, its web sources and its cards behind chips', async () => {
  await open();
  fireEvent.click(screen.getByRole('tab', { name: /^Spots/ }));
  fireEvent.click(screen.getByText('Desmond Bane o18.5 PTS'));
  expect(await screen.findByText('The usage case.')).toBeInTheDocument();
  expect(screen.getByText('Black returning.')).toBeInTheDocument();
  expect(screen.getByText('· 21.2% → 26.4%', { exact: false })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Banchero out' })).toHaveAttribute(
    'href',
    'https://www.espn.com/x',
  );
  expect(screen.queryByRole('link', { name: 'Bad link' })).not.toBeInTheDocument();
  const chips = within(screen.getByRole('group', { name: 'Cards' })).getAllByRole('button');
  expect(chips.map((chip) => chip.textContent)).toEqual(['Bane PTS w/o Banchero', 'ORL on/off']);
  expect(screen.getByTitle('Bane PTS w/o Banchero')).toHaveAttribute(
    'srcdoc',
    '<p>game logs card</p>',
  );
  fireEvent.click(chips[1]);
  expect(screen.getByTitle('ORL on/off')).toBeInTheDocument();
  expect(screen.queryByTitle('Bane PTS w/o Banchero')).not.toBeInTheDocument();
});

test('a card gets the stored tool result over the host messages', async () => {
  await open();
  fireEvent.click(screen.getByRole('tab', { name: /^Spots/ }));
  fireEvent.click(screen.getByText('Desmond Bane o18.5 PTS'));
  const frame = await screen.findByTitle('Bane PTS w/o Banchero');
  const posted = jest.spyOn(frame.contentWindow, 'postMessage');
  window.dispatchEvent(
    new MessageEvent('message', {
      source: frame.contentWindow,
      data: { jsonrpc: '2.0', method: 'ui/notifications/initialized' },
    }),
  );
  expect(posted).toHaveBeenCalledWith(
    {
      jsonrpc: '2.0',
      method: 'ui/notifications/tool-result',
      params: { structuredContent: logsCall.structured, _meta: logsCall.meta },
    },
    '*',
  );
});

test('a list item with more than a line opens like a row, its card and sources included', async () => {
  await open();
  fireEvent.click(screen.getByRole('tab', { name: /^Set aside/ }));
  expect(screen.getByText('Noah Penda (ORL)')).toBeInTheDocument();
  fireEvent.click(screen.getByText('Jonathan Isaac (ORL)'));
  expect(await screen.findByText('Out since the preseason.')).toBeInTheDocument();
  expect(screen.getByTitle('ORL on/off')).toHaveAttribute('srcdoc', '<p>on/off card</p>');
  expect(screen.getByRole('link', { name: 'Isaac out' })).toHaveAttribute(
    'href',
    'https://www.espn.com/isaac',
  );
});

test('a message from any window but its own card is ignored', async () => {
  await open();
  fireEvent.click(screen.getByRole('tab', { name: /^Spots/ }));
  fireEvent.click(screen.getByText('Desmond Bane o18.5 PTS'));
  const frame = await screen.findByTitle('Bane PTS w/o Banchero');
  const posted = jest.spyOn(frame.contentWindow, 'postMessage');
  window.dispatchEvent(
    new MessageEvent('message', {
      source: window,
      data: { jsonrpc: '2.0', method: 'ui/notifications/initialized' },
    }),
  );
  expect(posted).not.toHaveBeenCalled();
});

test('a tile whose only detail is what to watch still shows it', async () => {
  const data = payload();
  data.report.document.tabs[0].items.push({
    title: 'LAL @ UTA',
    watch: 'Wait for the minutes restriction to clear.',
  });
  await open(data);
  fireEvent.click(screen.getAllByText('The read')[0]);
  expect(screen.getByText('Wait for the minutes restriction to clear.')).toBeInTheDocument();
});

test('text written as HTML shows as text and never becomes markup', async () => {
  const data = payload();
  data.report.document.title = '<img src=x onerror=alert(1)> Injury brief';
  mockGet.mockResolvedValue({ data });
  window.history.pushState({}, '', '/reports/k3x9q2mtzr');
  render(<App />);
  const heading = await screen.findByRole('heading', { level: 1 });
  expect(heading).toHaveTextContent('<img src=x onerror=alert(1)> Injury brief');
  expect(document.querySelector('main img')).toBeNull();
});

test('the footer links the skill, and only the author can delete', async () => {
  await open();
  expect(screen.getByRole('link', { name: 'Make your own →' })).toHaveAttribute(
    'href',
    'https://courtai.app/skills/injury-brief',
  );
  expect(screen.queryByRole('button', { name: 'Delete this report' })).not.toBeInTheDocument();
});

test('the author deletes the report after confirming', async () => {
  Object.assign(mockAuth, { currentUser: { uid: 'u1' }, isAuthenticated: true });
  jest.spyOn(window, 'confirm').mockReturnValue(true);
  mockDelete.mockResolvedValue({ data: { success: true } });
  await open(payload({ is_author: true }));
  fireEvent.click(screen.getByRole('button', { name: 'Delete this report' }));
  expect(await screen.findByRole('heading', { name: 'Report deleted' })).toBeInTheDocument();
  expect(mockDelete).toHaveBeenCalledWith('http://127.0.0.1:8000/api/user/reports/k3x9q2mtzr');
});

test('a missing report says it is not available', async () => {
  mockGet.mockRejectedValue({ response: { status: 404 } });
  window.history.pushState({}, '', '/reports/zzzzzzzzzz');
  render(<App />);
  expect(
    await screen.findByRole('heading', { name: "This report isn't available" }),
  ).toBeInTheDocument();
});

test('the decoder refuses an unknown grade and keeps only courtai.app skill links', () => {
  const bad = payload();
  bad.report.document.tabs[1].items[0].tag = 'lock';
  expect(() => decodeReport(bad)).toThrow('The report endpoint returned an invalid response.');
  const offsite = payload();
  offsite.report.document.skill.url = 'https://evil.example/skill';
  expect(decodeReport(offsite).document.skill.url).toBeNull();
});

test('chips name a card by whose it is and what it shows', () => {
  expect(cardLabel(logsCall)).toBe('Bane PTS w/o Banchero');
  expect(
    cardLabel({
      ...logsCall,
      structured: { ...logsCall.structured, applied: { minutes: { low: 26, high: 48 } } },
    }),
  ).toBe('Bane PTS 26+ min');
  expect(cardLabel(onOffCall)).toBe('ORL on/off');
});

test('a card taller than the window shrinks to fit on wide screens, never below 70%, and not on phones', () => {
  expect(fitScale(954, { innerWidth: 1320, innerHeight: 900 })).toBeCloseTo(780 / 954);
  expect(fitScale(3000, { innerWidth: 1320, innerHeight: 900 })).toBe(0.7);
  expect(fitScale(500, { innerWidth: 1320, innerHeight: 900 })).toBe(1);
  expect(fitScale(954, { innerWidth: 390, innerHeight: 844 })).toBe(1);
});

test('a listed report says who shared it and whose view it is, linking their author page', async () => {
  await open(payload({ listed: true, author: { label: '@bighatprops', handle: 'bighatprops' } }));
  const shared = screen.getByText(/^Shared by/);
  expect(shared).toHaveTextContent(
    "Shared by @bighatprops. CourtAI reports facts; this is the author's view.",
  );
  expect(within(shared).getByRole('link', { name: '@bighatprops' })).toHaveAttribute(
    'href',
    '/research/@bighatprops',
  );
});

test('an unlisted report has no author footer', async () => {
  await open();
  expect(screen.queryByText(/^Shared by/)).not.toBeInTheDocument();
});

test('a report shows when it was published and its data age, with no badge at exactly three days', async () => {
  jest.spyOn(Date, 'now').mockReturnValue(PUBLISHED + 3 * DAY);
  await open();
  expect(
    screen.getByText('Published October 25, 2026, data as of 6:30 PM EDT'),
  ).toBeInTheDocument();
  expect(screen.queryByText(/days old$/)).not.toBeInTheDocument();
});

test('a report more than three days old carries a badge with its age', async () => {
  jest.spyOn(Date, 'now').mockReturnValue(PUBLISHED + 3 * DAY + 60 * 1000);
  await open();
  expect(screen.getByText('3 days old')).toBeInTheDocument();
});

test('a report its author deleted says so and leads to more research and sign-up', async () => {
  mockGet.mockRejectedValue({
    response: { status: 410, data: { error: 'removed', by: 'author' } },
  });
  window.history.pushState({}, '', '/reports/k3x9q2mtzr');
  render(<App />);
  expect(
    await screen.findByRole('heading', { level: 1, name: 'This report was removed by its author' }),
  ).toBeInTheDocument();
  expect(
    screen.getByText('Its author deleted it, so the link no longer opens it.'),
  ).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Browse more research →' })).toHaveAttribute(
    'href',
    '/research',
  );
  expect(screen.getByRole('complementary', { name: 'Sign up' })).toBeInTheDocument();
});

test('a report taken down says CourtAI removed it, not its author', async () => {
  mockGet.mockRejectedValue({
    response: { status: 410, data: { error: 'removed', by: 'takedown' } },
  });
  window.history.pushState({}, '', '/reports/k3x9q2mtzr');
  render(<App />);
  expect(
    await screen.findByRole('heading', { level: 1, name: 'This report was taken down' }),
  ).toBeInTheDocument();
  expect(
    screen.getByText('CourtAI removed it, so the link no longer opens it.'),
  ).toBeInTheDocument();
  expect(screen.queryByText(/removed by its author/)).not.toBeInTheDocument();
});

test('signed out, a report ends in a sign-up prompt to run the same research', async () => {
  await open();
  const prompt = screen.getByRole('complementary', { name: 'Sign up' });
  expect(
    within(prompt).getByRole('heading', { name: 'Run the same research on any player' }),
  ).toBeInTheDocument();
});

const initialize = (frame) => {
  const posted = jest.spyOn(frame.contentWindow, 'postMessage');
  window.dispatchEvent(
    new MessageEvent('message', {
      source: frame.contentWindow,
      data: { jsonrpc: '2.0', id: 1, method: 'ui/initialize' },
    }),
  );
  window.dispatchEvent(
    new MessageEvent('message', {
      source: frame.contentWindow,
      data: { jsonrpc: '2.0', method: 'ui/notifications/initialized' },
    }),
  );
  return posted;
};

test("a card takes the app's theme, and repaints when the theme changes", async () => {
  act(() => themeStore.setPreference('light'));
  await open();
  fireEvent.click(screen.getByText('The read and cards'));
  const frame = await screen.findByTitle('ORL on/off');
  expect(frame.parentElement).toHaveAttribute('data-theme', 'light');
  const posted = initialize(frame);
  const greeting = posted.mock.calls[0][0];
  expect(greeting.result.hostContext.theme).toBe('light');
  expect(greeting.result.hostContext.styles.variables['--color-text-primary']).toBe('#15181d');

  act(() => themeStore.setPreference('dark'));
  expect(frame.parentElement).toHaveAttribute('data-theme', 'dark');
  expect(posted).toHaveBeenLastCalledWith(
    expect.objectContaining({
      method: 'ui/notifications/host-context-changed',
      params: expect.objectContaining({ theme: 'dark' }),
    }),
    '*',
  );
  expect(posted.mock.calls.at(-1)[0].params.styles.variables['--color-text-primary']).toBe(
    '#faf9f5',
  );
});

test('the decoder refuses a report without its listing state, or listed without a handle', () => {
  const unknown = payload();
  delete unknown.report.listed;
  expect(() => decodeReport(unknown)).toThrow('The report endpoint returned an invalid response.');
  const anonymous = payload({ listed: true, author: { label: '@bighatprops' } });
  expect(() => decodeReport(anonymous)).toThrow(
    'The report endpoint returned an invalid response.',
  );
  const shared = payload({ listed: true, featured: true, author: { handle: 'bighatprops' } });
  expect(decodeReport(shared)).toMatchObject({
    listed: true,
    featured: true,
    authorHandle: 'bighatprops',
  });
});
