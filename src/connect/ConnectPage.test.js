import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';

let mockSignedIn = false;

jest.mock('../contexts/AuthContext', () => ({
  AuthProvider: ({ children }) => children,
  useAuth: () => ({
    currentUser: mockSignedIn ? { displayName: 'Test Viewer' } : null,
    loading: false,
    error: null,
    signInWithGoogle: jest.fn(),
    logout: jest.fn(),
    getToken: jest.fn(),
    isAuthenticated: mockSignedIn,
    isAdmin: false,
  }),
}));

const CONNECTOR_URL = 'https://statsplus-mcp-production.up.railway.app/mcp';

const installClipboard = (writeText) => {
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText },
  });
};

const renderConnectRoute = async () => {
  window.history.pushState({}, '', '/connect');
  render(<App />);
  await screen.findByRole('heading', { level: 1, name: 'Use StatsPlus in Claude or ChatGPT' });
};

afterEach(() => {
  mockSignedIn = false;
  delete navigator.clipboard;
  window.history.pushState({}, '', '/');
});

test('a signed-out visitor reaches the Connect page from the main nav', async () => {
  window.history.pushState({}, '', '/matchups');
  render(<App />);

  const nav = screen.getByRole('navigation', { name: 'Primary' });
  const link = within(nav).getByRole('link', { name: 'Connect' });
  expect(link).toHaveAttribute('href', '/connect');

  userEvent.click(link);

  expect(
    await screen.findByRole('heading', { level: 1, name: 'Use StatsPlus in Claude or ChatGPT' }),
  ).toBeInTheDocument();
  expect(screen.getByText(CONNECTOR_URL)).toBeInTheDocument();
});

test('a signed-in viewer keeps the Connect link in the main nav', () => {
  mockSignedIn = true;
  window.history.pushState({}, '', '/matchups');
  render(<App />);

  const nav = screen.getByRole('navigation', { name: 'Primary' });
  expect(within(nav).getByRole('button', { name: /Test Viewer/ })).toBeInTheDocument();
  expect(within(nav).getByRole('link', { name: 'Connect' })).toHaveAttribute('href', '/connect');
});

test('copying puts exactly the connector URL on the clipboard and confirms it', async () => {
  let clipboardText = '';
  installClipboard((text) => {
    clipboardText = text;
    return Promise.resolve();
  });
  await renderConnectRoute();

  userEvent.click(screen.getByRole('button', { name: 'Copy connector URL' }));

  expect(await screen.findByRole('button', { name: 'Copied' })).toBeInTheDocument();
  expect(clipboardText).toBe('https://statsplus-mcp-production.up.railway.app/mcp');
});

test('a blocked clipboard leaves the URL on the page and the button ready to retry', async () => {
  let rejectWrite;
  installClipboard(
    () =>
      new Promise((resolve, reject) => {
        rejectWrite = reject;
      }),
  );
  await renderConnectRoute();

  userEvent.click(screen.getByRole('button', { name: 'Copy connector URL' }));
  await act(async () => {
    rejectWrite(new DOMException('Denied', 'NotAllowedError'));
  });

  expect(screen.getByRole('button', { name: 'Copy connector URL' })).toBeEnabled();
  expect(screen.queryByRole('button', { name: 'Copied' })).not.toBeInTheDocument();
  expect(screen.getByText(CONNECTOR_URL)).toBeVisible();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

test('Claude and ChatGPT each get an ordered list of setup steps, Claude first', async () => {
  await renderConnectRoute();

  const claude = screen.getByRole('region', { name: 'Claude' });
  const chatgpt = screen.getByRole('region', { name: 'ChatGPT' });
  expect(claude.compareDocumentPosition(chatgpt) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

  for (const section of [claude, chatgpt]) {
    const list = within(section).getByRole('list');
    expect(list.tagName).toBe('OL');
    expect(within(list).getByText(/sign in with google/i)).toBeInTheDocument();
  }
  expect(within(claude).getByText(/Team or Enterprise.*Owner/)).toBeInTheDocument();
  expect(within(chatgpt).getByText(/Plus, Pro, Business, Enterprise/)).toBeInTheDocument();
});

test('the page explains what to ask and how to read the answers', async () => {
  await renderConnectRoute();

  expect(screen.getByText(/It doesn.t make picks/)).toBeInTheDocument();
  expect(screen.getByText("What's on tonight's slate?")).toBeInTheDocument();
  expect(screen.getByText('Which players fit my Targets today?')).toBeInTheDocument();
  expect(screen.getByText(/30 means the defense allows the most/)).toBeInTheDocument();
  expect(screen.getByText(/US Eastern time and default to today/)).toBeInTheDocument();
});
