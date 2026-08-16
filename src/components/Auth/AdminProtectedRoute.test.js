import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AdminProtectedRoute from './AdminProtectedRoute';

const mockAuthState = {
  isAuthenticated: false,
  loading: false,
  isAdmin: false,
  adminLoading: false,
  adminStatus: 'signed_out',
  adminError: null,
  refreshAdminClaims: jest.fn(),
  signInWithGoogle: jest.fn(),
  error: null,
};

jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => mockAuthState,
}));

const renderRoute = () =>
  render(
    <MemoryRouter>
      <AdminProtectedRoute>
        <p>Authorized diagnostics</p>
      </AdminProtectedRoute>
    </MemoryRouter>,
  );

beforeEach(() => {
  Object.assign(mockAuthState, {
    isAuthenticated: false,
    loading: false,
    isAdmin: false,
    adminLoading: false,
    adminStatus: 'signed_out',
    adminError: null,
  });
  mockAuthState.refreshAdminClaims.mockClear();
});

test('shows sign-in state while signed out', () => {
  renderRoute();
  expect(
    screen.getByRole('heading', { name: 'Sign in to access Operations Console' }),
  ).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Sign in with Google' })).toBeInTheDocument();
  expect(screen.queryByText('Authorized diagnostics')).not.toBeInTheDocument();
});

test('shows a loading state while refreshing token claims', () => {
  Object.assign(mockAuthState, {
    isAuthenticated: true,
    adminLoading: true,
    adminStatus: 'unknown',
  });
  renderRoute();
  expect(screen.getByRole('status')).toHaveTextContent('Checking administrator access');
});

test('fails closed for ordinary users', () => {
  Object.assign(mockAuthState, { isAuthenticated: true, adminStatus: 'forbidden' });
  renderRoute();
  expect(
    screen.getByRole('heading', { name: 'Administrator permission required' }),
  ).toBeInTheDocument();
  expect(screen.queryByText('Authorized diagnostics')).not.toBeInTheDocument();
});

test('renders the console only after administrator authorization', () => {
  Object.assign(mockAuthState, { isAuthenticated: true, isAdmin: true, adminStatus: 'authorized' });
  renderRoute();
  expect(screen.getByText('Authorized diagnostics')).toBeInTheDocument();
});

test('surfaces Firebase configuration failure and retries with forced claim refresh', () => {
  Object.assign(mockAuthState, {
    isAuthenticated: true,
    adminStatus: 'configuration_error',
    adminError: 'Firebase configuration is incomplete.',
  });
  renderRoute();
  expect(
    screen.getByRole('heading', { name: 'Administrator access could not be verified' }),
  ).toBeInTheDocument();
  expect(screen.getByRole('alert')).toHaveTextContent('Firebase configuration is incomplete.');
  fireEvent.click(screen.getByRole('button', { name: 'Retry permission check' }));
  expect(mockAuthState.refreshAdminClaims).toHaveBeenCalledWith(undefined, true);
});
