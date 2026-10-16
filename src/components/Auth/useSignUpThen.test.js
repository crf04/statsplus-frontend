import { act, renderHook } from '@testing-library/react';
import { useSignUpThen } from './useSignUpThen';

let mockAuth;
jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => mockAuth,
}));

const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

const signedOut = (signInWithGoogle) => ({
  isAuthenticated: false,
  currentUser: null,
  signInWithGoogle,
});
const signedInAs = (uid, signInWithGoogle) => ({
  isAuthenticated: true,
  currentUser: { uid },
  signInWithGoogle,
});

describe('useSignUpThen', () => {
  test('a double click opens one popup; after it is cancelled a retry that succeeds runs the action once', async () => {
    const first = deferred();
    const second = deferred();
    const signIn = jest.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const action = jest.fn();
    mockAuth = signedOut(signIn);
    const { result, rerender } = renderHook(() => useSignUpThen(action));

    let a;
    let b;
    act(() => {
      a = result.current('ladder');
      b = result.current('ladder');
    });
    expect(signIn).toHaveBeenCalledTimes(1);

    await act(async () => {
      first.reject(new Error('popup closed'));
      await Promise.all([a, b]);
    });
    expect(action).not.toHaveBeenCalled();

    let c;
    act(() => {
      c = result.current('retry');
    });
    expect(signIn).toHaveBeenCalledTimes(2);
    await act(async () => {
      mockAuth = signedInAs('u1', signIn);
      rerender();
      second.resolve({ uid: 'u1' });
      await c;
    });
    expect(action).toHaveBeenCalledTimes(1);
    expect(action).toHaveBeenCalledWith('retry');
  });

  test('another account signing in while the popup is open runs nothing', async () => {
    const popup = deferred();
    const signIn = jest.fn().mockReturnValue(popup.promise);
    const action = jest.fn();
    mockAuth = signedOut(signIn);
    const { result, rerender } = renderHook(() => useSignUpThen(action));

    let pending;
    act(() => {
      pending = result.current('query');
    });
    await act(async () => {
      mockAuth = signedInAs('other-tab', signIn);
      rerender();
    });
    expect(action).not.toHaveBeenCalled();

    await act(async () => {
      popup.reject(new Error('popup closed'));
      await pending;
    });
    expect(action).not.toHaveBeenCalled();
  });

  test('runs once for the account the popup returned, when mockAuth state reflects it', async () => {
    const popup = deferred();
    const signIn = jest.fn().mockReturnValue(popup.promise);
    const action = jest.fn();
    mockAuth = signedOut(signIn);
    const { result, rerender } = renderHook(() => useSignUpThen(action));

    let pending;
    act(() => {
      pending = result.current('query');
    });
    await act(async () => {
      popup.resolve({ uid: 'u1' });
      await pending;
    });
    expect(action).not.toHaveBeenCalled();

    await act(async () => {
      mockAuth = signedInAs('u1', signIn);
      rerender();
    });
    expect(action).toHaveBeenCalledTimes(1);
    expect(action).toHaveBeenCalledWith('query');
    await act(async () => rerender());
    expect(action).toHaveBeenCalledTimes(1);
  });

  // Auth can render the account before the popup's own promise settles.
  const signUpWhereAuthSettlesFirst = async (result, rerender, signIn, popup, uid, arg) => {
    let pending;
    act(() => {
      pending = result.current(arg);
    });
    await act(async () => {
      mockAuth = signedInAs(uid, signIn);
      rerender();
    });
    await act(async () => {
      popup.resolve({ uid });
      await pending;
    });
  };

  test('a second sign-up to the same account still runs its query when auth settles before the popup', async () => {
    const first = deferred();
    const second = deferred();
    const signIn = jest.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const action = jest.fn();
    mockAuth = signedOut(signIn);
    const { result, rerender } = renderHook(() => useSignUpThen(action));

    await signUpWhereAuthSettlesFirst(result, rerender, signIn, first, 'u1', 'first query');
    await act(async () => {
      mockAuth = signedOut(signIn);
      rerender();
    });
    await signUpWhereAuthSettlesFirst(result, rerender, signIn, second, 'u1', 'second query');

    expect(action.mock.calls).toEqual([['first query'], ['second query']]);
  });

  test('a popup that returns no account forgets the action, so the next click opens a popup', async () => {
    const signIn = jest.fn().mockResolvedValueOnce(null).mockReturnValueOnce(deferred().promise);
    const action = jest.fn();
    mockAuth = signedOut(signIn);
    const { result } = renderHook(() => useSignUpThen(action));

    await act(async () => {
      await result.current('query');
    });
    act(() => {
      result.current('query');
    });

    expect(signIn).toHaveBeenCalledTimes(2);
    expect(action).not.toHaveBeenCalled();
  });
});
