import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';

const mockAuth = {
  currentUser: null,
  loading: false,
  error: null,
  signInWithGoogle: jest.fn(),
  logout: jest.fn(),
  getToken: jest.fn(),
  isAuthenticated: false,
  isAdmin: false,
  waitlist: null,
};

jest.mock('../contexts/AuthContext', () => ({
  AuthProvider: ({ children }) => children,
  useAuth: () => mockAuth,
}));

jest.mock('../utils/axiosConfig', () => ({
  __esModule: true,
  default: {
    get: () => Promise.resolve({ data: [] }),
    post: () => Promise.resolve({ data: {} }),
  },
}));

const PAGES = [
  { path: '/terms', heading: 'Terms of Use', title: 'Terms of Use | CourtAI' },
  { path: '/privacy', heading: 'Privacy Policy', title: 'Privacy Policy | CourtAI' },
  {
    path: '/responsible-gambling',
    heading: 'Responsible gambling',
    title: 'Responsible gambling | CourtAI',
  },
];

const CONNECT = 'Ask CourtAI from your chat';

// Each route is lazy: wait for its own heading so nothing resolves after the test.
const renderAt = async (path, heading) => {
  window.history.pushState({}, '', path);
  const view = render(<App />);
  await screen.findByRole('heading', { name: heading });
  return view;
};

const SIGNED_IN = {
  currentUser: { email: 'fan@example.com', displayName: 'Fan' },
  isAuthenticated: true,
};

beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  console.log.mockRestore();
  Object.assign(mockAuth, {
    currentUser: null,
    isAuthenticated: false,
    waitlist: null,
  });
});

describe.each(PAGES)('$path', ({ path, heading, title }) => {
  test('opens for a signed-out visitor and keeps its URL, query string included', async () => {
    await renderAt(`${path}?ref=x-picks`, heading);

    expect(window.location.pathname).toBe(path);
    expect(window.location.search).toBe('?ref=x-picks');
    await waitFor(() => expect(document.title).toBe(title));
  });

  test('opens for a waitlisted account instead of the waitlist screen', async () => {
    Object.assign(mockAuth, SIGNED_IN, { waitlist: { message: 'The beta is full right now.' } });
    renderAt(path);

    expect(await screen.findByRole('heading', { level: 1, name: heading })).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: "You're on the waitlist" }),
    ).not.toBeInTheDocument();
  });

  test('opens for a signed-in account', async () => {
    Object.assign(mockAuth, SIGNED_IN);
    await renderAt(path, heading);

    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeInTheDocument();
  });
});

describe('footer', () => {
  test('links every legal page and the links work', async () => {
    await renderAt('/connect', CONNECT);
    const footer = screen.getByRole('contentinfo');
    const legal = within(within(footer).getByRole('navigation', { name: 'Legal' }));

    expect(
      legal.getAllByRole('link').map((link) => [link.textContent, link.getAttribute('href')]),
    ).toEqual([
      ['Terms', '/terms'],
      ['Privacy', '/privacy'],
      ['Responsible gambling', '/responsible-gambling'],
    ]);

    await userEvent.click(legal.getByRole('link', { name: 'Responsible gambling' }));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Responsible gambling' }),
    ).toBeInTheDocument();
    expect(window.location.pathname).toBe('/responsible-gambling');
  });

  test('states the 21+ notice, facts-not-advice and the NBA.com source', async () => {
    await renderAt('/connect', CONNECT);
    const footer = screen.getByRole('contentinfo');

    expect(footer).toHaveTextContent(
      '21+ only. CourtAI reports facts; it never predicts or gives betting advice.',
    );
    expect(footer).toHaveTextContent('Source: NBA.com');
  });

  test('is on every page, including a waitlisted account on the waitlist screen', async () => {
    Object.assign(mockAuth, SIGNED_IN, { waitlist: { message: 'The beta is full right now.' } });
    await renderAt('/', "You're on the waitlist");

    expect(
      within(screen.getByRole('navigation', { name: 'Legal' })).getByRole('link', {
        name: 'Terms',
      }),
    ).toHaveAttribute('href', '/terms');
  });

  test('says that signing in accepts the Terms and Privacy to a signed-out visitor only', async () => {
    const { unmount } = await renderAt('/connect', CONNECT);
    const footer = screen.getByRole('contentinfo');
    const line = within(footer).getByText(/By signing in you agree to the/);

    expect(within(line).getByRole('link', { name: 'Terms' })).toHaveAttribute('href', '/terms');
    expect(within(line).getByRole('link', { name: 'Privacy' })).toHaveAttribute('href', '/privacy');
    unmount();

    Object.assign(mockAuth, SIGNED_IN);
    await renderAt('/connect', CONNECT);
    expect(screen.queryByText(/By signing in you agree to the/)).not.toBeInTheDocument();
  });
});

describe('sign-in', () => {
  test('the header line beside the sign-in button links the Terms and Privacy', async () => {
    await renderAt('/connect', CONNECT);
    const header = screen.getByRole('banner');
    const line = within(header).getByText(/By signing in you agree to the/);

    expect(
      within(header).getByRole('button', { name: /sign in with google/i }),
    ).toBeInTheDocument();
    expect(within(line).getByRole('link', { name: 'Terms' })).toHaveAttribute('href', '/terms');
    expect(within(line).getByRole('link', { name: 'Privacy' })).toHaveAttribute('href', '/privacy');
  });
});

describe('Connect page', () => {
  test('links the Terms and the Privacy Policy', async () => {
    await renderAt('/connect', CONNECT);
    const section = within(
      screen.getByRole('heading', { name: 'Good to know' }).closest('section'),
    );

    expect(section.getByRole('link', { name: 'Terms' })).toHaveAttribute('href', '/terms');
    expect(section.getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute(
      'href',
      '/privacy',
    );
  });
});

describe('Responsible gambling', () => {
  test('gives the helpline as a call link, 21+ and the facts-not-advice line', async () => {
    await renderAt('/responsible-gambling', 'Responsible gambling');
    const main = within(screen.getByRole('main'));

    expect(main.getByRole('link', { name: '1-800-GAMBLER' })).toHaveAttribute(
      'href',
      'tel:+18004262537',
    );
    expect(
      main.getByText('CourtAI is for adults who are 21 or older.', { exact: false }),
    ).toBeInTheDocument();
    expect(
      main.getByText('CourtAI reports facts; it never predicts or gives betting advice.'),
    ).toBeInTheDocument();
  });
});

describe('Terms', () => {
  test('carries the 21+ rule, facts-not-advice and the NBA.com attribution', async () => {
    await renderAt('/terms', 'Terms of Use');
    const main = within(screen.getByRole('main'));

    expect(
      main.getByText('You must be 21 or older to use CourtAI.', { exact: false }),
    ).toBeInTheDocument();
    expect(
      main.getByText('CourtAI reports facts; it never predicts or gives betting advice.'),
    ).toBeInTheDocument();
    expect(main.getByText('Source: NBA.com.', { exact: false })).toBeInTheDocument();
  });
});

describe('Privacy', () => {
  const rowDetail = (name) => screen.getByRole('rowheader', { name }).closest('tr');

  test('says what each part of the product stores and who handles it', async () => {
    await renderAt('/privacy', 'Privacy Policy');

    // What the code stores at sign-in, from the Firebase profile.
    expect(rowDetail('Sign-in with Google')).toHaveTextContent(
      'Google sends us your email address, name, profile photo link and account id through Firebase',
    );
    // First-touch attribution: browser first, the account once a sign-in sends it.
    expect(rowDetail('Where you came from')).toHaveTextContent(
      'stays in your browser until you sign in. Then we save it once on your account',
    );
    expect(rowDetail('Where you came from')).toHaveTextContent('Signing out does not clear it.');
    // Planned per-account counts (crf04/statsplus#213): a count per day, no request log.
    expect(rowDetail('Activity counts')).toHaveTextContent(
      'a count, per account and per day (US Eastern)',
    );
    expect(rowDetail('Activity counts')).toHaveTextContent('We keep no log of each request');
    // The server logs name the account, and the search text reaches OpenAI.
    expect(rowDetail('Server logs')).toHaveTextContent('your email and account id');
    expect(rowDetail('Your searches')).toHaveTextContent('the text is also sent to OpenAI');

    for (const provider of [
      'Google (Firebase)',
      'Vercel',
      'Railway',
      'OpenAI',
      'Sentry',
      'Google Fonts and NBA.com',
    ]) {
      expect(screen.getByRole('rowheader', { name: provider })).toBeInTheDocument();
    }
  });

  test('describes the connector grant and promises no sale and no ads', async () => {
    await renderAt('/privacy', 'Privacy Policy');
    const main = within(screen.getByRole('main'));

    expect(
      main.getByText('A grant stops working after 30 days without use.', { exact: false }),
    ).toBeInTheDocument();
    expect(
      main.getByText('We do not sell your personal data.', { exact: false }),
    ).toBeInTheDocument();
    expect(main.getByText('CourtAI shows no ads', { exact: false })).toBeInTheDocument();
  });
});

describe('operator placeholders', () => {
  // Filling the placeholders in is one edit only while no page hard-codes one.
  test('appear only in legalConfig.js', () => {
    const stray = readdirSync(__dirname)
      .filter((name) => name.endsWith('.js') && !name.endsWith('.test.js'))
      .filter((name) => name !== 'legalConfig.js')
      .filter((name) => readFileSync(join(__dirname, name), 'utf8').includes('{{'));

    expect(stray).toEqual([]);
  });
});
