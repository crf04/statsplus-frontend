import { render, screen } from '@testing-library/react';
import App from './App';
import config, { getApiUrl } from './config';

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
    get: () => Promise.resolve({ data: [] }),
    post: () => Promise.resolve({ data: {} }),
  },
}));

beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  console.log.mockRestore();
  Object.assign(mockAuth, { currentUser: null, isAuthenticated: false, waitlist: null });
});

test('a waitlisted user sees the waitlist screen instead of the signed-in app', async () => {
  Object.assign(mockAuth, {
    currentUser: { email: 'fan@example.com' },
    isAuthenticated: true,
    waitlist: { message: 'The beta is full right now.' },
  });
  render(<App />);

  expect(
    await screen.findByRole('heading', { name: "You're on the waitlist" }),
  ).toBeInTheDocument();
  expect(screen.getByText('The beta is full right now.')).toBeInTheDocument();
  expect(screen.getByText('fan@example.com')).toBeInTheDocument();
  expect(screen.queryByRole('navigation', { name: 'Primary' })).not.toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'Ask the box score' })).not.toBeInTheDocument();
});

test('renders the CourtAI search landing page', async () => {
  render(<App />);

  expect(await screen.findByRole('heading', { name: 'Ask the box score' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /start with a player/i })).toBeInTheDocument();
  expect(screen.getByRole('textbox')).toHaveAttribute('placeholder', 'Sign in to enter a query...');
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
