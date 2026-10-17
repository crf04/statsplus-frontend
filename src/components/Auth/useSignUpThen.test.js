import { act, renderHook } from '@testing-library/react';
import { SIGN_UP_THEN_STORAGE_KEY, useSignUpThen } from './useSignUpThen';

let mockAuth;
jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => mockAuth,
}));

const signedOut = (signInWithGoogle = jest.fn().mockResolvedValue(undefined)) => ({
  isAuthenticated: false,
  currentUser: null,
  loading: false,
  signInWithGoogle,
});
const signedInAs = (uid) => ({
  isAuthenticated: true,
  currentUser: { uid },
  loading: false,
  signInWithGoogle: jest.fn(),
});
const stored = () => JSON.parse(window.sessionStorage.getItem(SIGN_UP_THEN_STORAGE_KEY));

beforeEach(() => window.sessionStorage.clear());

describe('useSignUpThen', () => {
  test('a signed-out trigger stores the key and arguments, starts sign-in, and runs nothing yet', async () => {
    const signIn = jest.fn().mockResolvedValue(undefined);
    const action = jest.fn();
    mockAuth = signedOut(signIn);
    const { result } = renderHook(() => useSignUpThen('query', action));

    await act(async () => {
      await result.current('LeBron last 10 games');
    });

    expect(signIn).toHaveBeenCalledWith({ silent: true });
    expect(stored()).toMatchObject({ key: 'query', args: ['LeBron last 10 games'] });
    expect(action).not.toHaveBeenCalled();
  });

  test('a newer trigger replaces the stored entry', async () => {
    mockAuth = signedOut();
    const { result } = renderHook(() => useSignUpThen('query', jest.fn()));
    await act(async () => {
      await result.current('first');
    });
    await act(async () => {
      await result.current('second');
    });

    expect(stored()).toMatchObject({ key: 'query', args: ['second'] });
  });

  test('a sign-in that fails to start forgets the action', async () => {
    mockAuth = signedOut(jest.fn().mockRejectedValue(new Error('redirect failed')));
    const { result } = renderHook(() => useSignUpThen('query', jest.fn()));

    await act(async () => {
      await result.current('LeBron');
    });

    expect(window.sessionStorage.getItem(SIGN_UP_THEN_STORAGE_KEY)).toBeNull();
  });

  test('a signed-in trigger runs the action at once and stores nothing', async () => {
    const action = jest.fn();
    mockAuth = signedInAs('u1');
    const { result } = renderHook(() => useSignUpThen('query', action));

    await act(async () => {
      await result.current('Curry');
    });

    expect(action.mock.calls).toEqual([['Curry']]);
    expect(window.sessionStorage.getItem(SIGN_UP_THEN_STORAGE_KEY)).toBeNull();
  });

  describe('on return from the redirect', () => {
    const entry = (key, args, at = Date.now()) =>
      window.sessionStorage.setItem(SIGN_UP_THEN_STORAGE_KEY, JSON.stringify({ key, args, at }));

    test('runs the stored action exactly once with the original arguments, then clears the entry', async () => {
      const action = jest.fn();
      entry('query', ['LeBron last 10 games']);
      mockAuth = signedInAs('u1');
      const { rerender } = renderHook(() => useSignUpThen('query', action));
      await act(async () => rerender());

      expect(action.mock.calls).toEqual([['LeBron last 10 games']]);
      expect(window.sessionStorage.getItem(SIGN_UP_THEN_STORAGE_KEY)).toBeNull();
    });

    test('waits for auth to settle, then runs for the signed-in account', async () => {
      const action = jest.fn();
      entry('query', ['Curry']);
      mockAuth = { ...signedOut(), loading: true };
      const { rerender } = renderHook(() => useSignUpThen('query', action));
      expect(action).not.toHaveBeenCalled();

      mockAuth = signedInAs('u1');
      await act(async () => rerender());

      expect(action.mock.calls).toEqual([['Curry']]);
    });

    test('returning signed out runs nothing and clears the entry', async () => {
      const action = jest.fn();
      entry('query', ['Curry']);
      mockAuth = signedOut();
      renderHook(() => useSignUpThen('query', action));

      expect(action).not.toHaveBeenCalled();
      expect(window.sessionStorage.getItem(SIGN_UP_THEN_STORAGE_KEY)).toBeNull();
    });

    test('an entry for another action is left alone and does not run', async () => {
      const action = jest.fn();
      entry('browse', []);
      mockAuth = signedInAs('u1');
      renderHook(() => useSignUpThen('query', action));

      expect(action).not.toHaveBeenCalled();
      expect(stored()).toMatchObject({ key: 'browse', args: [] });
    });

    test('an entry from a long-past attempt does not run', async () => {
      const action = jest.fn();
      entry('query', ['Curry'], Date.now() - 60 * 60 * 1000);
      mockAuth = signedInAs('u1');
      renderHook(() => useSignUpThen('query', action));

      expect(action).not.toHaveBeenCalled();
    });
  });
});
