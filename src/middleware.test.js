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

test('serves the rewritten head unencoded when the document came compressed', async () => {
  fetch.mockResolvedValueOnce(
    new Response(indexHtml, {
      status: 200,
      headers: { 'content-type': 'text/html', 'content-encoding': 'br' },
    }),
  );
  const response = await middleware(request('?player_name=LeBron+James'));

  expect(response.headers.get('content-encoding')).toBeNull();
  expect(await response.text()).toContain('<title>LeBron James Game Logs | CourtAI</title>');
});

test('runs only for the Workspace, Slate, Matchup and injury brief skill routes', () => {
  expect(config).toEqual({
    matcher: ['/', '/matchups', '/matchups/:gameId', '/skills/injury-brief', '/reports/:id'],
  });
});

test('describes the injury brief skill page for link unfurlers', async () => {
  const html = await (await middleware(request('skills/injury-brief'))).text();

  expect(html).toContain('<title>Injury brief skill | CourtAI</title>');
  expect(html).toContain(
    "Have Claude read tonight's NBA injury report with CourtAI: who gains, checked against tonight's lines, in a short graded brief.",
  );
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

test('points the image at the origin the link was shared from', async () => {
  const response = await describeLink(
    new Request('https://staging.courtai.app/?player_name=LeBron+James'),
    LATE_ON_OCT_21_ET,
  );

  expect(await response.text()).toContain(
    '<meta property="og:image" content="https://staging.courtai.app/api/games/game_logs/preview.png?player_name=LeBron+James&amp;line_date=2026-10-21" />',
  );
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

test("draws the sender's line, as shown, between the Line Type and the day", async () => {
  const html = await describedHead('?line=24.50&player_name=LeBron+James&line_type=REB');

  expect(html).toContain(
    '<meta property="og:image" content="https://courtai.app/api/games/game_logs/preview.png?player_name=LeBron+James&amp;line_type=REB&amp;line=24.5&amp;line_date=2026-10-21" />',
  );
});

test('leaves an unusable line out of the image URL', async () => {
  const image =
    'https://courtai.app/api/games/game_logs/preview.png?player_name=LeBron+James&amp;line_date=2026-10-21';
  for (const search of ['&line=0', '&line=abc', '&line=24.5&line=25']) {
    expect(await describedHead(`?player_name=LeBron+James${search}`)).toContain(
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

describe('Slate and Matchup links', () => {
  // Saturday Oct 24 in New York, already Sunday in UTC.
  const SATURDAY_NIGHT_ET = new Date('2026-10-25T02:30:00Z');

  const describedPath = async (pathAndSearch) => {
    const response = await describeLink(request(pathAndSearch.slice(1)), SATURDAY_NIGHT_ET);
    return response && (await response.text()).replace(/\s+/g, ' ');
  };

  const tags = (html) =>
    Object.fromEntries(
      Object.entries(rawTags(html)).map(([key, value]) => [key, value.replaceAll('&amp;', '&')]),
    );
  const rawTags = (html) => ({
    title: /<title>([^<]*)<\/title>/.exec(html)[1],
    ogTitle: /property="og:title" content="([^"]*)"/.exec(html)[1],
    ogDescription: /property="og:description" content="([^"]*)"/.exec(html)[1],
    ogImage: /property="og:image" content="([^"]*)"/.exec(html)[1],
    twitterImage: /name="twitter:image" content="([^"]*)"/.exec(html)[1],
    width: /property="og:image:width" content="([^"]*)"/.exec(html)[1],
    height: /property="og:image:height" content="([^"]*)"/.exec(html)[1],
    alt: /property="og:image:alt" content="([^"]*)"/.exec(html)[1],
    card: /name="twitter:card" content="([^"]*)"/.exec(html)[1],
  });

  const slateTags = (title, image) => ({
    title,
    ogTitle: title,
    ogDescription: 'Softest and toughest points matchups in every game.',
    ogImage: image,
    twitterImage: image,
    width: '1200',
    height: '630',
    alt: title,
    card: 'summary_large_image',
  });

  test('describes /matchups without naming a day, which may fall forward', async () => {
    expect(tags(await describedPath('/matchups'))).toEqual(
      slateTags(
        'NBA Slate | CourtAI',
        'https://courtai.app/api/games/slate/preview.png?v=2026-10-24',
      ),
    );
  });

  test('describes /matchups with the date asked for, ignoring other params', async () => {
    expect(tags(await describedPath('/matchups?date=2026-01-02&player=Jokic'))).toEqual(
      slateTags(
        'NBA Slate · Friday, Jan 2 | CourtAI',
        'https://courtai.app/api/games/slate/preview.png?date=2026-01-02&v=2026-10-24',
      ),
    );
  });

  test("names the contract's example day as Saturday, Oct 24", async () => {
    expect(tags(await describedPath('/matchups?date=2026-10-24'))).toEqual(
      slateTags(
        'NBA Slate · Saturday, Oct 24 | CourtAI',
        'https://courtai.app/api/games/slate/preview.png?date=2026-10-24&v=2026-10-24',
      ),
    );
  });

  test('describes a Matchup by its game id', async () => {
    const title = 'NBA Matchup | CourtAI';
    const image =
      'https://courtai.app/api/games/matchup/preview.png?game_id=0022600105&v=2026-10-24';
    expect(tags(await describedPath('/matchups/0022600105?player=Jokic'))).toEqual({
      ...slateTags(title, image),
      ogDescription: "Every player's points Matchup Score in this game, softest to toughest.",
    });
  });

  test.each([
    '/matchups?date=2026-13-01',
    '/matchups?date=',
    '/matchups?date=tomorrow',
    '/matchups/002260010',
    '/matchups/00226001055',
    '/matchups/abcdefghij',
    '/matchups/0022600105/extra',
  ])('leaves %s to the static document', async (target) => {
    expect(await describedPath(target)).toBeUndefined();
    expect(fetch).not.toHaveBeenCalled();
  });

  test('still describes a Workspace link', async () => {
    expect(await describedPath('/?player_name=LeBron+James')).toContain(
      '<title>LeBron James Game Logs | CourtAI</title>',
    );
  });
});

test('describes a shared report from its meta, with its graded spots and drawn image', async () => {
  fetch.mockImplementation(async (url) =>
    String(url).endsWith('/api/reports/k3x9q2mtzr/meta')
      ? new Response(
          JSON.stringify({
            id: 'k3x9q2mtzr',
            title: 'Injury brief · Sunday, October 25',
            date: '2026-10-25',
            description: 'Banchero is out for weeks, which moves shots to Desmond Bane.',
            tags: { lean: 2, thin: 6, pass: 4 },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        )
      : new Response(indexHtml, { status: 200, headers: { 'content-type': 'text/html' } }),
  );
  const html = await (await middleware(request('reports/k3x9q2mtzr'))).text();

  expect(html).toContain('<title>Injury brief · Sunday, October 25 | CourtAI</title>');
  expect(html).toContain(
    'content="2 lean · 6 thin · 4 pass. Banchero is out for weeks, which moves shots to Desmond Bane."',
  );
  expect(html).toContain('https://courtai.app/api/reports/k3x9q2mtzr/preview.png');
});

test('leaves a missing report, or a path that is not a report id, to the static document', async () => {
  fetch.mockResolvedValue(new Response('{}', { status: 404 }));
  expect(await middleware(request('reports/k3x9q2mtzr'))).toBeUndefined();
  expect(await middleware(request('reports/not-an-id!'))).toBeUndefined();
});
