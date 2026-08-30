/**
 * @jest-environment node
 */
import fs from 'node:fs';
import path from 'node:path';
import middleware, { config } from '../middleware';

const indexHtml = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf8');

const request = (search, cookie) =>
  new Request(`https://courtai.app/${search}`, {
    headers: cookie ? { cookie } : {},
  });

beforeEach(() => {
  global.fetch = jest.fn(
    async () =>
      new Response(indexHtml, {
        status: 200,
        headers: { 'content-type': 'text/html', 'content-length': String(indexHtml.length) },
      }),
  );
});

afterEach(() => {
  delete global.fetch;
});

test('runs only for the Workspace route', () => {
  expect(config).toEqual({ matcher: '/' });
});

test('describes a player link in the served document head', async () => {
  const response = await middleware(request('?player_name=LeBron+James&game_filter=10', 'a=b'));

  expect(fetch).toHaveBeenCalledWith(new URL('https://courtai.app/index.html'), {
    headers: { cookie: 'a=b' },
  });
  expect(response.status).toBe(200);
  expect(response.headers.get('content-type')).toBe('text/html; charset=utf-8');
  expect(response.headers.get('content-length')).toBeNull();
  const html = await response.text();
  expect(html).toContain('<title>LeBron James Game Logs | CourtAI</title>');
  expect(html).toContain('Last 10 games. Explore on CourtAI.');
});

test('leaves a link without a player, or one the Workspace refuses, to the static document', async () => {
  expect(await middleware(request(''))).toBeUndefined();
  expect(await middleware(request('?browse'))).toBeUndefined();
  expect(await middleware(request('?player_name=LeBron+James&game_filter=0'))).toBeUndefined();
  expect(fetch).not.toHaveBeenCalled();
});

test('falls back to the static document when it cannot be fetched', async () => {
  fetch.mockResolvedValueOnce(new Response('', { status: 503 }));

  expect(await middleware(request('?player_name=LeBron+James'))).toBeUndefined();
});
