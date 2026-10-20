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

const CONNECTOR_URL = 'https://mcp.courtai.app/mcp';

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
  expect(clipboardText).toBe('https://mcp.courtai.app/mcp');
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

  const setup = screen.getByRole('region', { name: 'Connect CourtAI' });
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
  expect(within(panel).getByText(/only add MCP servers on desktop/)).toBeInTheDocument();
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

test('the page shows the real card and a guide of five lessons, each linked from its contents', async () => {
  await renderConnectRoute();

  expect(
    screen.getByTitle('CourtAI Matchup card: Cade Cunningham against Charlotte'),
  ).toHaveAttribute('src', '/mcp-cards/matchup.html');

  const contents = within(screen.getByRole('navigation', { name: 'In this guide' }));
  const links = contents.getAllByRole('link');
  const headings = within(screen.getByRole('main')).getAllByRole('heading', { level: 2 });
  const lessons = [
    ['Connect CourtAI', '#guide-setup'],
    ['Ask one question', '#guide-ask'],
    ['Hand it an outcome', '#guide-outcome'],
    ['Let it run the research', '#guide-research'],
    ['Everything it can do', '#guide-tools'],
  ];
  expect(links).toHaveLength(lessons.length);
  expect(headings).toHaveLength(lessons.length);
  lessons.forEach(([title, href], index) => {
    expect(links[index]).toHaveAccessibleName(title);
    expect(links[index]).toHaveAttribute('href', href);
    expect(headings[index]).toHaveAccessibleName(title);
    // The contents link lands on the lesson it names.
    expect(document.getElementById(href.slice(1))).toBe(
      screen.getByRole('region', { name: title }),
    );
  });

  // The lessons replace the old tool list and notes.
  expect(screen.queryByRole('region', { name: 'What you can ask' })).not.toBeInTheDocument();
  expect(screen.queryByRole('region', { name: 'Good to know' })).not.toBeInTheDocument();
});

test('a Copy button puts exactly its prompt on the clipboard', async () => {
  let clipboardText = '';
  installClipboard((text) => {
    clipboardText = text;
    return Promise.resolve();
  });
  await renderConnectRoute();

  const ask = within(screen.getByRole('region', { name: 'Ask one question' }));
  const habit = ask.getByText('Say the stat').closest('li');
  userEvent.click(within(habit).getByRole('button', { name: 'Copy' }));

  expect(await within(habit).findByRole('button', { name: 'Copied' })).toBeInTheDocument();
  expect(clipboardText).toBe("Show Cade Cunningham's assists matchup against Charlotte.");
  expect(ask.getAllByRole('button', { name: 'Copy' })).toHaveLength(3);
});

test('All opens on the first two jobs, and Show all reveals all 21 capabilities', async () => {
  await renderConnectRoute();

  const tools = within(screen.getByRole('region', { name: 'Everything it can do' }));
  const cardTitles = () =>
    tools.getAllByRole('heading', { level: 4 }).map((heading) => heading.textContent);

  expect(tools.getByRole('button', { name: /^All/ })).toHaveAttribute('aria-pressed', 'true');
  expect(cardTitles()).toHaveLength(6);
  expect(cardTitles()[0]).toBe('Scan a whole night');

  fireEvent.click(tools.getByRole('button', { name: 'Show all 21 (15 more)' }));

  expect(cardTitles()).toHaveLength(21);
  expect(tools.queryByRole('button', { name: /^Show all/ })).not.toBeInTheDocument();

  fireEvent.click(tools.getByRole('button', { name: /^Check the history/ }));

  expect(tools.getByRole('button', { name: /^Check the history/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  expect(cardTitles()).toHaveLength(5);
  expect(cardTitles()).toContain('Against defenses like tonight’s');
});

test('the recorded runs stay folded until opened', async () => {
  await renderConnectRoute();

  const outcome = within(screen.getByRole('region', { name: 'Hand it an outcome' }));
  // The anatomy shows before any fold.
  expect(outcome.getByText('What you want to know')).toBeVisible();
  const runs = outcome.getByText('Step through four runs');
  expect(outcome.getByRole('tab', { name: 'Scan the injury report' })).not.toBeVisible();

  fireEvent.click(runs);

  expect(outcome.getByRole('tab', { name: 'Scan the injury report' })).toBeVisible();

  const research = within(screen.getByRole('region', { name: 'Let it run the research' }));
  expect(research.getByRole('button', { name: 'Copy brief' })).not.toBeVisible();

  fireEvent.click(research.getByText('Step through the whole run'));

  expect(research.getByRole('button', { name: 'Copy brief' })).toBeVisible();
});
