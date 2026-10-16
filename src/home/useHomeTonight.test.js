import { renderHook, waitFor } from '@testing-library/react';
import { useHomeTonight } from './useHomeTonight';
import { fetchSlate } from '../slateApi';
import { fetchSlateEdges } from '../slateEdgesApi';
import { fetchResolvedTargets } from '../targets/targetsApi';

jest.mock('../slateApi', () => ({ fetchSlate: jest.fn() }));
jest.mock('../slateEdgesApi', () => ({ fetchSlateEdges: jest.fn() }));
jest.mock('../targets/targetsApi', () => ({ fetchResolvedTargets: jest.fn() }));

const game = (gameId, scheduledAt) => ({
  gameId,
  scheduledAt,
  away: { tricode: 'A' },
  home: { tricode: 'B' },
});

const slate = {
  slateDate: '2026-04-10',
  games: [game('late', '2026-04-11T02:00:00Z'), game('early', '2026-04-10T23:00:00Z')],
};
const edges = {
  slateDate: '2026-04-10',
  games: [{ gameId: 'early', effects: [{ canonicalId: 1 }], scores: new Map([[1, 0.1]]) }],
  spotlight: { best: null, toughest: null },
};
const resolved = {
  slateDate: '2026-04-10',
  entries: [
    { target: { id: 1 }, game: game('early', ''), players: [{}] },
    { target: { id: 2 }, game: game('late', ''), players: [{}, {}] },
    { target: { id: 3 }, game: null, players: [] },
  ],
};

beforeEach(() => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  fetchSlate.mockResolvedValue(slate);
  fetchSlateEdges.mockResolvedValue(edges);
  fetchResolvedTargets.mockResolvedValue(resolved);
});
afterEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

test('joins the Slate to its edges in tip-off order and ranks firing Targets by fits', async () => {
  const { result } = renderHook(() => useHomeTonight('reader-a'));

  await waitFor(() => expect(result.current.games).not.toBeNull());
  expect(result.current.games.map((g) => g.gameId)).toEqual(['early', 'late']);
  expect(result.current.games[0].effects).toEqual([{ canonicalId: 1 }]);
  expect(result.current.games[0].scores.get(1)).toBe(0.1);
  // A game the edges left out shows no effects rather than vanishing.
  expect(result.current.games[1].effects).toEqual([]);
  expect(result.current.targets.total).toBe(3);
  expect(result.current.targets.firing.map((e) => e.target.id)).toEqual([2, 1]);
  // Edges and Targets are read for the Slate's own date.
  expect(fetchSlateEdges).toHaveBeenCalledWith(expect.objectContaining({ date: '2026-04-10' }));
  expect(fetchResolvedTargets).toHaveBeenCalledWith(
    expect.objectContaining({ date: '2026-04-10' }),
  );
});

test('signed out reads nothing', () => {
  const { result } = renderHook(() => useHomeTonight(null));

  expect(result.current.games).toBeNull();
  expect(fetchSlate).not.toHaveBeenCalled();
});

test('no games today shows no ticker or Tonight row', async () => {
  fetchSlate.mockResolvedValue({ slateDate: '2026-10-15', games: [] });
  fetchResolvedTargets.mockResolvedValue({ slateDate: '2026-10-15', entries: [] });
  const { result } = renderHook(() => useHomeTonight('reader-a'));

  await waitFor(() => expect(result.current.targets).not.toBeNull());
  expect(result.current.games).toBeNull();
});

test('a backend without the edges route reads like no games', async () => {
  fetchSlateEdges.mockResolvedValue(null);
  const { result } = renderHook(() => useHomeTonight('reader-a'));

  await waitFor(() => expect(result.current.targets).not.toBeNull());
  expect(result.current.games).toBeNull();
});

test('a failed Targets read keeps the games', async () => {
  fetchResolvedTargets.mockRejectedValue(new Error('boom'));
  const { result } = renderHook(() => useHomeTonight('reader-a'));

  await waitFor(() => expect(result.current.games).not.toBeNull());
  expect(result.current.targets).toBeNull();
});

test('edges for another date than the Slate show no games', async () => {
  fetchSlateEdges.mockResolvedValue({ ...edges, slateDate: '2026-04-11' });
  const { result } = renderHook(() => useHomeTonight('reader-a'));

  await waitFor(() => expect(result.current.targets).not.toBeNull());
  expect(result.current.games).toBeNull();
});

test('Targets resolved for another date are dropped', async () => {
  fetchResolvedTargets.mockResolvedValue({ ...resolved, slateDate: '2026-04-11' });
  const { result } = renderHook(() => useHomeTonight('reader-a'));

  await waitFor(() => expect(result.current.games).not.toBeNull());
  expect(result.current.targets).toBeNull();
});

test('switching accounts clears the previous reader and rereads', async () => {
  const { result, rerender } = renderHook(({ account }) => useHomeTonight(account), {
    initialProps: { account: 'reader-a' },
  });
  await waitFor(() => expect(result.current.targets).not.toBeNull());

  fetchResolvedTargets.mockReturnValue(new Promise(() => {}));
  rerender({ account: 'reader-b' });

  expect(result.current.targets).toBeNull();
  await waitFor(() => expect(fetchResolvedTargets).toHaveBeenCalledTimes(2));
  expect(result.current.targets).toBeNull();
});
