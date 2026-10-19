import { render, screen, waitFor, within } from '@testing-library/react';
import App from './App';
import config, { getApiUrl } from './config';
import apiClient from './utils/axiosConfig';
import { homeGet } from './home/publicHomeFixtures';

const mockAuth = {
  currentUser: null,
  loading: false,
  error: null,
  signInWithGoogle: jest.fn(),
  logout: jest.fn(),
  getToken: jest.fn(),
  isAuthenticated: false,
  waitlist: null,
};

jest.mock('./contexts/AuthContext', () => ({
  AuthProvider: ({ children }) => children,
  useAuth: () => mockAuth,
}));

jest.mock('./utils/axiosConfig', () => ({
  __esModule: true,
  default: {
    get: jest.fn(() => Promise.resolve({ data: [] })),
    post: () => Promise.resolve({ data: {} }),
  },
}));

beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  console.log.mockRestore();
  apiClient.get.mockImplementation(() => Promise.resolve({ data: [] }));
  apiClient.get.mockClear();
  Object.assign(mockAuth, { currentUser: null, isAuthenticated: false, waitlist: null });
});

test('a waitlisted user sees the public home page under a waitlist banner', async () => {
  apiClient.get.mockImplementation(homeGet);
  Object.assign(mockAuth, {
    currentUser: { uid: 'waiting', email: 'fan@example.com' },
    isAuthenticated: true,
    waitlist: { message: 'The beta is full right now.' },
  });
  render(<App />);

  expect(await screen.findByRole('heading', { name: "You're on the waitlist" })).toBeVisible();
  expect(screen.getByText('The beta is full right now.')).toBeInTheDocument();
  expect(screen.getByText('fan@example.com')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Sign out' })).toBeEnabled();
  expect(screen.getByRole('navigation', { name: 'Primary' })).toBeInTheDocument();
  expect(await screen.findByRole('navigation', { name: "Today's games" })).toBeInTheDocument();
  await waitFor(() =>
    expect(screen.getByRole('button', { name: /start with a player/i })).toHaveTextContent('22.4'),
  );
  expect(screen.getByRole('article', { name: 'Best: Jaime Jaquez Jr.' })).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'Your Targets' })).not.toBeInTheDocument();
  expect(screen.getByRole('textbox')).toBeDisabled();
  // Only the anonymous reads: every other route would be refused as waitlisted.
  expect(apiClient.get.mock.calls.map(([url]) => new URL(url).pathname).sort()).toEqual([
    '/api/games/ladder',
    '/api/games/slate',
    '/api/games/slate/edges',
  ]);
});

test('a waitlisted user is sent back to the home page from any other path', async () => {
  apiClient.get.mockImplementation(homeGet);
  Object.assign(mockAuth, {
    currentUser: { uid: 'waiting', email: 'fan@example.com' },
    isAuthenticated: true,
    waitlist: { message: 'The beta is full right now.' },
  });
  window.history.pushState({}, '', '/targets');
  render(<App />);

  expect(await screen.findByRole('heading', { name: 'Ask the box score' })).toBeVisible();
  expect(window.location.pathname).toBe('/');
  window.history.pushState({}, '', '/');
});

test('a signed-out visitor sees the public home page with a sign-up card, and no Targets request', async () => {
  apiClient.get.mockImplementation(homeGet);
  render(<App />);

  expect(await screen.findByRole('navigation', { name: "Today's games" })).toBeInTheDocument();
  await waitFor(() =>
    expect(screen.getByRole('button', { name: /start with a player/i })).toHaveTextContent('22.4'),
  );
  expect(screen.getByRole('article', { name: 'Best: Jaime Jaquez Jr.' })).toBeInTheDocument();
  expect(
    within(screen.getByRole('region', { name: 'Your Targets' })).getByRole('button', {
      name: 'Sign up free',
    }),
  ).toBeEnabled();
  expect(screen.queryByRole('heading', { name: "You're on the waitlist" })).not.toBeInTheDocument();
  expect(apiClient.get.mock.calls.map(([url]) => new URL(url).pathname).sort()).toEqual([
    '/api/games/ladder',
    '/api/games/slate',
    '/api/games/slate/edges',
  ]);
});

test.each([
  ['/privacy', 'Privacy Policy'],
  ['/terms', 'Terms of Service'],
])('a signed-out visitor can read %s', async (path, title) => {
  window.history.pushState({}, '', path);
  render(<App />);

  expect(await screen.findByRole('heading', { level: 1, name: title })).toBeVisible();
  expect(screen.getByText('Effective October 19, 2026')).toBeInTheDocument();
  expect(document.title).toBe(`${title} | CourtAI`);
  expect(window.location.pathname).toBe(path);
  expect(apiClient.get).not.toHaveBeenCalled();
  window.history.pushState({}, '', '/');
});

test.each([
  ['/privacy', 'Privacy Policy'],
  ['/terms', 'Terms of Service'],
])('a waitlisted user can still read %s', async (path, title) => {
  apiClient.get.mockImplementation(homeGet);
  Object.assign(mockAuth, {
    currentUser: { uid: 'waiting', email: 'fan@example.com' },
    isAuthenticated: true,
    waitlist: { message: 'The beta is full right now.' },
  });
  window.history.pushState({}, '', path);
  render(<App />);

  expect(await screen.findByRole('heading', { level: 1, name: title })).toBeVisible();
  expect(window.location.pathname).toBe(path);
  window.history.pushState({}, '', '/');
});

test.each([
  ['signed out', {}],
  [
    'waitlisted',
    { currentUser: { uid: 'w' }, isAuthenticated: true, waitlist: { message: 'Full.' } },
  ],
])('every page links the legal pages and support when %s', async (_state, auth) => {
  apiClient.get.mockImplementation(homeGet);
  Object.assign(mockAuth, auth);
  render(<App />);

  const legal = await screen.findByRole('navigation', { name: 'Legal' });
  expect(
    within(legal)
      .getAllByRole('link')
      .map((link) => [link.textContent, link.getAttribute('href')]),
  ).toEqual([
    ['Privacy', '/privacy'],
    ['Terms', '/terms'],
    ['support@courtai.app', 'mailto:support@courtai.app'],
  ]);
  await waitFor(() =>
    expect(screen.getByRole('button', { name: /start with a player/i })).toHaveTextContent('22.4'),
  );
});

test('renders the CourtAI search landing page', async () => {
  render(<App />);

  expect(await screen.findByRole('heading', { name: 'Ask the box score' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /start with a player/i })).toBeInTheDocument();
  expect(screen.getByRole('textbox')).toBeEnabled();
  expect(screen.getByRole('button', { name: /sign in with google/i })).toBeInTheDocument();
});

describe('getApiUrl', () => {
  test('builds configured API endpoint URLs', () => {
    expect(getApiUrl('PLAYERS')).toBe(`${config.API_BASE_URL}/api/players`);
    expect(getApiUrl('NL_QUERY')).toBe(`${config.API_BASE_URL}/api/nl-query`);
  });

  test('passes through custom endpoint paths', () => {
    expect(getApiUrl('/api/custom')).toBe(`${config.API_BASE_URL}/api/custom`);
  });
});
