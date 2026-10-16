import { readRevisit } from '../revisitCache';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { getIdTokenResult, onIdTokenChanged, signInWithPopup } from 'firebase/auth';
import { AuthProvider, useAuth } from './AuthContext';
import { reportWaitlisted } from '../utils/waitlistSignal';

function AuthProbe() {
  const auth = useAuth();
  return (
    <div>
      <output data-testid="user">{auth.currentUser?.uid || 'signed-out'}</output>
      <output data-testid="loading">{String(auth.loading)}</output>
      <output data-testid="waitlist">{auth.waitlist?.message || 'none'}</output>
      <output data-testid="admin">{String(auth.isAdmin)}</output>
      <output data-testid="admin-status">{auth.adminStatus}</output>
      <output data-testid="admin-error">{auth.adminError || ''}</output>
      <output data-testid="error">{auth.error || ''}</output>
      <button type="button" onClick={() => auth.refreshAdminClaims(undefined, true)}>
        Refresh claims
      </button>
      <button type="button" onClick={() => auth.signInWithGoogle({ silent: true }).catch(() => {})}>
        Quiet sign-in
      </button>
      <button type="button" onClick={() => auth.signInWithGoogle().catch(() => {})}>
        Sign-in
      </button>
    </div>
  );
}

const configuredAuth = {};
const renderProvider = (props = {}) =>
  render(
    <AuthProvider authClient={configuredAuth} {...props}>
      <AuthProbe />
    </AuthProvider>,
  );

beforeEach(() => {
  jest.clearAllMocks();
  getIdTokenResult.mockResolvedValue({ claims: {} });
  onIdTokenChanged.mockImplementation((_auth, next) => {
    next(null);
    return jest.fn();
  });
});

test('represents a signed-out Firebase listener state', async () => {
  renderProvider();
  await waitFor(() => expect(screen.getByTestId('admin-status')).toHaveTextContent('signed_out'));
  expect(screen.getByTestId('user')).toHaveTextContent('signed-out');
  expect(screen.getByTestId('loading')).toHaveTextContent('false');
  expect(screen.getByTestId('admin')).toHaveTextContent('false');
});

test.each([{ admin: true }, { role: 'admin' }, { roles: ['viewer', 'admin'] }])(
  'accepts a supported Firebase admin claim shape: %j',
  async (claims) => {
    getIdTokenResult.mockResolvedValue({ claims });
    onIdTokenChanged.mockImplementation((_auth, next) => {
      next({ uid: 'admin-1' });
      return jest.fn();
    });
    renderProvider();
    await waitFor(() => expect(screen.getByTestId('admin-status')).toHaveTextContent('authorized'));
    expect(screen.getByTestId('admin')).toHaveTextContent('true');
  },
);

test('follows Firebase listener transitions and token refresh claim changes', async () => {
  let listener;
  onIdTokenChanged.mockImplementation((_auth, next) => {
    listener = next;
    return jest.fn();
  });
  getIdTokenResult
    .mockResolvedValueOnce({ claims: { admin: true } })
    .mockResolvedValueOnce({ claims: {} });
  renderProvider();

  await act(async () => listener({ uid: 'admin-1' }));
  await waitFor(() => expect(screen.getByTestId('admin-status')).toHaveTextContent('authorized'));

  fireEvent.click(screen.getByRole('button', { name: 'Refresh claims' }));
  await waitFor(() => expect(screen.getByTestId('admin-status')).toHaveTextContent('forbidden'));
  expect(getIdTokenResult).toHaveBeenLastCalledWith({ uid: 'admin-1' }, true);

  await act(async () => listener(null));
  expect(screen.getByTestId('admin-status')).toHaveTextContent('signed_out');
});

test('keeps the settled admin verdict while a token refresh re-checks the same user', async () => {
  let listener;
  onIdTokenChanged.mockImplementation((_auth, next) => {
    listener = next;
    return jest.fn();
  });
  let resolveRecheck;
  getIdTokenResult
    .mockResolvedValueOnce({ claims: { admin: true } })
    .mockImplementationOnce(() => new Promise((resolve) => (resolveRecheck = resolve)))
    .mockImplementationOnce(() => new Promise(() => {}));
  function AdminLoadingProbe() {
    const auth = useAuth();
    return <output data-testid="admin-loading">{String(auth.adminLoading)}</output>;
  }
  render(
    <AuthProvider authClient={configuredAuth}>
      <AuthProbe />
      <AdminLoadingProbe />
    </AuthProvider>,
  );

  await act(async () => listener({ uid: 'admin-1' }));
  await waitFor(() => expect(screen.getByTestId('admin-status')).toHaveTextContent('authorized'));

  // Firebase's hourly token refresh fires the listener again for the same uid;
  // guarded routes must not fall back to a spinner and unmount their page.
  await act(async () => {
    listener({ uid: 'admin-1' });
  });
  expect(screen.getByTestId('admin-loading')).toHaveTextContent('false');
  expect(screen.getByTestId('admin-status')).toHaveTextContent('authorized');
  await act(async () => resolveRecheck({ claims: {} }));
  expect(screen.getByTestId('admin-status')).toHaveTextContent('forbidden');

  // A different account has no verdict yet, so it is checked visibly.
  await act(async () => {
    listener({ uid: 'other-2' });
  });
  expect(screen.getByTestId('admin-loading')).toHaveTextContent('true');
});

test('reports missing Firebase configuration without leaving admin loading', async () => {
  renderProvider({ authClient: null });
  await waitFor(() =>
    expect(screen.getByTestId('admin-status')).toHaveTextContent('configuration_error'),
  );
  expect(screen.getByTestId('admin-error')).toHaveTextContent('not configured');
  expect(screen.getByTestId('admin')).toHaveTextContent('false');
});

test('reports claim refresh and Firebase listener errors', async () => {
  let reportListenerError;
  onIdTokenChanged.mockImplementation((_auth, next, error) => {
    reportListenerError = error;
    next({ uid: 'admin-1' });
    return jest.fn();
  });
  getIdTokenResult.mockRejectedValue(new Error('token refresh failed'));
  renderProvider();
  await waitFor(() =>
    expect(screen.getByTestId('admin-error')).toHaveTextContent('refresh failed'),
  );

  act(() => reportListenerError(new Error('listener failed')));
  await waitFor(() =>
    expect(screen.getByTestId('admin-error')).toHaveTextContent('listener failed'),
  );
  expect(screen.getByTestId('user')).toHaveTextContent('signed-out');
});

test('auth listener clears cached results and fences pending reads with no consuming page mounted', async () => {
  let listener;
  onIdTokenChanged.mockImplementation((_auth, next) => {
    listener = next;
    return jest.fn();
  });
  renderProvider();
  await act(async () => listener({ uid: 'alice' }));
  const load = jest.fn().mockResolvedValue('cached');
  await readRevisit('logs', 'alice', 'done', load);
  let finish;
  const pending = readRevisit(
    'logs',
    'alice',
    'pending',
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  await act(async () => listener(null));
  finish('old');
  await pending;
  await act(async () => listener({ uid: 'alice' }));
  await readRevisit('logs', 'alice', 'done', load);
  await readRevisit('logs', 'alice', 'pending', load);
  expect(load).toHaveBeenCalledTimes(3);
});

describe('sign-in', () => {
  test('a silent sign-in keeps the page while the popup is open and records no failure', async () => {
    let closePopup;
    signInWithPopup.mockReturnValue(
      new Promise((_resolve, reject) => {
        closePopup = () => reject(new Error('popup closed'));
      }),
    );
    jest.spyOn(console, 'error').mockImplementation(() => {});
    renderProvider({ authProvider: {} });
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));

    fireEvent.click(screen.getByRole('button', { name: 'Quiet sign-in' }));
    await waitFor(() => expect(signInWithPopup).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId('loading')).toHaveTextContent('false');
    await act(async () => closePopup());

    expect(screen.getByTestId('error')).toHaveTextContent('');
    expect(screen.getByTestId('loading')).toHaveTextContent('false');
  });

  test('a plain failed sign-in is recorded and holds the loading screen until it ends', async () => {
    let closePopup;
    signInWithPopup.mockReturnValue(
      new Promise((_resolve, reject) => {
        closePopup = () => reject(new Error('popup closed'));
      }),
    );
    jest.spyOn(console, 'error').mockImplementation(() => {});
    renderProvider({ authProvider: {} });
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));

    fireEvent.click(screen.getByRole('button', { name: 'Sign-in' }));
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('true'));
    await act(async () => closePopup());

    expect(screen.getByTestId('error')).toHaveTextContent('popup closed');
    expect(screen.getByTestId('loading')).toHaveTextContent('false');
  });
});

describe('waitlist', () => {
  const message = "The beta is full right now. You're on the waitlist and we'll let you in soon.";
  let listener;
  beforeEach(() => {
    onIdTokenChanged.mockImplementation((_auth, next) => {
      listener = next;
      return jest.fn();
    });
  });

  test('a waitlisted response puts the signed-in user on the waitlist until they leave', async () => {
    renderProvider();
    await act(async () => listener({ uid: 'u1', email: 'a@example.com' }));
    expect(screen.getByTestId('waitlist')).toHaveTextContent('none');

    act(() => reportWaitlisted(message, 'u1'));
    expect(screen.getByTestId('waitlist')).toHaveTextContent(message);

    await act(async () => listener(null));
    expect(screen.getByTestId('waitlist')).toHaveTextContent('none');
  });

  test('a different account does not inherit the waitlist', async () => {
    renderProvider();
    await act(async () => listener({ uid: 'u1' }));
    act(() => reportWaitlisted(message, 'u1'));
    await act(async () => listener({ uid: 'u2' }));
    expect(screen.getByTestId('waitlist')).toHaveTextContent('none');
  });

  test('a token refresh for the same account keeps the waitlist', async () => {
    renderProvider();
    await act(async () => listener({ uid: 'u1' }));
    act(() => reportWaitlisted(message, 'u1'));
    await act(async () => listener({ uid: 'u1' }));
    expect(screen.getByTestId('waitlist')).toHaveTextContent(message);
  });

  test('a waitlisted response that arrives while signed out is ignored', async () => {
    renderProvider();
    await act(async () => listener(null));
    act(() => reportWaitlisted(message, 'u1'));
    expect(screen.getByTestId('waitlist')).toHaveTextContent('none');
  });

  test('a slow answer to the previous account’s request does not waitlist the current account', async () => {
    renderProvider();
    await act(async () => listener({ uid: 'u1' }));
    await act(async () => listener({ uid: 'u2' }));
    act(() => reportWaitlisted(message, 'u1'));
    expect(screen.getByTestId('waitlist')).toHaveTextContent('none');
  });

  test('a waitlisted response from a request sent with no account is ignored', async () => {
    renderProvider();
    await act(async () => listener({ uid: 'u1' }));
    act(() => reportWaitlisted(message, undefined));
    expect(screen.getByTestId('waitlist')).toHaveTextContent('none');
  });
});
