import { renderHook, waitFor } from '@testing-library/react';
import { useTargetBacktests } from './useTargets';
import { fetchTargetBacktests } from './targetsApi';

jest.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ isAuthenticated: true, loading: false, currentUser: { uid: 'alice' } }),
}));
jest.mock('./targetsApi', () => ({ fetchTargetBacktests: jest.fn() }));

beforeEach(() => jest.clearAllMocks());

const ready = { targetId: 7, status: 'ready', backtest: { season: '2025-26' } };

test('keeps only ready Backtests, by Target id', async () => {
  fetchTargetBacktests.mockResolvedValue([
    ready,
    { targetId: 8, status: 'uncached' },
    { targetId: 9, status: 'error', error: 'Unable to read this Backtest.' },
  ]);
  const { result } = renderHook(() => useTargetBacktests(true));
  await waitFor(() => expect(result.current).toEqual({ 7: { season: '2025-26' } }));
});

test('a refresh that fails shows no lean rather than the last batch', async () => {
  fetchTargetBacktests.mockResolvedValueOnce([ready]);
  const { result, rerender } = renderHook(({ enabled }) => useTargetBacktests(enabled), {
    initialProps: { enabled: true },
  });
  await waitFor(() => expect(result.current).toEqual({ 7: { season: '2025-26' } }));

  let reject;
  fetchTargetBacktests.mockReturnValueOnce(new Promise((_, fail) => (reject = fail)));
  rerender({ enabled: false });
  expect(result.current).toEqual({});
  rerender({ enabled: true });
  // While the new read is in flight, the old batch is not shown either.
  expect(result.current).toEqual({});
  reject(new Error('Network Error'));
  await waitFor(() => expect(fetchTargetBacktests).toHaveBeenCalledTimes(2));
  expect(result.current).toEqual({});
});
