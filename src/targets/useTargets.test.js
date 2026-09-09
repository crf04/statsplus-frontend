import { act, renderHook, waitFor } from '@testing-library/react';
import { useTargets } from './useTargets';
import { fetchTargets } from './targetsApi';

jest.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ isAuthenticated: true, loading: false, currentUser: { uid: 'alice' } }),
}));
jest.mock('./targetsApi', () => ({ fetchTargets: jest.fn() }));

const target = (id, title) => ({
  id,
  opponent: 'OKC',
  title,
  note: '',
  createdAt: '2026-01-01T00:00:00Z',
  qualifiers: [
    { base: 'shot_zones', sliceKey: 'Corner 3', comparator: 'at_or_above', threshold: 0.4 },
  ],
});

beforeEach(() => {
  jest.clearAllMocks();
});

/*
 * TargetsPage passes keepPrevious the way TargetDetailPage already does, so
 * that a reload does not blank the list while it is in flight. This proves
 * the option actually does that for the list read, the same read the Targets
 * page uses.
 */
test('a reload with keepPrevious keeps the previous list on screen while it is in flight', async () => {
  const firstBatch = [target(1, 'A')];
  const secondBatch = [target(1, 'A'), target(2, 'B')];
  let resolveSecond;
  fetchTargets.mockResolvedValueOnce(firstBatch).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolveSecond = resolve;
      }),
  );

  const { result } = renderHook(() => useTargets({ keepPrevious: true }));
  await waitFor(() => expect(result.current.status).toBe('ready'));
  expect(result.current.targets).toEqual(firstBatch);

  act(() => result.current.reload());
  expect(result.current.status).toBe('loading');
  expect(result.current.targets).toEqual(firstBatch);

  await act(async () => resolveSecond(secondBatch));
  await waitFor(() => expect(result.current.status).toBe('ready'));
  expect(result.current.targets).toEqual(secondBatch);
});

test('without keepPrevious a reload blanks the list while it is in flight', async () => {
  const firstBatch = [target(1, 'A')];
  let resolveSecond;
  fetchTargets.mockResolvedValueOnce(firstBatch).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolveSecond = resolve;
      }),
  );

  const { result } = renderHook(() => useTargets());
  await waitFor(() => expect(result.current.status).toBe('ready'));
  expect(result.current.targets).toEqual(firstBatch);

  act(() => result.current.reload());
  expect(result.current.status).toBe('loading');
  expect(result.current.targets).toEqual([]);

  await act(async () => resolveSecond(firstBatch));
  await waitFor(() => expect(result.current.status).toBe('ready'));
});
