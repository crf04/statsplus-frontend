import { act, renderHook, waitFor } from '@testing-library/react';
import { useResolvedTargets } from './useTargets';
import { fetchResolvedTargets } from './targetsApi';
import { clearRevisitCaches } from '../revisitCache';
import { seasonRefusalOr } from '../servingSeason';
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
test('implicit current slate reuses a revisit within the window instead of refetching', async () => {
  const first = renderHook(() => useResolvedTargets());
  await waitFor(() => expect(first.result.current.status).toBe('ready'));
  first.unmount();
  const next = renderHook(() => useResolvedTargets());
  await waitFor(() => expect(next.result.current.status).toBe('ready'));
  expect(fetchResolvedTargets).toHaveBeenCalledTimes(1);
});

test('implicit current slate reload still bypasses the cache', async () => {
  const { result } = renderHook(() => useResolvedTargets());
  await waitFor(() => expect(result.current.status).toBe('ready'));
  act(() => result.current.reload());
  await waitFor(() => expect(fetchResolvedTargets).toHaveBeenCalledTimes(2));
});

test('an explicit historical date and the implicit current slate never share a cache entry', async () => {
  const historical = renderHook(() => useResolvedTargets('2020-01-03'));
  await waitFor(() => expect(historical.result.current.status).toBe('ready'));
  historical.unmount();
  const current = renderHook(() => useResolvedTargets());
  await waitFor(() => expect(current.result.current.status).toBe('ready'));
  expect(fetchResolvedTargets).toHaveBeenCalledTimes(2);
  expect(fetchResolvedTargets).toHaveBeenNthCalledWith(
    1,
    expect.objectContaining({ date: '2020-01-03' }),
  );
  expect(fetchResolvedTargets).toHaveBeenNthCalledWith(
    2,
    expect.objectContaining({ date: undefined }),
  );
});

/*
 * A season fallback (crf04/statsplus#427) belongs to the reader that asked for
 * it. These run signed in as alice, so the revisit cache is live.
 */
const refused = () =>
  seasonRefusalOr({
    response: {
      status: 503,
      data: { error: { code: 'season_unavailable', message: '2026-27 is not offered.' } },
    },
  });
const refuseSeason = () =>
  fetchResolvedTargets.mockImplementation(({ season }) =>
    season ? Promise.reject(refused()) : Promise.resolve({ slateDate: '2026-11-04', entries: [] }),
  );

test('a strict reader keeps a season refusal and never reads without the season', async () => {
  refuseSeason();
  const { result } = renderHook(() => useResolvedTargets(undefined, { season: '2026-27' }));
  await waitFor(() => expect(result.current.status).toBe('error'));
  expect(result.current.error).toBe('2026-27 is not offered.');
  expect(fetchResolvedTargets.mock.calls.map(([request]) => request.season)).toEqual(['2026-27']);
});

test('a strict reader never gets a fallback another reader cached', async () => {
  refuseSeason();
  const fallback = renderHook(() =>
    useResolvedTargets(undefined, { season: '2026-27', orDefault: true }),
  );
  await waitFor(() => expect(fallback.result.current.status).toBe('ready'));
  expect(fallback.result.current.slateDate).toBe('2026-11-04');
  fallback.unmount();

  const strict = renderHook(() => useResolvedTargets(undefined, { season: '2026-27' }));
  await waitFor(() => expect(strict.result.current.status).toBe('error'));
  expect(fetchResolvedTargets.mock.calls.map(([request]) => request.season)).toEqual([
    '2026-27',
    undefined,
    '2026-27',
  ]);
});

test('a fallback reader keeps a failure that is not a season refusal', async () => {
  fetchResolvedTargets.mockRejectedValue({
    response: {
      status: 503,
      data: { error: { code: 'provider_unavailable', message: 'Targets are unavailable.' } },
    },
  });
  const { result } = renderHook(() =>
    useResolvedTargets(undefined, { season: '2026-27', orDefault: true }),
  );
  await waitFor(() => expect(result.current.status).toBe('error'));
  expect(result.current.error).toBe('Targets are unavailable.');
  expect(fetchResolvedTargets).toHaveBeenCalledTimes(1);
});
