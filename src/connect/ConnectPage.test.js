import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';

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

test('a blocked clipboard leaves the URL on the page as selectable text', async () => {
  installClipboard(() => Promise.reject(new DOMException('Denied', 'NotAllowedError')));
  await renderConnectRoute();

  const button = screen.getByRole('button', { name: 'Copy connector URL' });
  userEvent.click(button);

  await waitFor(() => expect(button).toBeEnabled());
  expect(screen.getByText(CONNECTOR_URL).tagName).toBe('CODE');
  expect(screen.queryByRole('button', { name: 'Copied' })).not.toBeInTheDocument();
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
  expect(within(chatgpt).getByText(/Plus, Pro, Business, Enterprise/)).toBeInTheDocument();
});

test('the page explains what to ask and how to read the answers', async () => {
  await renderConnectRoute();

  expect(screen.getByText(/It doesn.t make picks/)).toBeInTheDocument();
  expect(screen.getByText("What's on tonight's slate?")).toBeInTheDocument();
  expect(screen.getByText('Which players fit my Targets today?')).toBeInTheDocument();
  expect(screen.getByText(/1 means the defense allows the most/)).toBeInTheDocument();
  expect(screen.getByText(/US Eastern time and default to today/)).toBeInTheDocument();
});
