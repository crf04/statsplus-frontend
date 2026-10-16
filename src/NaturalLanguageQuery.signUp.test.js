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

test('a signed-out visitor who edits the box during sign-up gets the query they submitted', async () => {
  let resolveSignIn;
  const signIn = jest.fn(() => new Promise((resolve) => (resolveSignIn = resolve)));
  mockAuth = { isAuthenticated: false, currentUser: null, signInWithGoogle: signIn };
  apiClient.post.mockReset();
  apiClient.post.mockResolvedValue({ data: { confidence: 0 } });
  const onFiltersApplied = jest.fn();
  const tree = () => (
    <MemoryRouter>
      <NaturalLanguageQuery onFiltersApplied={onFiltersApplied} />
    </MemoryRouter>
  );
  const view = render(tree());
  const input = screen.getByRole('textbox');
  fireEvent.change(input, { target: { value: 'LeBron last 10 games' } });
  fireEvent.submit(input.closest('form'));
  fireEvent.change(input, { target: { value: 'something else' } });

  await act(async () => {
    resolveSignIn({ uid: 'u1' });
  });
  mockAuth = { isAuthenticated: true, currentUser: { uid: 'u1' }, signInWithGoogle: signIn };
  await act(async () => view.rerender(tree()));

  expect(apiClient.post).toHaveBeenCalledTimes(1);
  expect(apiClient.post.mock.calls[0][1]).toEqual({ query: 'LeBron last 10 games' });
});
