import { act, renderHook, waitFor } from '@testing-library/react';
import useOpponentContext from './useOpponentContext';
import { fetchOpponentProfile } from './opponentContextApi';

jest.mock('./opponentContextApi', () => ({
  fetchOpponentProfile: jest.fn(),
  OPPONENT_CATEGORIES: { play_types: 'Playtype Points', shot_types: 'Shooting Type' },
}));
const qualifier = { base: 'play_types', sliceKey: 'Spotup', thresholdPercent: '30' };
const row = { value: 24, rank: 2, vsAverage: -13 };
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
};
afterEach(() => jest.resetAllMocks());

test('duplicate qualifiers and threshold changes share one form-owned read', async () => {
  fetchOpponentProfile.mockResolvedValue({ Spotup: row });
  const { result, rerender } = renderHook(
    ({ qualifiers }) => useOpponentContext('ORL', qualifiers),
    {
      initialProps: { qualifiers: [qualifier, { ...qualifier, sliceKey: 'Isolation' }] },
    },
  );
  await waitFor(() =>
    expect(result.current.forQualifier(qualifier)).toEqual({ status: 'ready', row }),
  );
  rerender({ qualifiers: [{ ...qualifier, thresholdPercent: '40' }] });
  expect(fetchOpponentProfile).toHaveBeenCalledTimes(1);
});

test('changing opponents clears old evidence and ignores late responses', async () => {
  const old = deferred();
  const next = deferred();
  fetchOpponentProfile
    .mockReturnValueOnce(old.promise)
    .mockReturnValueOnce(next.promise)
    .mockReturnValue(new Promise(() => {}));
  const renders = [];
  const { result, rerender } = renderHook(
    ({ opponent }) => {
      const context = useOpponentContext(opponent, [qualifier]);
      renders.push({ opponent, row: context.forQualifier(qualifier).row });
      return context;
    },
    {
      initialProps: { opponent: 'ORL' },
    },
  );
  const signal = fetchOpponentProfile.mock.calls[0][0].signal;
  rerender({ opponent: 'BOS' });
  expect(signal.aborted).toBe(true);
  expect(result.current.forQualifier(qualifier)).toEqual({ status: 'loading', row: null });
  await act(async () => {
    old.resolve({ Spotup: row });
  });
  expect(result.current.forQualifier(qualifier)).toEqual({ status: 'loading', row: null });
  const boston = { ...row, rank: 20 };
  await act(async () => {
    next.resolve({ Spotup: boston });
  });
  expect(result.current.forQualifier(qualifier).row).toEqual(boston);
  renders.length = 0;
  rerender({ opponent: 'ORL' });
  expect(renders.every((frame) => frame.opponent === 'ORL' && frame.row === null)).toBe(true);
  expect(result.current.forQualifier(qualifier).row).toBeNull();
});

test('failed context is retryable without dropping successful categories', async () => {
  fetchOpponentProfile.mockImplementation(({ base }) =>
    base === 'shot_types'
      ? Promise.resolve({ Pullups: row })
      : Promise.reject(new Error('offline')),
  );
  const shooting = { base: 'shot_types', sliceKey: 'Pullups' };
  const { result } = renderHook(() => useOpponentContext('ORL', [qualifier, shooting]));
  await waitFor(() => expect(result.current.forQualifier(qualifier).status).toBe('error'));
  expect(result.current.forQualifier(shooting).row).toEqual(row);
  fetchOpponentProfile.mockResolvedValue({ Spotup: row });
  act(() => result.current.retry());
  await waitFor(() => expect(result.current.forQualifier(qualifier).row).toEqual(row));
  expect(fetchOpponentProfile).toHaveBeenCalledTimes(3);
  expect(result.current.forQualifier(shooting).row).toEqual(row);
});
