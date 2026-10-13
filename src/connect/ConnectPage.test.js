import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
  const heading = await screen.findByRole('heading', {
    level: 1,
    name: 'Ask CourtAI from your chat',
  });
  // Route entry focuses the heading; wait for it so later focus moves are ours.
  await waitFor(() => expect(heading).toHaveFocus());
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
    await screen.findByRole('heading', { level: 1, name: 'Ask CourtAI from your chat' }),
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

test('Claude and ChatGPT steps sit behind tabs, Claude first, and arrow keys switch them', async () => {
  await renderConnectRoute();

  const setup = screen.getByRole('region', { name: 'Set it up' });
  const tabs = within(setup).getAllByRole('tab');
  expect(tabs.map((tab) => tab.textContent)).toEqual(['Claude', 'ChatGPT']);

  let panel = within(setup).getByRole('tabpanel', { name: 'Claude' });
  expect(within(panel).getByRole('list').tagName).toBe('OL');
  expect(within(panel).getByText(/Team or Enterprise.*Owner/)).toBeInTheDocument();
  expect(within(panel).getByText(/Add custom connector/)).toBeInTheDocument();

  tabs[0].focus();
  fireEvent.keyDown(tabs[0], { key: 'ArrowRight' });

  expect(within(setup).getByRole('tab', { name: 'ChatGPT' })).toHaveFocus();
  expect(within(setup).getByRole('tab', { name: 'ChatGPT' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  panel = within(setup).getByRole('tabpanel', { name: 'ChatGPT' });
  expect(within(panel).getByText(/Plus, Pro, Business, Enterprise/)).toBeInTheDocument();
  expect(within(panel).getByText(/Add custom MCP server/)).toBeInTheDocument();
  expect(within(panel).getByText(/sign in with google/i)).toBeInTheDocument();
  expect(within(setup).getByText(/Add custom connector/)).not.toBeVisible();

  fireEvent.keyDown(document.activeElement, { key: 'ArrowRight' });
  expect(within(setup).getByRole('tab', { name: 'Claude' })).toHaveFocus();
  expect(within(setup).getByRole('tabpanel', { name: 'Claude' })).toBeInTheDocument();

  fireEvent.keyDown(document.activeElement, { key: 'ArrowLeft' });
  expect(within(setup).getByRole('tab', { name: 'ChatGPT' })).toHaveFocus();
  expect(within(setup).getByRole('tab', { name: 'ChatGPT' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  fireEvent.keyDown(document.activeElement, { key: 'ArrowLeft' });
  expect(within(setup).getByRole('tab', { name: 'Claude' })).toHaveFocus();

  // Every tab names a panel that exists; the inactive one is hidden, not removed.
  for (const tab of within(setup).getAllByRole('tab', { hidden: true })) {
    expect(document.getElementById(tab.getAttribute('aria-controls'))).not.toBeNull();
  }

  fireEvent.click(within(setup).getByRole('tab', { name: 'ChatGPT' }));
  expect(within(setup).getByRole('tabpanel', { name: 'ChatGPT' })).toBeInTheDocument();
});

test('the page shows the real card and one working question per tool', async () => {
  await renderConnectRoute();

  expect(
    screen.getByTitle('CourtAI Matchup card: Cade Cunningham against Charlotte'),
  ).toHaveAttribute('src', '/mcp-cards/matchup.html');

  const prompts = within(screen.getByRole('region', { name: 'Try asking' })).getAllByRole(
    'listitem',
  );
  expect(prompts.map((item) => item.textContent)).toEqual([
    "SlateWhat's on the slate for April 10, 2026?",
    "MatchupShow Cade Cunningham's matchup against Charlotte.",
    'Game logsHow has Cade Cunningham done against the 10 teams that allow the most pick-and-roll points?',
    'TargetsWhich players fit my Targets today?',
    'BacktestBacktest players who run at least 30% of their plays as the pick-and-roll ball handler against Charlotte.',
  ]);

  const notes = screen.getByRole('region', { name: 'Good to know' });
  expect(within(notes).getByText(/It doesn.t make picks/)).toBeInTheDocument();
  expect(within(notes).getByText(/30 means the defense allows the most/)).toBeInTheDocument();
  expect(within(notes).getByText(/US Eastern time and default to today/)).toBeInTheDocument();
  expect(within(notes).getByText(/your own CourtAI sign-in/)).toBeInTheDocument();
});
