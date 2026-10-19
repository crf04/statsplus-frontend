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
  fallback: null,
  games: [game('late', '2026-04-11T02:00:00Z'), game('early', '2026-04-10T23:00:00Z')],
};
const edges = {
  slateDate: '2026-04-10',
  games: [
    {
      gameId: 'early',
      effects: [{ canonicalId: 1, name: 'Austin Reaves', value: 0.2 }],
      scores: new Map([[1, 0.1]]),
    },
  ],
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

const CACHE_KEY = 'courtai.homeTonight.v2';
const pending = () => new Promise(() => {});

beforeEach(() => {
  window.localStorage.clear();
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
  const { result } = renderHook(() => useHomeTonight(true, 'reader-a'));

  await waitFor(() => expect(result.current.games).not.toBeNull());
  expect(result.current.games.map((g) => g.gameId)).toEqual(['early', 'late']);
  expect(result.current.games[0].effects).toEqual([
    { canonicalId: 1, name: 'Austin Reaves', value: 0.2 },
  ]);
  expect(result.current.games[0].scores.get(1)).toBe(0.1);
  // A game the edges left out shows no effects rather than vanishing.
  expect(result.current.games[1].effects).toEqual([]);
  expect(result.current.targets.total).toBe(3);
  expect(result.current.targets.firing.map((e) => e.target.id)).toEqual([2, 1]);
});

test('with no account the Slate and Edges are read but Targets are not', async () => {
  const { result } = renderHook(() => useHomeTonight(true, null));

  await waitFor(() => expect(result.current.games).not.toBeNull());
  expect(result.current.games.map((g) => g.gameId)).toEqual(['early', 'late']);
  expect(result.current.targets).toBeNull();
  expect(fetchResolvedTargets).not.toHaveBeenCalled();
});

test('off the Query Prompt reads nothing', () => {
  const { result } = renderHook(() => useHomeTonight(false, 'reader-a'));

  expect(result.current.games).toBeNull();
  expect(fetchSlate).not.toHaveBeenCalled();
});

test('signing in rereads and adds Targets to the games already shown', async () => {
  const { result, rerender } = renderHook(({ account }) => useHomeTonight(true, account), {
    initialProps: { account: null },
  });
  await waitFor(() => expect(result.current.games).not.toBeNull());
  expect(fetchResolvedTargets).not.toHaveBeenCalled();

  rerender({ account: 'reader-a' });

  await waitFor(() => expect(result.current.targets).not.toBeNull());
  expect(result.current.targets.total).toBe(3);
  expect(result.current.games.map((g) => g.gameId)).toEqual(['early', 'late']);
});

test('no games today shows no ticker or Tonight row', async () => {
  fetchSlate.mockResolvedValue({ slateDate: '2026-10-15', games: [] });
  fetchResolvedTargets.mockResolvedValue({ slateDate: '2026-10-15', entries: [] });
  const { result } = renderHook(() => useHomeTonight(true, 'reader-a'));

  await waitFor(() => expect(result.current.targets).not.toBeNull());
  expect(result.current.games).toBeNull();
});

test('a backend without the edges route reads like no games', async () => {
  fetchSlateEdges.mockResolvedValue(null);
  const { result } = renderHook(() => useHomeTonight(true, 'reader-a'));

  await waitFor(() => expect(result.current.targets).not.toBeNull());
  expect(result.current.games).toBeNull();
});

test('a failed Targets read keeps the games', async () => {
  fetchResolvedTargets.mockRejectedValue(new Error('boom'));
  const { result } = renderHook(() => useHomeTonight(true, 'reader-a'));

  await waitFor(() => expect(result.current.games).not.toBeNull());
  expect(result.current.targets).toBeNull();
});

test('edges for another date than the Slate show no games', async () => {
  fetchSlateEdges.mockResolvedValue({ ...edges, slateDate: '2026-04-11' });
  const { result } = renderHook(() => useHomeTonight(true, 'reader-a'));

  await waitFor(() => expect(result.current.targets).not.toBeNull());
  expect(result.current.games).toBeNull();
});

test('Targets resolved for another date are dropped', async () => {
  fetchResolvedTargets.mockResolvedValue({ ...resolved, slateDate: '2026-04-11' });
  const { result } = renderHook(() => useHomeTonight(true, 'reader-a'));

  await waitFor(() => expect(result.current.games).not.toBeNull());
  expect(result.current.targets).toBeNull();
});

test('switching accounts clears the previous reader and rereads', async () => {
  const { result, rerender } = renderHook(({ account }) => useHomeTonight(true, account), {
    initialProps: { account: 'reader-a' },
  });
  await waitFor(() => expect(result.current.targets).not.toBeNull());

  fetchResolvedTargets.mockReturnValue(new Promise(() => {}));
  rerender({ account: 'reader-b' });

  expect(result.current.targets).toBeNull();
  await waitFor(() => expect(fetchResolvedTargets).toHaveBeenCalledTimes(2));
  expect(result.current.targets).toBeNull();
});

test('the Slate, Edges and Targets are all requested before any of them answers', () => {
  fetchSlate.mockReturnValue(pending());
  fetchSlateEdges.mockReturnValue(pending());
  fetchResolvedTargets.mockReturnValue(pending());
  renderHook(() => useHomeTonight(true, 'reader-a'));

  // Synchronously after mount: nothing has resolved, yet all three are in flight,
  // each asking for the next game day on its own and naming no date.
  const signal = expect.any(AbortSignal);
  expect(fetchSlate).toHaveBeenCalledWith(undefined, { signal, fallback: 'next_game_day' });
  expect(fetchSlateEdges).toHaveBeenCalledWith({ signal, fallback: 'next_game_day' });
  expect(fetchResolvedTargets).toHaveBeenCalledWith({ signal, fallback: 'next_game_day' });
});

test('a Slate answered with the previous game day keeps its fallback', async () => {
  fetchSlate.mockResolvedValue({ ...slate, fallback: 'previous_game_day' });
  const { result } = renderHook(() => useHomeTonight(true, 'reader-a'));

  await waitFor(() => expect(result.current.games).not.toBeNull());
  expect(result.current.fallback).toBe('previous_game_day');
  expect(result.current.slateDate).toBe('2026-04-10');
});

test('a Slate answered with the next game day keeps its fallback', async () => {
  fetchSlate.mockResolvedValue({ ...slate, fallback: 'next_game_day' });
  const { result } = renderHook(() => useHomeTonight(true, 'reader-a'));

  await waitFor(() => expect(result.current.games).not.toBeNull());
  expect(result.current.fallback).toBe('next_game_day');
});

test('Targets resolved for the next game day are kept with its games', async () => {
  fetchSlate.mockResolvedValue({ ...slate, slateDate: '2026-10-20', fallback: 'next_game_day' });
  fetchSlateEdges.mockResolvedValue({ ...edges, slateDate: '2026-10-20' });
  fetchResolvedTargets.mockResolvedValue({ ...resolved, slateDate: '2026-10-20' });
  const { result } = renderHook(() => useHomeTonight(true, 'reader-a'));

  await waitFor(() => expect(result.current.targets).not.toBeNull());
  expect(result.current.slateDate).toBe('2026-10-20');
  expect(result.current.targets.firing.map((e) => e.target.id)).toEqual([2, 1]);
});

test('a next game day result is written and paints on the return visit', async () => {
  fetchSlate.mockResolvedValue({ ...slate, slateDate: '2026-10-20', fallback: 'next_game_day' });
  fetchSlateEdges.mockResolvedValue({ ...edges, slateDate: '2026-10-20' });
  const first = renderHook(() => useHomeTonight(true, null));
  await waitFor(() => expect(first.result.current.fallback).toBe('next_game_day'));
  first.unmount();

  fetchSlate.mockReturnValue(pending());
  fetchSlateEdges.mockReturnValue(pending());
  const again = renderHook(() => useHomeTonight(true, null));
  expect(again.result.current.fallback).toBe('next_game_day');
  expect(again.result.current.slateDate).toBe('2026-10-20');
  expect(again.result.current.games.map((g) => g.gameId)).toEqual(['early', 'late']);
});

test('a Slate with no fallback renders as today', async () => {
  fetchSlate.mockResolvedValue({ ...slate, fallback: null });
  const { result } = renderHook(() => useHomeTonight(true, 'reader-a'));

  await waitFor(() => expect(result.current.games).not.toBeNull());
  expect(result.current.fallback).toBeNull();
});

test('a failed Slate read keeps the Targets of the day they answered for', async () => {
  fetchSlate.mockRejectedValue(new Error('boom'));
  const { result } = renderHook(() => useHomeTonight(true, 'reader-a'));

  await waitFor(() => expect(result.current.targets).not.toBeNull());
  expect(result.current.games).toBeNull();
});

describe('the last public result', () => {
  const stored = {
    games: [
      {
        gameId: 'cached',
        scheduledAt: '2026-04-09T23:00:00Z',
        away: { tricode: 'LAL' },
        home: { tricode: 'BOS' },
        effects: [{ canonicalId: 7, name: 'Austin Reaves', value: 0.25 }],
        scores: [[7, 0.25]],
      },
    ],
    spotlight: { best: null, toughest: null },
    slateDate: '2026-04-09',
    fallback: 'previous_game_day',
  };

  test('paints before any read answers, with scores as a Map and no Targets', () => {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(stored));
    fetchSlate.mockReturnValue(pending());
    fetchSlateEdges.mockReturnValue(pending());
    fetchResolvedTargets.mockReturnValue(pending());
    const { result } = renderHook(() => useHomeTonight(true, 'reader-a'));

    expect(result.current.games.map((g) => g.gameId)).toEqual(['cached']);
    expect(result.current.games[0].scores.get(7)).toBe(0.25);
    expect(result.current.slateDate).toBe('2026-04-09');
    expect(result.current.fallback).toBe('previous_game_day');
    expect(result.current.targets).toBeNull();
  });

  test('is replaced by the fresh read when it lands', async () => {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(stored));
    const { result } = renderHook(() => useHomeTonight(true, null));

    await waitFor(() => expect(result.current.slateDate).toBe('2026-04-10'));
    expect(result.current.games.map((g) => g.gameId)).toEqual(['early', 'late']);
    expect(result.current.fallback).toBeNull();
  });

  test('is written from a fresh read and paints on the next visit, never with Targets', async () => {
    const first = renderHook(() => useHomeTonight(true, 'reader-a'));
    await waitFor(() => expect(first.result.current.targets).not.toBeNull());
    await waitFor(() => expect(first.result.current.games).not.toBeNull());
    first.unmount();
    expect(Object.keys(JSON.parse(window.localStorage.getItem(CACHE_KEY))).sort()).toEqual([
      'fallback',
      'games',
      'slateDate',
      'spotlight',
    ]);

    fetchSlate.mockReturnValue(pending());
    fetchSlateEdges.mockReturnValue(pending());
    fetchResolvedTargets.mockReturnValue(pending());
    const second = renderHook(() => useHomeTonight(true, 'reader-a'));

    expect(second.result.current.games.map((g) => g.gameId)).toEqual(['early', 'late']);
    expect(second.result.current.games[0].scores.get(1)).toBe(0.1);
    expect(second.result.current.targets).toBeNull();
  });

  test('is cleared when the fresh answer is that there is nothing to show', async () => {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(stored));
    fetchSlateEdges.mockResolvedValue(null);
    const { result } = renderHook(() => useHomeTonight(true, null));

    await waitFor(() => expect(result.current.games).toBeNull());
    expect(window.localStorage.getItem(CACHE_KEY)).toBeNull();
  });

  test('stays on screen when the reads fail', async () => {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(stored));
    fetchSlate.mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => useHomeTonight(true, null));

    await waitFor(() => expect(console.warn).toHaveBeenCalled());
    expect(result.current.games.map((g) => g.gameId)).toEqual(['cached']);
  });

  test.each([
    ['text that is not JSON', 'not json{'],
    [
      'a game without an id',
      JSON.stringify({ ...stored, games: [{ ...stored.games[0], gameId: 4 }] }),
    ],
    [
      'scores that are not pairs',
      JSON.stringify({ ...stored, games: [{ ...stored.games[0], scores: [7] }] }),
    ],
    ['a missing spotlight', JSON.stringify({ ...stored, spotlight: undefined })],
    ['a fallback outside the vocabulary', JSON.stringify({ ...stored, fallback: 'yes' })],
  ])('an unreadable entry (%s) is ignored and removed', (_name, raw) => {
    window.localStorage.setItem(CACHE_KEY, raw);
    fetchSlate.mockReturnValue(pending());
    fetchSlateEdges.mockReturnValue(pending());
    const { result } = renderHook(() => useHomeTonight(true, null));

    expect(result.current.games).toBeNull();
    expect(window.localStorage.getItem(CACHE_KEY)).toBeNull();
  });

  test('storage that throws neither blocks the reads nor the render', async () => {
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied');
    });
    const { result } = renderHook(() => useHomeTonight(true, null));

    await waitFor(() => expect(result.current.games).not.toBeNull());
    expect(result.current.games.map((g) => g.gameId)).toEqual(['early', 'late']);
  });
});
