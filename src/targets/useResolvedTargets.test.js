import { act, renderHook, waitFor } from '@testing-library/react';
import { useResolvedTargets } from './useTargets';
import { fetchResolvedTargets } from './targetsApi';
import { clearRevisitCaches } from '../revisitCache';
jest.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ isAuthenticated: true, loading: false, currentUser: { uid: 'alice' } }),
}));
jest.mock('./targetsApi', () => ({ fetchResolvedTargets: jest.fn() }));
beforeEach(() => {
  clearRevisitCaches();
  jest.clearAllMocks();
  fetchResolvedTargets.mockImplementation(({ date }) =>
    Promise.resolve({ slateDate: date || '2020-01-01', entries: [] }),
  );
});
test('historical revisits reuse decoded evidence while reload bypasses it', async () => {
  const { result, rerender } = renderHook(({ date }) => useResolvedTargets(date), {
    initialProps: { date: '2020-01-03' },
  });
  await waitFor(() => expect(result.current.status).toBe('ready'));
  const originalEntries = result.current.entries;
  rerender({ date: '2020-01-02' });
  await waitFor(() => expect(result.current.status).toBe('ready'));
  rerender({ date: '2020-01-03' });
  await waitFor(() => expect(result.current.status).toBe('ready'));
  expect(fetchResolvedTargets).toHaveBeenCalledTimes(2);
  expect(result.current.slateDate).toBe('2020-01-03');
  expect(result.current.entries).toBe(originalEntries);
  act(() => result.current.reload());
  await waitFor(() => expect(fetchResolvedTargets).toHaveBeenCalledTimes(3));
});
test('implicit current slate always fetches on remount', async () => {
  const first = renderHook(() => useResolvedTargets());
  await waitFor(() => expect(first.result.current.status).toBe('ready'));
  first.unmount();
  const next = renderHook(() => useResolvedTargets());
  await waitFor(() => expect(next.result.current.status).toBe('ready'));
  expect(fetchResolvedTargets).toHaveBeenCalledTimes(2);
});
