/**
 * @jest-environment node
 */
import fs from 'node:fs';
import path from 'node:path';
import middleware, { config, describeLink } from '../middleware';

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

// 23:30 in New York on Oct 21 is already Oct 22 in UTC; the posted-line day is ET.
const LATE_ON_OCT_21_ET = new Date('2026-10-22T03:30:00Z');

const describedHead = async (search) => {
  const response = await describeLink(request(search), LATE_ON_OCT_21_ET);
  return (await response.text()).replace(/\s+/g, ' ');
};

test("unfurls a player link as a large card of that day's results", async () => {
  const html = await describedHead(
    '?player_name=LeBron%20James&game_filter=10&line_type=REB&utm_source=x',
  );

  const image =
    'https://courtai.app/api/games/game_logs/preview.png?player_name=LeBron+James&amp;game_filter=10&amp;line_type=REB&amp;line_date=2026-10-21';
  expect(html).toContain(`<meta property="og:image" content="${image}" />`);
  expect(html).toContain('<meta property="og:image:width" content="1200" />');
  expect(html).toContain('<meta property="og:image:height" content="630" />');
  expect(html).toContain(
    '<meta property="og:image:alt" content="LeBron James Game Logs | CourtAI" />',
  );
  expect(html).toContain('<meta name="twitter:card" content="summary_large_image" />');
  expect(html).toContain(`<meta name="twitter:image" content="${image}" />`);
  expect(html).not.toContain('logo512.png');
});

test('escapes a player name in the image alt text', async () => {
  const html = await describedHead('?player_name=Luka+%22Magic%22+Don%C4%8Di%C4%87+%26+Co');

  expect(html).toContain(
    '<meta property="og:image:alt" content="Luka &quot;Magic&quot; Dončić &amp; Co Game Logs | CourtAI" />',
  );
});

test('leaves the default and unusable Line Types out of the image URL', async () => {
  const image =
    'https://courtai.app/api/games/game_logs/preview.png?player_name=LeBron+James&amp;line_date=2026-10-21';
  for (const search of [
    '?player_name=LeBron+James',
    '?player_name=LeBron+James&line_type=PTS',
    '?player_name=LeBron+James&line_type=XYZ',
  ]) {
    expect(await describedHead(search)).toContain(
      `<meta property="og:image" content="${image}" />`,
    );
  }
});

test('keeps the logo and the small card for a link that charts no stat', async () => {
  const html = await describedHead('?player_name=LeBron+James&line_type=None');

  expect(html).toContain('<title>LeBron James Game Logs | CourtAI</title>');
  expect(html).toContain('<meta property="og:image" content="https://courtai.app/logo512.png" />');
  expect(html).toContain('<meta name="twitter:card" content="summary" />');
  expect(html).not.toContain('og:image:');
  expect(html).not.toContain('twitter:image');
});
