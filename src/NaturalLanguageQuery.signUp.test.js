import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import NaturalLanguageQuery from './NaturalLanguageQuery';
import apiClient from './utils/axiosConfig';

let mockAuth;
jest.mock('./contexts/AuthContext', () => ({
  useAuth: () => mockAuth,
}));

jest.mock('./utils/axiosConfig', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}));

const tree = (onFiltersApplied) => (
  <MemoryRouter>
    <NaturalLanguageQuery onFiltersApplied={onFiltersApplied} />
  </MemoryRouter>
);

beforeEach(() => {
  window.sessionStorage.clear();
  apiClient.post.mockReset();
  apiClient.post.mockResolvedValue({ data: { confidence: 0 } });
});

test('a signed-out visitor who submits a query gets exactly that query after the sign-in redirect', async () => {
  const signIn = jest.fn().mockResolvedValue(undefined);
  mockAuth = {
    isAuthenticated: false,
    currentUser: null,
    loading: false,
    signInWithGoogle: signIn,
  };
  const first = render(tree(jest.fn()));
  const input = screen.getByRole('textbox');
  fireEvent.change(input, { target: { value: 'LeBron last 10 games' } });
  await act(async () => {
    fireEvent.submit(input.closest('form'));
  });
  expect(signIn).toHaveBeenCalledTimes(1);
  expect(apiClient.post).not.toHaveBeenCalled();

  // The redirect reloads the page: a fresh mount, now signed in.
  first.unmount();
  mockAuth = {
    isAuthenticated: true,
    currentUser: { uid: 'u1' },
    loading: false,
    signInWithGoogle: signIn,
  };
  await act(async () => {
    render(tree(jest.fn()));
  });

  expect(apiClient.post).toHaveBeenCalledTimes(1);
  expect(apiClient.post.mock.calls[0][1]).toEqual({ query: 'LeBron last 10 games' });
  expect(screen.getByRole('textbox')).toHaveValue('LeBron last 10 games');
});

test('coming back from a failed sign-in runs no query', async () => {
  const signIn = jest.fn().mockResolvedValue(undefined);
  mockAuth = {
    isAuthenticated: false,
    currentUser: null,
    loading: false,
    signInWithGoogle: signIn,
  };
  const first = render(tree(jest.fn()));
  const input = screen.getByRole('textbox');
  fireEvent.change(input, { target: { value: 'LeBron last 10 games' } });
  await act(async () => {
    fireEvent.submit(input.closest('form'));
  });
  first.unmount();
  await act(async () => {
    render(tree(jest.fn()));
  });

  expect(apiClient.post).not.toHaveBeenCalled();
});
