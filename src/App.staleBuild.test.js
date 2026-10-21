const mockPage = { error: null, renders: 0, reports: [] };
const mockFailToLoad = () => {
  mockPage.renders += 1;
  const event = new Event('vite:preloadError', { cancelable: true });
  event.payload = mockPage.error;
  window.dispatchEvent(event);
  throw mockPage.error;
};

jest.mock('./contexts/AuthContext', () => ({
  AuthProvider: ({ children }) => children,
  useAuth: () => ({ isAuthenticated: false, isAdmin: false }),
}));
jest.mock('./components/Auth/LoginButton', () => () => null);
jest.mock('./errorReporting', () => ({
  ...jest.requireActual('./errorReporting'),
  reportRenderError: (error) => mockPage.reports.push(error.message),
}));
// Stands in for Vite's preload helper: it dispatches vite:preloadError, then
// the lazy route rejects with the same error.
jest.mock('./GameLogFilter.js', () => () => mockFailToLoad());

const missingChunk = new TypeError(
  'Failed to fetch dynamically imported module: https://www.courtai.app/assets/GameLogFilter-old.js',
);

// A fresh module registry is a fresh page load; sessionStorage carries over.
const loadPage = async () => {
  let page;
  jest.isolateModules(() => {
    // The pure entry: the default one registers cleanup hooks on import.
    const { render, screen, waitFor, cleanup } = require('@testing-library/react/pure');
    require('./staleBuild').listenForMissingAssets();
    const App = require('./App').default;
    mockPage.renders = 0;
    mockPage.reports = [];
    render(<App />);
    page = { screen, waitFor, cleanup };
  });
  await page.waitFor(() => expect(mockPage.renders).toBeGreaterThan(0));
  return page;
};

beforeEach(() => {
  sessionStorage.clear();
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

test('a missing asset reloads silently once, then shows the alert and reports it', async () => {
  mockPage.error = missingChunk;

  const first = await loadPage();
  expect(first.screen.getByRole('status')).toHaveTextContent('Loading page…');
  expect(first.screen.queryByRole('alert')).toBeNull();
  expect(mockPage.reports).toEqual([]);
  first.cleanup();

  const second = await loadPage();
  expect(await second.screen.findByRole('alert')).toHaveTextContent('Could not load this page.');
  expect(mockPage.reports).toEqual([missingChunk.message]);
  second.cleanup();
});

test('an error thrown by a downloaded module shows the alert without reloading', async () => {
  mockPage.error = new ReferenceError('teamId is not defined');

  const page = await loadPage();
  expect(await page.screen.findByRole('alert')).toHaveTextContent('Could not load this page.');
  expect(mockPage.reports).toEqual(['teamId is not defined']);
  page.cleanup();
});
