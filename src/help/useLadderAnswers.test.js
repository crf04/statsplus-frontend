import { act, renderHook, waitFor } from '@testing-library/react';
import { useLadderAnswers } from './useLadderAnswers';
import { fetchGameLogsData } from '../gameLogsApi';
import { QUERY_LADDER } from './queryHelp';

jest.mock('../gameLogsApi', () => ({
  fetchGameLogsData: jest.fn(),
  isRequestCancelled: () => false,
}));

const logs = (points) => ({
  gameLogs: points.map((PTS) => ({ PTS })),
  averages: [{ PTS: points.reduce((a, b) => a + b, 0) / points.length }],
});

afterEach(() => jest.clearAllMocks());

test("reads each rung's own Filter Set and answers in rung order", async () => {
  fetchGameLogsData
    .mockResolvedValueOnce(logs([20, 30]))
    .mockResolvedValueOnce(logs([22]))
    .mockResolvedValueOnce(logs([31, 33, 35]));
  const { result } = renderHook(() => useLadderAnswers('reader-a'));

  await waitFor(() => expect(result.current).not.toBeNull());
  expect(fetchGameLogsData.mock.calls.map(([filters]) => filters)).toEqual(
    QUERY_LADDER.map((step) => step.filters),
  );
  expect(result.current).toEqual([
    { points: 25, games: 2, series: [20, 30] },
    { points: 22, games: 1, series: [22] },
    { points: 33, games: 3, series: [31, 33, 35] },
  ]);
});

test('signed out reads nothing', () => {
  const { result } = renderHook(() => useLadderAnswers(null));

  expect(result.current).toBeNull();
  expect(fetchGameLogsData).not.toHaveBeenCalled();
});

test('one failed rung leaves the ladder without answers', async () => {
  fetchGameLogsData
    .mockResolvedValueOnce(logs([20]))
    .mockRejectedValueOnce(new Error('boom'))
    .mockResolvedValueOnce(logs([31]));
  const { result } = renderHook(() => useLadderAnswers('reader-a'));

  await waitFor(() => expect(fetchGameLogsData).toHaveBeenCalledTimes(3));
  // Let the rejection settle before reading the outcome.
  await act(async () => {});
  expect(result.current).toBeNull();
});

test('switching accounts clears the answers and rereads', async () => {
  fetchGameLogsData.mockResolvedValue(logs([20]));
  const { result, rerender } = renderHook(({ account }) => useLadderAnswers(account), {
    initialProps: { account: 'reader-a' },
  });
  await waitFor(() => expect(result.current).not.toBeNull());

  fetchGameLogsData.mockReturnValue(new Promise(() => {}));
  rerender({ account: 'reader-b' });

  expect(result.current).toBeNull();
  expect(fetchGameLogsData).toHaveBeenCalledTimes(6);
});
