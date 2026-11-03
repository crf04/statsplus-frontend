import { render, screen, within } from '@testing-library/react';
import App from '../App';
import { homeGet } from '../home/publicHomeFixtures';
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
    waitlist: null,
  }),
}));

const mockGet = jest.fn();
jest.mock('../utils/axiosConfig', () => ({
  __esModule: true,
  default: { get: (...args) => mockGet(...args) },
}));

const withFeed = (feed) =>
  mockGet.mockImplementation((url, options) =>
    url.endsWith('/api/research') ? Promise.resolve({ data: feed }) : homeGet(url, options),
  );

const openHome = async () => {
  window.history.pushState({}, '', '/');
  render(<App />);
  await screen.findByRole('heading', { name: 'Ask the box score' });
};

test('the public home shows the latest three listed reports, Featured among them by listing time', async () => {
  withFeed(
    researchPage({
      featured: [entry('feat00001', { title: 'Pinned', listed_at: '2026-10-26T12:00:00Z' })],
      reports: [
        entry('new000001', { title: 'Newest', listed_at: '2026-10-27T20:00:00Z' }),
        entry('mid000001', { title: 'Middle', listed_at: '2026-10-27T10:00:00Z' }),
        entry('old000001', { title: 'Oldest', listed_at: '2026-10-20T10:00:00Z' }),
      ],
    }),
  );
  await openHome();
  const strip = await screen.findByRole('list', { name: 'Latest research' });
  expect(
    within(strip)
      .getAllByRole('heading', { level: 3 })
      .map((heading) => heading.textContent),
  ).toEqual(['Newest', 'Middle', 'Pinned']);
  expect(screen.getByRole('link', { name: 'All research' })).toHaveAttribute('href', '/research');
});

test('the public home has no Research strip while nothing is listed', async () => {
  withFeed(researchPage());
  await openHome();
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(mockGet).toHaveBeenCalledWith('http://127.0.0.1:8000/api/research', expect.anything());
  expect(screen.queryByRole('heading', { name: 'Research' })).not.toBeInTheDocument();
  expect(screen.queryByRole('list', { name: 'Latest research' })).not.toBeInTheDocument();
});

test('the public home has no Research strip when the feed cannot be read', async () => {
  mockGet.mockImplementation((url, options) =>
    url.endsWith('/api/research')
      ? Promise.reject({ response: { status: 500 } })
      : homeGet(url, options),
  );
  await openHome();
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(screen.queryByRole('list', { name: 'Latest research' })).not.toBeInTheDocument();
});
