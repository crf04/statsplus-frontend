import { act, renderHook, waitFor } from '@testing-library/react';
import { useLadderAnswers } from './useLadderAnswers';
import { fetchLadder } from '../ladderApi';

jest.mock('../ladderApi', () => ({ fetchLadder: jest.fn() }));
jest.mock('../gameLogsApi', () => ({ isRequestCancelled: () => false }));

const answers = [
  { points: 25, games: 2, series: [20, 30] },
  { points: 22, games: 1, series: [22] },
  { points: 33, games: 3, series: [31, 33, 35] },
];

afterEach(() => jest.clearAllMocks());

test('reads the ladder once and answers in rung order', async () => {
  fetchLadder.mockResolvedValue(answers);
  const { result } = renderHook(() => useLadderAnswers(true));

  await waitFor(() => expect(result.current).not.toBeNull());
  expect(fetchLadder).toHaveBeenCalledTimes(1);
  expect(result.current).toEqual(answers);
});

test('off the Query Prompt reads nothing', () => {
  const { result } = renderHook(() => useLadderAnswers(false));

  expect(result.current).toBeNull();
  expect(fetchLadder).not.toHaveBeenCalled();
});

test('a failed read leaves the ladder without answers', async () => {
  fetchLadder.mockRejectedValue(new Error('boom'));
  const { result } = renderHook(() => useLadderAnswers(true));

  await waitFor(() => expect(fetchLadder).toHaveBeenCalledTimes(1));
  // Let the rejection settle before reading the outcome.
  await act(async () => {});
  expect(result.current).toBeNull();
});

test('leaving the Query Prompt clears the answers and returning rereads', async () => {
  fetchLadder.mockResolvedValue(answers);
  const { result, rerender } = renderHook(({ enabled }) => useLadderAnswers(enabled), {
    initialProps: { enabled: true },
  });
  await waitFor(() => expect(result.current).not.toBeNull());

  rerender({ enabled: false });
  expect(result.current).toBeNull();

  fetchLadder.mockReturnValue(new Promise(() => {}));
  rerender({ enabled: true });
  expect(result.current).toBeNull();
  expect(fetchLadder).toHaveBeenCalledTimes(2);
});
