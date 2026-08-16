import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { getIdTokenResult, onIdTokenChanged } from 'firebase/auth';
import { AuthProvider, useAuth } from './AuthContext';

function AuthProbe() {
  const auth = useAuth();
  return (
    <div>
      <output data-testid="user">{auth.currentUser?.uid || 'signed-out'}</output>
      <output data-testid="loading">{String(auth.loading)}</output>
      <output data-testid="admin">{String(auth.isAdmin)}</output>
      <output data-testid="admin-status">{auth.adminStatus}</output>
      <output data-testid="admin-error">{auth.adminError || ''}</output>
      <button type="button" onClick={() => auth.refreshAdminClaims(undefined, true)}>
        Refresh claims
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
