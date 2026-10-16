import { decodeLadder, fetchLadder } from './ladderApi';
import { apiClient } from './config';

jest.mock('./config', () => ({
  apiClient: { get: jest.fn() },
  getApiUrl: jest.fn(() => '/api/games/ladder'),
}));

const rung = (id, points, series) => ({ id, points, games: series.length, series });
const payload = {
  rungs: [
    rung('start', 22.4, [18, 25, 31]),
    rung('narrow', 24.1, [27, 22]),
    rung('stack', 31, [31]),
  ],
};

test('decodes the three rungs in order', () => {
  expect(decodeLadder(payload)).toEqual([
    { points: 22.4, games: 3, series: [18, 25, 31] },
    { points: 24.1, games: 2, series: [27, 22] },
    { points: 31, games: 1, series: [31] },
  ]);
});

test('a rung that kept no games leaves the whole ladder without answers', () => {
  const empty = { ...payload, rungs: [...payload.rungs.slice(0, 2), rung('stack', null, [])] };

  expect(decodeLadder(empty)).toBeNull();
});

test.each([
  ['not an object', 'nope'],
  ['no rungs', {}],
  ['two rungs', { rungs: payload.rungs.slice(0, 2) }],
  ['rungs out of order', { rungs: [payload.rungs[1], payload.rungs[0], payload.rungs[2]] }],
  [
    'a string for points',
    { rungs: [{ ...payload.rungs[0], points: '22.4' }, ...payload.rungs.slice(1)] },
  ],
  [
    'a fractional game count',
    { rungs: [{ ...payload.rungs[0], games: 1.5 }, ...payload.rungs.slice(1)] },
  ],
  [
    'a non-numeric series',
    { rungs: [{ ...payload.rungs[0], series: [18, 'x', 31] }, ...payload.rungs.slice(1)] },
  ],
])('refuses %s', (_name, bad) => {
  expect(() => decodeLadder(bad)).toThrow('The ladder endpoint returned an invalid response.');
});

test('reads the anonymous ladder route', async () => {
  apiClient.get.mockResolvedValue({ data: payload });

  await expect(fetchLadder()).resolves.toHaveLength(3);
  expect(apiClient.get).toHaveBeenCalledWith('/api/games/ladder', { signal: undefined });
});
