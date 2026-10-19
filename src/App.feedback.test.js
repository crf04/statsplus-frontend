import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toJpeg } from 'html-to-image';
import App from './App';
import config from './config';
import apiClient from './utils/axiosConfig';
import { homeGet } from './home/publicHomeFixtures';

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
    get: jest.fn(),
    post: jest.fn(),
  },
}));

jest.mock('html-to-image', () => ({ toJpeg: jest.fn() }));

const FEEDBACK_URL = `${config.API_BASE_URL}/api/user/feedback`;
const SENT = 'Sent. Thanks — Chris reads every one.';
const SERVER_ERROR = {
  response: { status: 500, headers: { 'x-request-id': '3f9a12bc-77aa-4c1d-8e21-aaaaaaaaaaaa' } },
};
const SLATE_ERROR = 'Unable to load this slate. Please try again. (ref 3f9a12bc)';

const signIn = (extra = {}) =>
  Object.assign(mockAuth, {
    currentUser: { uid: 'u1', email: 'sam@example.com', displayName: 'Sam Rivera' },
    isAuthenticated: true,
    ...extra,
  });

const openFromHeader = () => userEvent.click(screen.getByRole('button', { name: 'Feedback' }));
const popover = () => screen.getByRole('dialog', { name: 'Send feedback' });
const messageBox = () => within(popover()).getByRole('textbox', { name: 'Your feedback' });
const sendButton = () => within(popover()).getByRole('button', { name: 'Send' });

const postedBody = () => apiClient.post.mock.calls[0][1];

beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  apiClient.get.mockImplementation(homeGet);
  apiClient.post.mockResolvedValue({ data: { sent: true } });
  window.localStorage.clear();
  window.history.pushState({}, '', '/privacy');
});

afterEach(() => {
  console.log.mockRestore();
  jest.clearAllMocks();
  config.APP_COMMIT = '';
  Object.assign(mockAuth, { currentUser: null, isAuthenticated: false, waitlist: null });
  window.history.pushState({}, '', '/');
});

describe('the header button', () => {
  test('a signed-out visitor has none', async () => {
    render(<App />);
    expect(await screen.findByRole('heading', { level: 1, name: 'Privacy Policy' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Feedback' })).not.toBeInTheDocument();
  });

  test('a signed-in account has it before the avatar', async () => {
    signIn();
    render(<App />);
    const button = await screen.findByRole('button', { name: 'Feedback' });
    expect(button).toHaveTextContent('Feedback');
    const auth = button.closest('.app-auth');
    expect(auth.firstElementChild).toBe(button);
  });

  test('a waitlisted account has it too', async () => {
    signIn({ waitlist: { message: 'The beta is full right now.' } });
    render(<App />);
    expect(await screen.findByRole('button', { name: 'Feedback' })).toBeEnabled();
  });
});

describe('sending', () => {
  test('a plain message posts exactly the page, version and viewport with it', async () => {
    signIn();
    render(<App />);
    await openFromHeader();

    expect(popover()).toHaveTextContent('Feedback');
    expect(messageBox()).toHaveFocus();
    expect(messageBox()).toHaveAttribute(
      'placeholder',
      'What’s working, what’s broken, what’s missing?',
    );
    expect(sendButton()).toBeDisabled();
    expect(
      within(popover()).getByLabelText('OK to email me back at sam@example.com'),
    ).toBeChecked();
    expect(within(popover()).getByLabelText('Include a screenshot of this page')).not.toBeChecked();
    expect(popover()).toHaveTextContent('Also sends this page’s address and the app version.');

    await userEvent.type(messageBox(), '  The rebounds rank looks flipped  ');
    await userEvent.click(sendButton());

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(apiClient.post).toHaveBeenCalledTimes(1);
    expect(apiClient.post.mock.calls[0][0]).toBe(FEEDBACK_URL);
    expect(postedBody()).toEqual({
      message: 'The rebounds rank looks flipped',
      reply_ok: true,
      page: '/privacy',
      app_version: '1.0.0',
      viewport: '1024x768',
    });
    expect(screen.getByRole('status')).toHaveTextContent(SENT);
  });

  test('the build commit is the app version when the build has one', async () => {
    config.APP_COMMIT = 'c703b57';
    signIn();
    render(<App />);
    await openFromHeader();
    await userEvent.type(messageBox(), 'Hello');
    await userEvent.click(sendButton());
    await waitFor(() => expect(apiClient.post).toHaveBeenCalled());
    expect(postedBody().app_version).toBe('c703b57');
  });

  test('unticking the email box sends reply_ok false', async () => {
    signIn();
    render(<App />);
    await openFromHeader();
    await userEvent.type(messageBox(), 'Hello');
    await userEvent.click(within(popover()).getByLabelText(/OK to email me back/));
    await userEvent.click(sendButton());
    await waitFor(() => expect(apiClient.post).toHaveBeenCalled());
    expect(postedBody().reply_ok).toBe(false);
  });

  test('Send is disabled while the request is in flight', async () => {
    let finish;
    apiClient.post.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    signIn();
    render(<App />);
    await openFromHeader();
    await userEvent.type(messageBox(), 'Hello');
    await userEvent.click(sendButton());

    expect(sendButton()).toBeDisabled();
    await userEvent.click(sendButton());
    expect(apiClient.post).toHaveBeenCalledTimes(1);

    finish({ data: { sent: true } });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});

describe('the page sent', () => {
  test('is the path and query, without the hash', async () => {
    window.history.pushState({}, '', '/privacy?utm_source=x&tab=2#section-3');
    signIn();
    render(<App />);
    await openFromHeader();
    await userEvent.type(messageBox(), 'Hello');
    await userEvent.click(sendButton());
    await waitFor(() => expect(apiClient.post).toHaveBeenCalled());
    expect(postedBody().page).toBe('/privacy?utm_source=x&tab=2');
  });
});

describe('a send that finishes after its popover was dismissed', () => {
  test('shows the toast but leaves a newer draft open and intact', async () => {
    let finish;
    apiClient.post.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    signIn();
    render(<App />);
    await openFromHeader();
    await userEvent.type(messageBox(), 'First message');
    await userEvent.click(sendButton());
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await openFromHeader();
    await userEvent.type(messageBox(), 'Second draft');
    finish({ data: { sent: true } });

    expect(await screen.findByRole('status')).toHaveTextContent(SENT);
    expect(popover()).toBeVisible();
    expect(messageBox()).toHaveValue('Second draft');
    expect(sendButton()).toBeEnabled();
  });
});

describe('focus after closing', () => {
  test.each([
    [
      'the close button',
      () => userEvent.click(screen.getByRole('button', { name: 'Close feedback' })),
    ],
    ['Escape', () => userEvent.keyboard('{Escape}')],
    ['a click outside', () => userEvent.click(screen.getByRole('navigation', { name: 'Primary' }))],
    [
      'a successful send',
      async () => {
        await userEvent.type(messageBox(), 'Hello');
        await userEvent.click(sendButton());
      },
    ],
  ])('returns to the header button after %s', async (_name, close) => {
    signIn();
    render(<App />);
    await openFromHeader();
    await close();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getByRole('button', { name: 'Feedback' })).toHaveFocus());
  });

  test('returns to the Report this link that opened it', async () => {
    apiClient.get.mockRejectedValue(SERVER_ERROR);
    window.history.pushState({}, '', '/matchups');
    signIn();
    render(<App />);
    const link = await screen.findByRole('button', { name: 'Report this' });
    await userEvent.click(link);
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(link).toHaveFocus());
  });

  test('stays on a control the user clicked outside the popover', async () => {
    signIn();
    render(<App />);
    await openFromHeader();
    await userEvent.click(screen.getByRole('link', { name: 'Terms' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Feedback' })).not.toHaveFocus();
  });
});

describe('closing', () => {
  test.each([
    [
      'the close button',
      () => userEvent.click(screen.getByRole('button', { name: 'Close feedback' })),
    ],
    ['Escape', () => userEvent.keyboard('{Escape}')],
    ['a click outside', () => userEvent.click(screen.getByRole('heading', { level: 1 }))],
  ])('%s closes the popover', async (_name, close) => {
    signIn();
    render(<App />);
    await openFromHeader();
    expect(popover()).toBeVisible();
    await close();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(apiClient.post).not.toHaveBeenCalled();
  });

  test('the header button toggles it', async () => {
    signIn();
    render(<App />);
    await openFromHeader();
    await openFromHeader();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('the X handle', () => {
  test('drops a leading @ as it is typed and sends and remembers the handle', async () => {
    signIn();
    render(<App />);
    await openFromHeader();
    await userEvent.type(messageBox(), 'Hello');
    const handle = within(popover()).getByLabelText(/X handle/);
    await userEvent.type(handle, '@samrivera_bets');
    expect(handle).toHaveValue('samrivera_bets');
    await userEvent.click(sendButton());

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(postedBody().x_handle).toBe('samrivera_bets');
    expect(window.localStorage.getItem('courtai:feedback-x-handle')).toBe('samrivera_bets');

    await openFromHeader();
    expect(within(popover()).getByLabelText(/X handle/)).toHaveValue('samrivera_bets');
  });

  test('an invalid handle shows a message and disables Send', async () => {
    signIn();
    render(<App />);
    await openFromHeader();
    await userEvent.type(messageBox(), 'Hello');
    const handle = within(popover()).getByLabelText(/X handle/);
    await userEvent.type(handle, 'not valid!');

    expect(
      within(popover()).getByText('Letters, numbers and underscores, up to 15 characters.'),
    ).toBeVisible();
    expect(sendButton()).toBeDisabled();

    await userEvent.clear(handle);
    expect(
      within(popover()).queryByText('Letters, numbers and underscores, up to 15 characters.'),
    ).not.toBeInTheDocument();
    expect(sendButton()).toBeEnabled();
  });

  test('a handle sent empty is forgotten and left out of the request', async () => {
    window.localStorage.setItem('courtai:feedback-x-handle', 'samrivera_bets');
    signIn();
    render(<App />);
    await openFromHeader();
    const handle = within(popover()).getByLabelText(/X handle/);
    expect(handle).toHaveValue('samrivera_bets');
    await userEvent.clear(handle);
    await userEvent.type(messageBox(), 'Hello');
    await userEvent.click(sendButton());

    await waitFor(() => expect(apiClient.post).toHaveBeenCalled());
    expect(postedBody()).not.toHaveProperty('x_handle');
    expect(window.localStorage.getItem('courtai:feedback-x-handle')).toBeNull();
  });

  test('a handle is not remembered when the send fails', async () => {
    apiClient.post.mockRejectedValue({ response: { status: 503, data: {} } });
    signIn();
    render(<App />);
    await openFromHeader();
    await userEvent.type(messageBox(), 'Hello');
    await userEvent.type(within(popover()).getByLabelText(/X handle/), 'sam');
    await userEvent.click(sendButton());
    await screen.findByRole('alert');
    expect(window.localStorage.getItem('courtai:feedback-x-handle')).toBeNull();
  });
});

describe('a failed send', () => {
  test('a 503 keeps the draft and says to try again', async () => {
    apiClient.post.mockRejectedValue({
      response: {
        status: 503,
        data: { error: { code: 'feedback_unavailable', message: 'Delivery is not configured.' } },
      },
    });
    signIn();
    render(<App />);
    await openFromHeader();
    await userEvent.type(messageBox(), 'My draft');
    await userEvent.click(sendButton());

    expect(await within(popover()).findByRole('alert')).toHaveTextContent(
      'Couldn’t send. Try again.',
    );
    expect(messageBox()).toHaveValue('My draft');
    expect(sendButton()).toBeEnabled();
    expect(screen.queryByText(SENT)).not.toBeInTheDocument();
  });

  test('a 429 shows the server’s message and keeps the draft', async () => {
    apiClient.post.mockRejectedValue({
      response: {
        status: 429,
        data: { error: { code: 'rate_limited', message: 'Too many messages. Try again later.' } },
      },
    });
    signIn();
    render(<App />);
    await openFromHeader();
    await userEvent.type(messageBox(), 'My draft');
    await userEvent.click(sendButton());

    expect(await within(popover()).findByRole('alert')).toHaveTextContent(
      'Too many messages. Try again later.',
    );
    expect(messageBox()).toHaveValue('My draft');
  });

  test('a 400 shows the server’s message', async () => {
    apiClient.post.mockRejectedValue({
      response: {
        status: 400,
        data: { error: { code: 'invalid', message: 'x_handle is invalid.' } },
      },
    });
    signIn();
    render(<App />);
    await openFromHeader();
    await userEvent.type(messageBox(), 'My draft');
    await userEvent.click(sendButton());
    expect(await within(popover()).findByRole('alert')).toHaveTextContent('x_handle is invalid.');
    expect(messageBox()).toHaveValue('My draft');
  });

  test('a request that never reached the server says to try again', async () => {
    apiClient.post.mockRejectedValue(new Error('Network Error'));
    signIn();
    render(<App />);
    await openFromHeader();
    await userEvent.type(messageBox(), 'My draft');
    await userEvent.click(sendButton());
    expect(await within(popover()).findByRole('alert')).toHaveTextContent(
      'Couldn’t send. Try again.',
    );
  });
});

describe('the screenshot', () => {
  const tick = () => userEvent.click(screen.getByLabelText('Include a screenshot of this page'));

  test('is captured on Send as a JPEG without the popover and goes in the body', async () => {
    // The capture asks the filter about each node while the popover is still up.
    const kept = {};
    toJpeg.mockImplementation(async (_node, options) => {
      kept.page = options.filter(document.body.querySelector('.app-nav'));
      kept.popover = options.filter(popover());
      kept.field = options.filter(messageBox());
      return 'data:image/jpeg;base64,/9j/AAAA';
    });
    signIn();
    render(<App />);
    await openFromHeader();
    await userEvent.type(messageBox(), 'Look at this');
    await tick();
    expect(toJpeg).not.toHaveBeenCalled();
    await userEvent.click(sendButton());

    await waitFor(() => expect(apiClient.post).toHaveBeenCalled());
    expect(postedBody().screenshot).toBe('data:image/jpeg;base64,/9j/AAAA');
    const [target, options] = toJpeg.mock.calls[0];
    expect(target).toBe(document.body);
    expect(options).toMatchObject({ quality: 0.7, pixelRatio: 1 });
    expect(kept).toEqual({ page: true, popover: false, field: false });
    expect(screen.getByRole('status')).toHaveTextContent(SENT);
    expect(screen.getByRole('status')).not.toHaveTextContent('screenshot');
  });

  test('a failed capture still sends the message and the note says so', async () => {
    toJpeg.mockRejectedValue(new Error('tainted canvas'));
    signIn();
    render(<App />);
    await openFromHeader();
    await userEvent.type(messageBox(), 'Look at this');
    await tick();
    await userEvent.click(sendButton());

    await waitFor(() => expect(apiClient.post).toHaveBeenCalled());
    expect(postedBody()).not.toHaveProperty('screenshot');
    expect(postedBody().message).toBe('Look at this');
    expect(screen.getByRole('status')).toHaveTextContent(
      `${SENT} The screenshot couldn’t be attached.`,
    );
  });

  test('a capture over 2 MB is dropped the same way', async () => {
    toJpeg.mockResolvedValue(`data:image/jpeg;base64,${'A'.repeat(3 * 1024 * 1024)}`);
    signIn();
    render(<App />);
    await openFromHeader();
    await userEvent.type(messageBox(), 'Look at this');
    await tick();
    await userEvent.click(sendButton());

    await waitFor(() => expect(apiClient.post).toHaveBeenCalled());
    expect(postedBody()).not.toHaveProperty('screenshot');
    expect(screen.getByRole('status')).toHaveTextContent('The screenshot couldn’t be attached.');
  });

  test('is never captured when the box is left unticked', async () => {
    signIn();
    render(<App />);
    await openFromHeader();
    await userEvent.type(messageBox(), 'Hello');
    await userEvent.click(sendButton());
    await waitFor(() => expect(apiClient.post).toHaveBeenCalled());
    expect(toJpeg).not.toHaveBeenCalled();
  });
});

describe('error references', () => {
  beforeEach(() => {
    apiClient.get.mockRejectedValue(SERVER_ERROR);
    window.history.pushState({}, '', '/matchups');
  });

  test('Report this opens the popover on that error and sends its ref', async () => {
    signIn();
    render(<App />);
    const alert = await screen.findByText(
      (_, element) =>
        element?.getAttribute('role') === 'alert' && element.textContent.includes(SLATE_ERROR),
    );
    await userEvent.click(within(alert).getByRole('button', { name: 'Report this' }));

    expect(popover()).toHaveTextContent('Report this error');
    expect(messageBox()).toHaveAttribute('placeholder', 'What were you doing when this happened?');
    expect(popover()).toHaveTextContent(
      'Also sends this page’s address and the app version, and error ref 3f9a12bc.',
    );
    await userEvent.type(messageBox(), 'Opened the slate');
    await userEvent.click(sendButton());

    await waitFor(() => expect(apiClient.post).toHaveBeenCalled());
    expect(postedBody()).toEqual({
      message: 'Opened the slate',
      reply_ok: true,
      page: '/matchups',
      app_version: '1.0.0',
      viewport: '1024x768',
      error_ref: '3f9a12bc',
    });
  });

  test('opening Feedback from the header attaches the ref still on screen', async () => {
    signIn();
    render(<App />);
    await screen.findByRole('button', { name: 'Report this' });
    await openFromHeader();

    expect(popover()).toHaveTextContent('Report this error');
    await userEvent.type(messageBox(), 'Opened the slate');
    await userEvent.click(sendButton());
    await waitFor(() => expect(apiClient.post).toHaveBeenCalled());
    expect(postedBody().error_ref).toBe('3f9a12bc');
  });

  test('a ref that has left the screen is not attached', async () => {
    signIn();
    render(<App />);
    await screen.findByRole('button', { name: 'Report this' });
    await userEvent.click(screen.getByRole('link', { name: 'Privacy' }));
    await screen.findByRole('heading', { level: 1, name: 'Privacy Policy' });
    expect(screen.queryByRole('button', { name: 'Report this' })).not.toBeInTheDocument();
    await openFromHeader();

    expect(popover()).not.toHaveTextContent('Report this error');
    await userEvent.type(messageBox(), 'Hello');
    await userEvent.click(sendButton());
    await waitFor(() => expect(apiClient.post).toHaveBeenCalled());
    expect(postedBody()).not.toHaveProperty('error_ref');
  });
});
