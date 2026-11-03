import { render, screen, waitFor, waitForElementToBeRemoved, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';
import reportFixture from '../../e2e/fixtures/report.json';

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

const mockGet = jest.fn();
const mockPatch = jest.fn();
const mockPut = jest.fn();
jest.mock('../utils/axiosConfig', () => ({
  __esModule: true,
  default: {
    get: (...args) => mockGet(...args),
    patch: (...args) => mockPatch(...args),
    put: (...args) => mockPut(...args),
    post: jest.fn(),
  },
}));

const API = 'http://127.0.0.1:8000';
const ID = 'k3x9q2mtzr';
const refused = (status, error) => Promise.reject({ response: { status, data: { error } } });

// The stored report as GET /api/reports/<id> serves it, with this listing state.
let served;
const report = (overrides) => {
  const data = JSON.parse(JSON.stringify(reportFixture));
  Object.assign(data.report, overrides);
  return data;
};
const serve = (overrides) => {
  served = report(overrides);
};

const signIn = (extra = {}) =>
  Object.assign(mockAuth, {
    currentUser: { uid: 'u1', email: 'sam@example.com' },
    isAuthenticated: true,
    ...extra,
  });

const open = async () => {
  window.history.pushState({}, '', `/reports/${ID}`);
  const view = render(<App />);
  await screen.findByRole('heading', { level: 1, name: 'Injury brief · Sunday, October 25' });
  return view;
};

// List opens a short explanation; its List in Research button sends the listing.
const listInResearch = async () => {
  await userEvent.click(screen.getByRole('button', { name: 'List' }));
  const dialog = screen.getByRole('dialog', { name: 'List in Research' });
  // The keyboard moves into the popup.
  expect(dialog).toHaveFocus();
  expect(dialog).toHaveTextContent(
    'Listing puts this report on Research, under your handle, where anyone can find it.',
  );
  await userEvent.click(within(dialog).getByRole('button', { name: 'List in Research' }));
};

beforeEach(() => {
  Object.assign(mockAuth, { currentUser: null, isAuthenticated: false, waitlist: null });
  mockGet.mockReset();
  mockPatch.mockReset();
  mockPut.mockReset();
  served = report({ is_author: true });
  mockGet.mockImplementation((url) =>
    url === `${API}/api/reports/${ID}`
      ? Promise.resolve({ data: served })
      : Promise.reject({ response: { status: 404 } }),
  );
});

test('only the author sees the List toggle', async () => {
  signIn();
  serve({ is_author: false });
  await open();
  expect(screen.queryByRole('group', { name: 'Manage your report' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'List' })).not.toBeInTheDocument();
  expect(screen.queryByText('Unlisted')).not.toBeInTheDocument();
});

test('a waitlisted author cannot list', async () => {
  signIn({ waitlist: { position: 3 } });
  await open();
  expect(screen.getByText('Unlisted')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'List' })).not.toBeInTheDocument();
});

test('a waitlisted author can still unlist a listed report', async () => {
  signIn({ waitlist: { position: 3 } });
  serve({ is_author: true, listed: true, author: { handle: 'bighatprops' } });
  await open();
  mockPatch.mockImplementation(() => {
    serve({ is_author: true, listed: false });
    return Promise.resolve({ data: {} });
  });
  await userEvent.click(screen.getByRole('button', { name: 'Unlist' }));
  await waitForElementToBeRemoved(() => screen.queryByText(/^Shared by/));
  expect(mockPatch).toHaveBeenCalledWith(`${API}/api/user/reports/${ID}`, { listed: false });
  // Unlisted, a waitlisted author has nothing more to toggle.
  expect(screen.getByText('Unlisted')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'List' })).not.toBeInTheDocument();
});

test('the author lists a report, and the page then shows it listed under their handle', async () => {
  signIn();
  await open();
  expect(screen.getByText('Unlisted')).toHaveAttribute(
    'title',
    'Unlisted. Only people with the link can open it.',
  );
  mockPatch.mockImplementation(() => {
    serve({
      is_author: true,
      listed: true,
      author: { label: '@bighatprops', handle: 'bighatprops' },
    });
    return Promise.resolve({ data: {} });
  });
  await listInResearch();

  expect(await screen.findByRole('button', { name: 'Unlist' })).toBeInTheDocument();
  expect(mockPatch).toHaveBeenCalledWith(`${API}/api/user/reports/${ID}`, { listed: true });
  expect(screen.getByText('Listed in Research')).toBeInTheDocument();
  expect(screen.queryByRole('dialog', { name: 'List in Research' })).not.toBeInTheDocument();
  expect(screen.getByText(/^Shared by/)).toHaveTextContent('Shared by @bighatprops.');
});

test('the author unlists a listed report', async () => {
  signIn();
  serve({ is_author: true, listed: true, author: { handle: 'bighatprops' } });
  await open();
  mockPatch.mockImplementation(() => {
    serve({ is_author: true, listed: false });
    return Promise.resolve({ data: {} });
  });
  await userEvent.click(screen.getByRole('button', { name: 'Unlist' }));
  expect(await screen.findByRole('button', { name: 'List' })).toBeInTheDocument();
  expect(screen.getByText('Unlisted')).toBeInTheDocument();
  expect(mockPatch).toHaveBeenCalledWith(`${API}/api/user/reports/${ID}`, { listed: false });
  expect(screen.queryByText(/^Shared by/)).not.toBeInTheDocument();
});

test('a first listing without a handle asks for one, shows its refusals, then lists', async () => {
  signIn();
  await open();
  mockPatch.mockImplementationOnce(() => refused(409, 'handle_required'));
  await listInResearch();

  const field = await screen.findByRole('textbox', { name: 'Choose your public handle' });
  await waitFor(() => expect(field).toHaveFocus());
  mockPut.mockImplementationOnce(() => refused(400, 'invalid_handle'));
  await userEvent.type(field, 'no');
  await userEvent.click(screen.getByRole('button', { name: 'Save and list' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Use 3–20 lowercase letters, numbers or underscores.',
  );
  expect(field).toHaveAttribute('aria-invalid', 'true');
  expect(mockPut).toHaveBeenLastCalledWith(`${API}/api/user/public-handle`, { handle: 'no' });

  mockPut.mockImplementationOnce(() => refused(409, 'handle_taken'));
  await userEvent.clear(field);
  await userEvent.type(field, '@BigHatProps');
  await userEvent.click(screen.getByRole('button', { name: 'Save and list' }));
  expect(await screen.findByText('That handle is taken. Try another.')).toBeInTheDocument();
  expect(mockPut).toHaveBeenLastCalledWith(`${API}/api/user/public-handle`, {
    handle: 'bighatprops',
  });

  mockPut.mockResolvedValueOnce({ data: { handle: 'sam_reads' } });
  mockPatch.mockImplementationOnce(() => {
    serve({ is_author: true, listed: true, author: { handle: 'sam_reads' } });
    return Promise.resolve({ data: {} });
  });
  await userEvent.clear(field);
  await userEvent.type(field, 'sam_reads');
  await userEvent.click(screen.getByRole('button', { name: 'Save and list' }));
  expect(await screen.findByRole('button', { name: 'Unlist' })).toBeInTheDocument();
  expect(mockPatch).toHaveBeenLastCalledWith(`${API}/api/user/reports/${ID}`, { listed: true });
  expect(screen.queryByRole('textbox', { name: 'Choose your public handle' })).toBeNull();
  expect(screen.getByRole('link', { name: '@sam_reads' })).toHaveAttribute(
    'href',
    '/research/@sam_reads',
  );
});

test('listing over the daily cap says why', async () => {
  signIn();
  await open();
  mockPatch.mockImplementationOnce(() => refused(429, 'listed_limit'));
  await listInResearch();
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'You have listed 5 reports in the last 24 hours. Try again later.',
  );
  expect(screen.getByText('Unlisted')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'List' })).toBeEnabled();
  // The popup closed; the keyboard is back on List.
  expect(screen.getByRole('button', { name: 'List' })).toHaveFocus();
});

test('Report this opens Feedback about this report', async () => {
  signIn();
  serve({ is_author: false });
  await open();
  await userEvent.click(screen.getByRole('button', { name: 'Report this' }));
  const popover = screen.getByRole('dialog', { name: 'Send feedback' });
  expect(within(popover).getByText('Report this report')).toBeInTheDocument();
  expect(within(popover).getByText(ID)).toBeInTheDocument();
});

test('signed out, Report this signs the visitor in first', async () => {
  serve({ is_author: false });
  await open();
  await userEvent.click(screen.getByRole('button', { name: 'Report this' }));
  expect(mockAuth.signInWithGoogle).toHaveBeenCalledWith({ silent: true });
  expect(JSON.parse(window.sessionStorage.getItem('courtai:sign-up-then'))).toMatchObject({
    key: 'report-this',
    args: [ID],
  });
});

test('signing out takes the author controls away', async () => {
  signIn();
  const view = await open();
  expect(screen.getByRole('button', { name: 'List' })).toBeInTheDocument();
  Object.assign(mockAuth, { currentUser: null, isAuthenticated: false });
  served = report({ is_author: false });
  view.rerender(<App />);
  // The report is read again for the signed-out viewer.
  expect(
    await screen.findByRole('heading', { level: 1, name: 'Injury brief · Sunday, October 25' }),
  ).toBeInTheDocument();
  expect(screen.queryByRole('group', { name: 'Manage your report' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'List' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'More report actions' })).not.toBeInTheDocument();
});
