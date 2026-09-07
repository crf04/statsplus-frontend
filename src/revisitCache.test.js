import {
  readRevisit,
  clearRevisitCaches,
  invalidateTargetResolutions,
  historicalDate,
} from './revisitCache';

beforeEach(() => {
  clearRevisitCaches();
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-09-06T12:00:00Z'));
});
afterEach(() => jest.useRealTimers());
const read = (key, load, options = {}) => readRevisit('logs', 'alice', key, load, options);
test('revisits reuse results, complete filters and accounts stay isolated, refresh bypasses', async () => {
  const load = jest.fn().mockResolvedValue({ timestamp: 'original' });
  const first = await read({ player: 'A', last: 10, season: '2025' }, load);
  await read({ player: 'A', last: 5, season: '2025' }, load);
  expect(await read({ player: 'A', last: 10, season: '2025' }, load)).toBe(first);
  expect(load).toHaveBeenCalledTimes(2);
  await read({ player: 'A', last: 10, season: '2024' }, load);
  await readRevisit('logs', 'bob', { player: 'A', last: 10, season: '2025' }, load);
  await read({ player: 'A', last: 10, season: '2025' }, load, { bypass: true });
  expect(load).toHaveBeenCalledTimes(5);
});
test('expires at 30 seconds and bounds retained results to 32', async () => {
  const load = jest.fn().mockResolvedValue([]);
  await read(0, load);
  jest.advanceTimersByTime(30000);
  await read(0, load);
  expect(load).toHaveBeenCalledTimes(2);
  for (let i = 1; i <= 32; i++) await read(i, load);
  await read(0, load);
  expect(load).toHaveBeenCalledTimes(35);
});
test.each(['logout', 'mutation'])('%s fences late resolution responses', async (kind) => {
  let finish;
  const pending = new Promise((resolve) => {
    finish = resolve;
  });
  const load = jest.fn().mockReturnValueOnce(pending).mockResolvedValue('new');
  const run = () => readRevisit('resolution', 'alice', '2026-01-01', load);
  const flight = run();
  if (kind === 'logout') clearRevisitCaches();
  else invalidateTargetResolutions();
  finish('old');
  await flight;
  expect(await run()).toBe('new');
  expect(load).toHaveBeenCalledTimes(2);
});
test('never caches rejected or aborted reads', async () => {
  const load = jest.fn().mockRejectedValueOnce(new Error('bad')).mockResolvedValue('good');
  await expect(read('x', load)).rejects.toThrow('bad');
  const controller = new AbortController();
  controller.abort();
  await read('x', load, { signal: controller.signal });
  await read('x', load);
  expect(load).toHaveBeenCalledTimes(3);
});
test('only explicit historical Slate calendar days qualify', () => {
  expect(historicalDate('2026-09-05')).toBe(true);
  for (const date of [undefined, '2026-09-06', '2026-09-07', 'bad', '', '2020-1-5'])
    expect(historicalDate(date)).toBe(false);
});

test('the still-current New York slate is not historical after UTC midnight', () => {
  jest.setSystemTime(new Date('2026-09-07T01:00:00Z'));
  expect(historicalDate('2026-09-06')).toBe(false);
});
