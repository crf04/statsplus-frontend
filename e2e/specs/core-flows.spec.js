import fs from 'node:fs';
import path from 'node:path';
import { E2E_AUTH_STORAGE_KEY, expect, installApiContract } from '../fixtures/courtai';
import { test } from '../fixtures/deployedSmoke';

const vercelConfig = JSON.parse(
  fs.readFileSync(path.resolve(process.cwd(), 'vercel.json'), 'utf8'),
);
const productionBackendOrigin = new URL(vercelConfig.rewrites[0].destination).origin;

test('@smoke public landing page explains how to authenticate', async ({ deployedPage: page }) => {
  const rawBypassHeaders = [];
  page.on('request', (request) => {
    const headers = request.headers();
    if (headers['x-vercel-protection-bypass'] || headers['x-vercel-set-bypass-cookie']) {
      rawBypassHeaders.push(request.url());
    }
  });
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'CourtAI' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign in with Google' })).toBeVisible();
  await expect(page.getByRole('textbox')).toBeDisabled();
  expect(rawBypassHeaders).toHaveLength(0);
});

test('@smoke deployed Matchups shell and deep links resolve', async ({ deployedPage: page }) => {
  await page.goto('/matchups');
  await expect(page.getByRole('heading', { name: 'Sign in to view the slate' })).toBeVisible();

  await page.goto('/matchups/0022500584');
  await expect(page.getByRole('heading', { name: 'Sign in to view this matchup' })).toBeVisible();

  const bundledAssetUrls = await page
    .locator('script[src], link[rel="modulepreload"][href]')
    .evaluateAll((elements) =>
      elements
        .map((element) => element.src || element.href)
        .filter((url) => new URL(url).origin === window.location.origin),
    );
  expect(bundledAssetUrls.length).toBeGreaterThan(0);

  const bundledAssets = await Promise.all(
    bundledAssetUrls.map((url) => page.request.get(url).then((response) => response.text())),
  );
  expect(bundledAssets.length).toBeGreaterThan(0);
  expect(bundledAssets.join('\n')).not.toContain(productionBackendOrigin);
});

test('@smoke production Matchups API routing reaches authenticated backend', async ({
  request,
}) => {
  test.skip(!process.env.E2E_BASE_URL, 'Only meaningful against a deployed environment.');
  test.skip(
    process.env.E2E_PROTECTED_PREVIEW === 'true',
    'Production-only check avoids forwarding the protected-preview cookie through the proxy.',
  );

  const response = await request.get(
    new URL('/api/games/slate?date=2026-01-15', process.env.E2E_BASE_URL).href,
  );

  expect(response.status()).toBe(401);
  expect(response.headers()['content-type']).toContain('application/json');
  await expect(response.json()).resolves.toMatchObject({
    error: { code: 'authentication_required' },
  });
});

test('@critical the development auth adapter unlocks the search seam', async ({ page }) => {
  await installApiContract(page);
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'CourtAI' })).toBeVisible();
  await page.getByRole('button', { name: 'Sign in with Google' }).click();
  await expect(page.getByRole('textbox')).toBeEnabled();
  await expect(page.getByText('CourtAI Test User')).toBeVisible();
});

test('@critical natural-language search renders results and returns to search', async ({
  authenticatedPage: page,
}) => {
  await page.goto('/');

  const query = 'LeBron James last 10 games';
  await page.getByRole('textbox').fill(query);
  await page.getByRole('textbox').press('Enter');

  await expect(page.getByRole('heading', { name: 'LeBron James', exact: true })).toBeVisible();
  await expect(page.getByText(`"${query}"`)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Game Logs' })).toBeVisible();
  await expect(page.getByRole('cell', { name: '31', exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Back to search' }).click();
  await expect(page.getByRole('heading', { name: 'CourtAI' })).toBeVisible();
  await expect(page.getByRole('textbox')).toHaveValue('');
});

test('@critical the query reference is linkable and hands an example back to search', async ({
  authenticatedPage: page,
}) => {
  await page.goto('/');

  await page.getByRole('link', { name: 'Every filter we understand' }).click();
  await expect(page).toHaveURL(/\/help$/);
  await expect(page.getByRole('heading', { name: 'Query reference' })).toBeVisible();
  await expect(page.getByRole('rowheader', { name: 'Less Than 10 ft' })).toBeVisible();

  // The reference survives a reload because it is a route, not an overlay.
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Query reference' })).toBeVisible();

  const example = 'Giannis games at home with 10+ FGA playing 30+ minutes';
  await page.getByRole('link', { name: example }).click();
  await expect(page.getByRole('heading', { name: 'CourtAI' })).toBeVisible();
  await expect(page.getByRole('textbox')).toHaveValue(example);
});

test('@critical consulting the reference does not discard a half-typed query', async ({
  authenticatedPage: page,
}) => {
  await page.goto('/');

  const draft = 'Luka last 10 games';
  await page.getByRole('textbox').fill(draft);
  await page.getByRole('link', { name: 'Every filter we understand' }).click();

  await expect(page.getByRole('heading', { name: 'Query reference' })).toBeFocused();

  await page.getByRole('link', { name: 'Back to search' }).click();
  await expect(page.getByRole('textbox')).toHaveValue(draft);

  // The browser's own Back button has to restore it too, not just our link.
  await page.getByRole('link', { name: 'Every filter we understand' }).click();
  await expect(page.getByRole('heading', { name: 'Query reference' })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('textbox')).toHaveValue(draft);
});

test('the landing help and reference stay usable at a narrow viewport', async ({
  authenticatedPage: page,
}) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto('/');

  await page.getByRole('button', { name: /Narrow it down/ }).click();
  await expect(page.getByRole('textbox')).toHaveValue('Jalen Johnson this year without Trae Young');

  const overflowsHorizontally = () =>
    page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);

  expect(await overflowsHorizontally()).toBe(false);

  await page.getByRole('link', { name: 'Every filter we understand' }).click();
  await expect(page.getByRole('rowheader', { name: 'PRRollMan' })).toBeVisible();
  expect(await overflowsHorizontally()).toBe(false);
});

test('@critical a rejected natural-language query stays retryable', async ({ page }) => {
  await page.addInitScript((storageKey) => {
    window.localStorage.setItem(storageKey, 'true');
  }, E2E_AUTH_STORAGE_KEY);
  await installApiContract(page, {
    '/api/nl-query': {
      status: 422,
      body: { message: 'Query could not be parsed.' },
    },
  });
  await page.goto('/');

  await page.getByRole('textbox').fill('not a valid basketball query');
  await page.getByRole('textbox').press('Enter');

  await expect(page.getByText('Query could not be parsed.')).toBeVisible();
  await expect(page.getByRole('textbox')).toBeEnabled();
  await expect(page.getByRole('textbox')).toHaveValue('not a valid basketball query');
});

test('@critical structured filters serialize through the game-log request seam', async ({
  authenticatedPage: page,
}) => {
  const gameLogRequests = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/api/games/game_logs') {
      gameLogRequests.push(request.url());
    }
  });
  await page.goto('/');
  await page.getByRole('textbox').fill('LeBron James last 10 games');
  await page.getByRole('textbox').press('Enter');
  await expect(page.getByRole('heading', { name: 'Game Logs' })).toBeVisible();

  await page.getByLabel('Last N games:').fill('5');
  await page.getByRole('button', { name: 'Apply Filters' }).click();

  await expect.poll(() => gameLogRequests.length).toBeGreaterThan(1);
  const latestRequest = new URL(gameLogRequests.at(-1));
  expect(latestRequest.searchParams.get('game_filter')).toBe('5');
});

test('@critical a manual defensive filter reaches the game-log request seam', async ({
  authenticatedPage: page,
}) => {
  const gameLogRequests = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/api/games/game_logs') {
      gameLogRequests.push(request.url());
    }
  });
  await page.goto('/');
  await page.getByRole('textbox').fill('LeBron James last 10 games');
  await page.getByRole('textbox').press('Enter');
  await expect(page.getByRole('heading', { name: 'Game Logs' })).toBeVisible();

  const defensiveFilter = page.getByPlaceholder('Number').locator('xpath=..');
  await defensiveFilter.getByRole('combobox').selectOption('Isolation');
  await page.getByPlaceholder('Number').fill('5');
  await defensiveFilter.getByRole('button', { name: 'Add' }).click();
  await expect(page.getByRole('button', { name: 'Remove Isolation filter' })).toBeVisible();

  await page.getByRole('button', { name: 'Apply Filters' }).click();

  await expect.poll(() => gameLogRequests.length).toBeGreaterThan(1);
  const latestRequest = new URL(gameLogRequests.at(-1));
  expect(latestRequest.searchParams.getAll('teams_against[]')).toEqual(['Isolation']);
  expect(latestRequest.searchParams.getAll('rank_filter[]')).toEqual(['5']);

  // A filter is only addable with a usable rank. A blank rank would be stripped
  // on the way out and desynchronise rank_filter[] from teams_against[]; a rank
  // of zero asks for the top nothing and silently returns an empty table.
  await defensiveFilter.getByRole('combobox').selectOption('Transition');
  await page.getByPlaceholder('Number').fill('');
  await expect(defensiveFilter.getByRole('button', { name: 'Add' })).toBeDisabled();
  await page.getByPlaceholder('Number').fill('0');
  await expect(defensiveFilter.getByRole('button', { name: 'Add' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Remove Transition filter' })).toBeHidden();

  // A real rank makes it addable, and both filters travel with paired ranks.
  const rankedRequestCount = gameLogRequests.length;
  await page.getByPlaceholder('Number').fill('-8');
  await defensiveFilter.getByRole('button', { name: 'Add' }).click();
  await expect(page.getByRole('button', { name: 'Remove Transition filter' })).toBeVisible();

  await page.getByRole('button', { name: 'Apply Filters' }).click();

  await expect.poll(() => gameLogRequests.length).toBeGreaterThan(rankedRequestCount);
  const pairedRequest = new URL(gameLogRequests.at(-1));
  expect(pairedRequest.searchParams.getAll('teams_against[]')).toEqual(['Isolation', 'Transition']);
  expect(pairedRequest.searchParams.getAll('rank_filter[]')).toEqual(['5', '-8']);
});

test('@critical applying an untouched panel emits only the controls the user moved', async ({
  authenticatedPage: page,
}) => {
  const gameLogRequests = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/api/games/game_logs') {
      gameLogRequests.push(request.url());
    }
  });
  await page.goto('/');
  await page.getByRole('textbox').fill('LeBron James last 10 games');
  await page.getByRole('textbox').press('Enter');
  await expect(page.getByRole('heading', { name: 'Game Logs' })).toBeVisible();

  await page.getByLabel('Last N games:').fill('5');
  await page.getByRole('button', { name: 'Apply Filters' }).click();

  await expect.poll(() => gameLogRequests.length).toBeGreaterThan(1);
  const latestRequest = new URL(gameLogRequests.at(-1));

  // The one moved control and the player travel; every untouched control stays
  // home so the API applies its own defaults.
  expect([...latestRequest.searchParams.keys()].sort()).toEqual(['game_filter', 'player_name']);
  expect(latestRequest.searchParams.get('game_filter')).toBe('5');
  expect(latestRequest.searchParams.get('player_name')).toBe('LeBron James');

  // Moving a second control keeps the filter the panel was pre-populated with,
  // and still leaves the untouched controls behind.
  const appliedRequestCount = gameLogRequests.length;
  await page.getByLabel('Date Filter:').fill('2025-01-09');
  await page.getByRole('button', { name: 'Apply Filters' }).click();

  await expect.poll(() => gameLogRequests.length).toBeGreaterThan(appliedRequestCount);
  const secondRequest = new URL(gameLogRequests.at(-1));
  expect([...secondRequest.searchParams.keys()].sort()).toEqual([
    'date_filter',
    'game_filter',
    'player_name',
  ]);
  expect(secondRequest.searchParams.get('date_filter')).toBe('2025-01-09');
  expect(secondRequest.searchParams.get('game_filter')).toBe('5');
});

test('@critical a link carrying a Filter Set opens the workspace and survives reload', async ({
  authenticatedPage: page,
}) => {
  const gameLogRequests = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/api/games/game_logs') {
      gameLogRequests.push(request.url());
    }
  });

  await page.goto('/?player_name=LeBron+James&game_filter=10&location_filter=Home');

  // No prose was typed and no parser was called, yet the workspace is open.
  await expect(page.getByRole('heading', { name: 'Game Logs' })).toBeVisible();
  await expect.poll(() => gameLogRequests.length).toBeGreaterThan(0);
  const requested = new URL(gameLogRequests.at(-1));
  expect(requested.searchParams.get('player_name')).toBe('LeBron James');
  expect(requested.searchParams.get('game_filter')).toBe('10');
  expect(requested.searchParams.get('location_filter')).toBe('Home');

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Game Logs' })).toBeVisible();
  expect(page.url()).toContain('player_name=LeBron+James');
});

test('@critical a link without a player waits for one instead of erroring', async ({
  authenticatedPage: page,
}) => {
  const gameLogRequests = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/api/games/game_logs') {
      gameLogRequests.push(request.url());
    }
  });

  await page.goto('/?game_filter=10');

  // A Filter Set without a player is partial, not malformed: the panel holds it.
  await expect(page.getByLabel('Last N games:')).toHaveValue('10');
  await expect(page.getByRole('alert')).toBeHidden();
  expect(gameLogRequests).toHaveLength(0);
});

test('a link with an unusable value names it and applies nothing', async ({
  authenticatedPage: page,
}) => {
  const gameLogRequests = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/api/games/game_logs') {
      gameLogRequests.push(request.url());
    }
  });

  await page.goto('/?player_name=LeBron+James&game_filter=-3');

  await expect(page.getByRole('alert')).toContainText('game_filter');
  expect(gameLogRequests).toHaveLength(0);
});

test('a link keeps working when it carries an unrecognised parameter', async ({
  authenticatedPage: page,
}) => {
  const gameLogRequests = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/api/games/game_logs') {
      gameLogRequests.push(request.url());
    }
  });

  await page.goto('/?player_name=LeBron+James&utm_source=twitter');

  await expect(page.getByRole('heading', { name: 'Game Logs' })).toBeVisible();
  await expect.poll(() => gameLogRequests.length).toBeGreaterThan(0);
  const requested = new URL(gameLogRequests.at(-1));
  expect(requested.searchParams.get('player_name')).toBe('LeBron James');
  expect(requested.searchParams.has('utm_source')).toBe(false);
});

test('@critical a signed-out visitor keeps the link they followed', async ({ page }) => {
  const gameLogRequests = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/api/games/game_logs') {
      gameLogRequests.push(request.url());
    }
  });
  await installApiContract(page);

  await page.goto('/?player_name=LeBron+James&game_filter=10');

  await expect(
    page.getByRole('status').filter({ hasText: 'Sign in to load these game logs' }),
  ).toBeVisible();
  // The requested URL is honoured, not rewritten, so signing in lands here.
  expect(page.url()).toContain('player_name=LeBron+James');
  expect(page.url()).toContain('game_filter=10');
  expect(gameLogRequests).toHaveLength(0);

  // Signing in fires the held Filter Set exactly once, without a second visit.
  await page.getByRole('button', { name: 'Sign in with Google' }).click();
  await expect(page.getByRole('heading', { name: 'Game Logs' })).toBeVisible();
  await expect.poll(() => gameLogRequests.length).toBe(1);
  const requested = new URL(gameLogRequests[0]);
  expect(requested.searchParams.get('player_name')).toBe('LeBron James');
  expect(requested.searchParams.get('game_filter')).toBe('10');
});

test('a bound the link arrived with survives a later apply', async ({
  authenticatedPage: page,
}) => {
  const gameLogRequests = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/api/games/game_logs') {
      gameLogRequests.push(request.url());
    }
  });

  // 0 is the API's own lower playstyle bound, so the panel must be able to hold
  // it. A falsy check here would drop the bound the link arrived with.
  await page.goto('/?player_name=LeBron+James&playstyle_RTG_min=0&playstyle_RTG_max=80');
  await expect(page.getByRole('heading', { name: 'Game Logs' })).toBeVisible();
  await expect.poll(() => gameLogRequests.length).toBeGreaterThan(0);

  const arrivedCount = gameLogRequests.length;
  await page.getByRole('button', { name: 'Apply Filters' }).click();
  await expect.poll(() => gameLogRequests.length).toBeGreaterThan(arrivedCount);

  const reapplied = new URL(gameLogRequests.at(-1));
  expect(reapplied.searchParams.get('playstyle_RTG_min')).toBe('0');
  expect(reapplied.searchParams.get('playstyle_RTG_max')).toBe('80');
});
