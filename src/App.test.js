import { render, screen } from '@testing-library/react';
import App from './App';
import config, { getApiUrl } from './config';

jest.mock('./contexts/AuthContext', () => ({
  AuthProvider: ({ children }) => children,
  useAuth: () => ({
    currentUser: null,
    loading: false,
    error: null,
    signInWithGoogle: jest.fn(),
    logout: jest.fn(),
    getToken: jest.fn(),
    isAuthenticated: false,
  }),
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
});

test('renders the CourtAI search landing page', async () => {
  render(<App />);

  expect(await screen.findByRole('heading', { name: /courtai/i })).toBeInTheDocument();
  expect(screen.getByText(/lebron james this year/i)).toBeInTheDocument();
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
