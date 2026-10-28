import { fireEvent, render, screen, within } from '@testing-library/react';
import App from '../App';
import { decodeResearchPage } from '../reportsApi';
import { entry, researchPage } from './researchFixtures';

jest.mock('../contexts/AuthContext', () => ({
  AuthProvider: ({ children }) => children,
  useAuth: () => ({
    currentUser: null,
    loading: false,
    error: null,
    signInWithGoogle: jest.fn(),
    logout: jest.fn(),
    getToken: jest.fn(),
    isAuthenticated: false,
    isAdmin: false,
  }),
}));

const mockGet = jest.fn();
jest.mock('../utils/axiosConfig', () => ({
  __esModule: true,
  default: { get: (...args) => mockGet(...args) },
}));

const API = 'http://127.0.0.1:8000';
const notFound = () => Promise.reject({ response: { status: 404 } });

// Answers the feed and author routes from `routes`, keyed by path and cursor.
const serve = (routes) =>
  mockGet.mockImplementation((url, options) => {
    const path = url.replace(API, '');
    const key = options?.params?.cursor ? `${path}?cursor=${options.params.cursor}` : path;
    return key in routes ? Promise.resolve({ data: routes[key] }) : notFound();
  });

const open = (path) => {
  window.history.pushState({}, '', path);
  render(<App />);
};

const titles = (list) =>
  within(list)
    .getAllByRole('heading', { level: 3 })
    .map((heading) => heading.textContent);

beforeEach(() => {
  mockGet.mockReset();
});

test('the feed pins Featured above the latest, and each entry names its author, day and covers', async () => {
  serve({
    '/api/research': researchPage({
      featured: [entry('feat00001', { title: 'Pinned brief' })],
      reports: [
        entry('late00001', {
          title: 'Pistons at Hornets',
          author: { handle: 'courtwatch' },
          covers: {
            games: ['DET @ CHA', 'ORL @ NYK'],
            players: [
              'Cade Cunningham',
              'LaMelo Ball',
              'Desmond Bane',
              'Jalen Brunson',
              'Ausar Thompson',
            ],
          },
        }),
      ],
    }),
  });
  open('/research');

  const featured = await screen.findByRole('list', { name: 'Featured reports' });
  const latest = screen.getByRole('list', { name: 'Latest reports' });
  expect(featured.compareDocumentPosition(latest) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(titles(featured)).toEqual(['Pinned brief']);
  expect(titles(latest)).toEqual(['Pistons at Hornets']);

  const card = within(latest).getByRole('article');
  expect(within(card).getByRole('link', { name: 'Pistons at Hornets' })).toHaveAttribute(
    'href',
    '/reports/late00001',
  );
  expect(within(card).getByRole('link', { name: '@courtwatch' })).toHaveAttribute(
    'href',
    '/research/@courtwatch',
  );
  expect(within(card).getByText('Oct 27, 2026')).toBeInTheDocument();
  expect(
    within(within(card).getByRole('list', { name: 'Games' }))
      .getAllByRole('listitem')
      .map((item) => item.textContent),
  ).toEqual(['DET @ CHA', 'ORL @ NYK']);
  expect(
    within(card).getByText('Cade Cunningham, LaMelo Ball, Desmond Bane, Jalen Brunson +1 more'),
  ).toBeInTheDocument();
  expect(card.querySelector('img')).toHaveAttribute(
    'src',
    'http://127.0.0.1:8000/api/reports/late00001/preview.png',
  );
});

test('Load more asks for the next cursor and appends that page', async () => {
  serve({
    '/api/research': researchPage({ reports: [entry('first0001')], next_cursor: 'c-2' }),
    '/api/research?cursor=c-2': researchPage({ reports: [entry('second001')] }),
  });
  open('/research');

  const latest = await screen.findByRole('list', { name: 'Latest reports' });
  expect(titles(latest)).toEqual(['Report first0001']);
  fireEvent.click(screen.getByRole('button', { name: 'Load more' }));
  expect(await screen.findByRole('heading', { name: 'Report second001' })).toBeInTheDocument();
  expect(titles(latest)).toEqual(['Report first0001', 'Report second001']);
  // The last page has no cursor, so there is nothing more to load.
  expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument();
});

test("an author's page lists only that author's reports", async () => {
  serve({
    '/api/research/authors/courtwatch': researchPage({
      reports: [entry('cw0000001', { author: { handle: 'courtwatch' } })],
    }),
  });
  open('/research/@CourtWatch');

  expect(await screen.findByRole('heading', { level: 1, name: '@courtwatch' })).toBeInTheDocument();
  expect(titles(await screen.findByRole('list', { name: 'Reports by @courtwatch' }))).toEqual([
    'Report cw0000001',
  ]);
  expect(screen.queryByRole('list', { name: 'Featured reports' })).not.toBeInTheDocument();
});

test('an author with nothing listed says so', async () => {
  serve({ '/api/research/authors/quietone': researchPage() });
  open('/research/@quietone');
  expect(await screen.findByText("@quietone hasn't listed any reports yet.")).toBeInTheDocument();
});

test('an unknown handle says nobody goes by it', async () => {
  serve({});
  open('/research/@nobody_here');
  expect(
    await screen.findByRole('heading', { name: 'No author goes by @nobody_here' }),
  ).toBeInTheDocument();
});

test('signed out, the feed ends in a sign-up prompt', async () => {
  serve({ '/api/research': researchPage({ reports: [entry('first0001')] }) });
  open('/research');
  const prompt = await screen.findByRole('complementary', { name: 'Sign up' });
  expect(
    within(prompt).getByRole('heading', { name: 'Run the same research on any player' }),
  ).toBeInTheDocument();
  expect(within(prompt).getByRole('button', { name: /Sign up free/ })).toBeInTheDocument();
});

test('the nav links Research only once something is listed', async () => {
  serve({ '/api/research': researchPage({ reports: [entry('first0001')] }) });
  open('/privacy');
  const nav = screen.getByRole('navigation', { name: 'Primary' });
  expect(await within(nav).findByRole('link', { name: 'Research' })).toHaveAttribute(
    'href',
    '/research',
  );
});

test('the nav has no Research link while nothing is listed', async () => {
  serve({ '/api/research': researchPage() });
  open('/privacy');
  await screen.findByRole('heading', { level: 1 });
  // Let the feed request settle before checking the link stays away.
  await screen.findByRole('navigation', { name: 'Primary' });
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(mockGet).toHaveBeenCalledWith(`${API}/api/research`, expect.anything());
  expect(
    within(screen.getByRole('navigation', { name: 'Primary' })).queryByRole('link', {
      name: 'Research',
    }),
  ).not.toBeInTheDocument();
});

describe('the feed decoder', () => {
  const good = () => researchPage({ reports: [entry('first0001')], next_cursor: 'c-2' });
  const refuses = (payload) =>
    expect(() => decodeResearchPage(payload)).toThrow(
      'The research endpoint returned an invalid response.',
    );

  test('reads a page into entries and a cursor', () => {
    expect(decodeResearchPage(good())).toEqual({
      featured: [],
      reports: [
        {
          id: 'first0001',
          title: 'Report first0001',
          listedAt: '2026-10-27T18:00:00Z',
          createdAt: '2026-10-27T17:00:00Z',
          date: '2026-10-27',
          handle: 'bighatprops',
          games: ['DET @ CHA'],
          players: ['Cade Cunningham', 'LaMelo Ball'],
          previewUrl: '/api/reports/first0001/preview.png',
        },
      ],
      nextCursor: 'c-2',
    });
  });

  test.each([
    ['no featured list', (page) => delete page.featured],
    ['reports that are not a list', (page) => (page.reports = {})],
    ['a missing cursor', (page) => delete page.next_cursor],
    ['an empty cursor', (page) => (page.next_cursor = '')],
    ['an entry without an author handle', (page) => (page.reports[0].author = {})],
    ['covers without players', (page) => delete page.reports[0].covers.players],
    ['a game that is not a string', (page) => (page.reports[0].covers.games = [7])],
    ['an unreadable listed_at', (page) => (page.reports[0].listed_at = 'yesterday')],
    ['no preview image', (page) => delete page.reports[0].preview_url],
    ['a title that is not a string', (page) => (page.reports[0].title = 12)],
  ])('refuses %s', (_name, spoil) => {
    const page = good();
    spoil(page);
    refuses(page);
  });
});
