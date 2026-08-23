import fs from 'node:fs';
import path from 'node:path';
import {
  averages,
  curryGameLogs,
  E2E_AUTH_STORAGE_KEY,
  expect,
  gameLogs,
  installApiContract,
} from '../fixtures/courtai';
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
  await expect(page.getByRole('heading', { name: 'Game Logs', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: '31', exact: true })).toBeVisible();

  // The prose was scaffolding. The Filter Set it resolved to is the artifact
  // worth keeping, so it goes in the address bar; the prose does not.
  await expect(page).toHaveURL(/player_name=LeBron\+James/);
  await expect(page).toHaveURL(/game_filter=10/);
  expect(new URL(page.url()).searchParams.has('query')).toBe(false);

  await page.getByRole('button', { name: 'Back to search' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { name: 'CourtAI' })).toBeVisible();
  await expect(page.getByRole('textbox')).toHaveValue('');
});

test('@critical a shared link reproduces a prose query with no language model', async ({
  authenticatedPage: page,
}) => {
  const parserCalls = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/api/nl-query') parserCalls.push(request.url());
  });

  await page.goto('/');
  await page.getByRole('textbox').fill('LeBron James last 10 games');
  await page.getByRole('textbox').press('Enter');
  await expect(page.getByRole('heading', { name: 'Game Logs', exact: true })).toBeVisible();
  await expect(page).toHaveURL(/player_name=/);

  // What the sender is looking at, opened by someone else.
  const shared = new URL(page.url());
  await page.goto('/');
  parserCalls.length = 0;
  await page.goto(shared.pathname + shared.search);

  await expect(page.getByRole('heading', { name: 'LeBron James', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: '31', exact: true })).toBeVisible();
  expect(parserCalls).toHaveLength(0);
});

test('@critical Back undoes the last filter change', async ({ authenticatedPage: page }) => {
  const gameLogRequests = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/api/games/game_logs') {
      gameLogRequests.push(new URL(request.url()));
    }
  });

  await page.goto('/?player_name=LeBron+James');
  await expect(page.getByRole('heading', { name: 'Game Logs', exact: true })).toBeVisible();

  await page.getByLabel('Last N games:').fill('5');
  await page.getByRole('button', { name: 'Apply Filters' }).click();
  await expect(page).toHaveURL(/game_filter=5/);
  await expect(page.getByText('GAMES <= 5').first()).toBeVisible();

  await page.goBack();
  await expect(page).not.toHaveURL(/game_filter/);
  await expect(page).toHaveURL(/player_name=LeBron\+James/);
  // Undoing has to undo the view, not just the address bar.
  await expect.poll(() => gameLogRequests.length).toBeGreaterThan(2);
  expect(gameLogRequests.at(-1).searchParams.has('game_filter')).toBe(false);
  await expect(page.getByText('GAMES <= 5')).toHaveCount(0);
});

test('@critical leaving is one action however many filters were applied', async ({
  authenticatedPage: page,
}) => {
  await page.goto('/?player_name=LeBron+James');
  await expect(page.getByRole('heading', { name: 'Game Logs', exact: true })).toBeVisible();

  for (const games of ['9', '8', '7']) {
    await page.getByLabel('Last N games:').fill(games);
    await page.getByRole('button', { name: 'Apply Filters' }).click();
    await expect(page).toHaveURL(new RegExp(`game_filter=${games}`));
  }

  await page.getByRole('button', { name: 'Back to search' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { name: 'CourtAI' })).toBeVisible();
});

test('a season the panel cannot express survives an unrelated apply', async ({
  authenticatedPage: page,
}) => {
  const gameLogRequests = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/api/games/game_logs') {
      gameLogRequests.push(request.url());
    }
  });

  await page.goto('/?player_name=LeBron+James&season_filter=2023-24');
  await expect(page.getByRole('heading', { name: 'Game Logs', exact: true })).toBeVisible();

  await page.getByLabel('Last N games:').fill('5');
  await page.getByRole('button', { name: 'Apply Filters' }).click();

  await expect(page).toHaveURL(/season_filter=2023-24/);
  await expect.poll(() => gameLogRequests.length).toBeGreaterThan(1);
  const latest = new URL(gameLogRequests.at(-1));
  expect(latest.searchParams.get('season_filter')).toBe('2023-24');
  expect(latest.searchParams.get('game_filter')).toBe('5');
  // Untouched controls stay absent so the API applies its own defaults.
  expect(latest.searchParams.has('minutes_filter')).toBe(false);
  expect(latest.searchParams.has('location_filter')).toBe(false);
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
  await expect(page.getByRole('heading', { name: 'Game Logs', exact: true })).toBeVisible();

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
  await expect(page.getByRole('heading', { name: 'Game Logs', exact: true })).toBeVisible();

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
  await expect(page.getByRole('heading', { name: 'Game Logs', exact: true })).toBeVisible();

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

  await page.goto('/?player_name=LeBron+James&game_filter=10&location_filter=Both');

  // No prose was typed and no parser was called, yet the workspace is open.
  await expect(page.getByRole('heading', { name: 'Game Logs', exact: true })).toBeVisible();
  await expect.poll(() => gameLogRequests.length).toBeGreaterThan(0);
  const requested = new URL(gameLogRequests.at(-1));
  expect(requested.searchParams.get('player_name')).toBe('LeBron James');
  expect(requested.searchParams.get('game_filter')).toBe('10');
  expect(requested.searchParams.get('location_filter')).toBe('Both');
  await expect(page.getByText('Location: Both')).toHaveCount(3);

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Game Logs', exact: true })).toBeVisible();
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

  await expect(page.getByRole('heading', { name: 'Game Logs', exact: true })).toBeVisible();
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
  await expect(page.getByRole('heading', { name: 'Game Logs', exact: true })).toBeVisible();
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
  await expect(page.getByRole('heading', { name: 'Game Logs', exact: true })).toBeVisible();
  await expect.poll(() => gameLogRequests.length).toBeGreaterThan(0);

  const arrivedCount = gameLogRequests.length;
  // Touch an unrelated control, so the apply is a real change rather than a
  // rewrite of the Filter Set already in the address bar.
  await page.getByLabel('Last N games:').fill('5');
  await page.getByRole('button', { name: 'Apply Filters' }).click();
  await expect.poll(() => gameLogRequests.length).toBeGreaterThan(arrivedCount);

  const reapplied = new URL(gameLogRequests.at(-1));
  expect(reapplied.searchParams.get('playstyle_RTG_min')).toBe('0');
  expect(reapplied.searchParams.get('playstyle_RTG_max')).toBe('80');
  await expect(page).toHaveURL(/playstyle_RTG_min=0/);
});

test('applying a playerless link asks for a player instead of sending a placeholder', async ({
  authenticatedPage: page,
}) => {
  const gameLogRequests = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/api/games/game_logs') {
      gameLogRequests.push(request.url());
    }
  });

  await page.goto('/?game_filter=10');
  await expect(page.getByLabel('Last N games:')).toHaveValue('10');

  await page.getByRole('button', { name: 'Apply Filters' }).click();

  await expect(page.getByRole('alert')).toContainText('Choose a player');
  expect(gameLogRequests).toHaveLength(0);
});

test('@critical clearing a control clears its parameter', async ({ authenticatedPage: page }) => {
  const gameLogRequests = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/api/games/game_logs') {
      gameLogRequests.push(new URL(request.url()));
    }
  });

  await page.goto('/?player_name=LeBron+James&game_filter=10');
  await expect(page.getByRole('heading', { name: 'Game Logs', exact: true })).toBeVisible();
  await expect(page.getByLabel('Last N games:')).toHaveValue('10');

  // Emptying a control is a decision, not silence. It has to be able to say so.
  await page.getByLabel('Last N games:').fill('');
  await page.getByRole('button', { name: 'Apply Filters' }).click();

  await expect(page).not.toHaveURL(/game_filter/);
  await expect.poll(() => gameLogRequests.length).toBeGreaterThan(1);
  expect(gameLogRequests.at(-1).searchParams.has('game_filter')).toBe(false);
  await expect(page.getByText('GAMES <= 10')).toHaveCount(0);
});

test('@critical Back out of the workspace returns to the Query Prompt', async ({
  authenticatedPage: page,
}) => {
  await page.goto('/');
  await page.getByRole('textbox').fill('LeBron James last 10 games');
  await page.getByRole('textbox').press('Enter');
  await expect(page.getByRole('heading', { name: 'Game Logs', exact: true })).toBeVisible();
  await expect(page).toHaveURL(/player_name=/);

  // The browser's own Back button has to leave the workspace, not strand it on
  // a bare route that says something different from what is on screen.
  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { name: 'CourtAI' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Game Logs', exact: true })).toHaveCount(0);
  await expect(page.getByRole('textbox')).toHaveValue('');
});

test('@critical removing every self filter clears its parameter', async ({
  authenticatedPage: page,
}) => {
  const gameLogRequests = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/api/games/game_logs') {
      gameLogRequests.push(new URL(request.url()));
    }
  });

  await page.goto('/?player_name=LeBron+James&self_filters%5BPTS%5D=20%2C60');
  await expect(page.getByRole('heading', { name: 'Game Logs', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Remove PTS filter' })).toBeVisible();

  await page.getByRole('button', { name: 'Remove PTS filter' }).click();
  await page.getByRole('button', { name: 'Apply Filters' }).click();

  await expect(page).not.toHaveURL(/self_filters/);
  await expect.poll(() => gameLogRequests.length).toBeGreaterThan(1);
  expect(gameLogRequests.at(-1).searchParams.has('self_filters[PTS]')).toBe(false);
});

test('@critical Self Filters ranges are the player unfiltered season', async ({
  authenticatedPage: page,
}) => {
  const gameLogRequests = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.pathname === '/api/games/game_logs') gameLogRequests.push(url);
  });

  // Entered already narrowed. The result set on screen holds only the 31-point
  // game, so ranges taken from it could never be widened back out.
  await page.goto('/?player_name=LeBron+James&self_filters%5BPTS%5D=30%2C60');
  await expect(page.getByRole('heading', { name: 'Game Logs', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: '31', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: '27', exact: true })).toHaveCount(0);
  expect(gameLogRequests).toHaveLength(1);

  await page.getByRole('button', { name: 'Self Filters' }).click();

  await expect.poll(() => gameLogRequests.length).toBe(2);
  expect([...gameLogRequests.at(-1).searchParams.entries()]).toEqual([
    ['player_name', 'LeBron James'],
  ]);

  await page.getByLabel('Self filter stat').selectOption('PTS');
  await expect(page.getByText('PTS: 27.0 - 31.0')).toBeVisible();

  // Everything the disclosure hides sits inside the region it says it controls,
  // both ends of the range included.
  const disclosure = page.getByRole('button', { name: 'Self Filters' });
  await expect(disclosure).toHaveAttribute('aria-expanded', 'true');
  await expect(disclosure).toHaveAttribute('aria-controls', 'self-filter-controls');
  const selfFilterControls = page.locator('#self-filter-controls');
  await expect(selfFilterControls.getByLabel('Self filter stat')).toBeVisible();
  await expect(selfFilterControls.getByLabel('Lower thumb')).toBeVisible();
  await expect(selfFilterControls.getByLabel('Upper thumb')).toBeVisible();

  // The season bounds the slider, so the filter the user arrived with can be
  // widened back out again.
  await page.getByRole('button', { name: 'Add self filter' }).click();
  await page.getByRole('button', { name: 'Apply Filters' }).click();

  await expect.poll(() => gameLogRequests.length).toBe(3);
  expect(gameLogRequests.at(-1).searchParams.get('self_filters[PTS]')).toBe('27,31');
  await expect(page.getByRole('cell', { name: '27', exact: true })).toBeVisible();

  // Closed, the control is gone but what it already applied is not: a filter
  // that arrived on a link stays readable and removable without opening it.
  await disclosure.click();
  await expect(disclosure).toHaveAttribute('aria-expanded', 'false');
  await expect(selfFilterControls).toHaveCount(0);
  const appliedSelfFilters = page.getByRole('group', { name: 'Applied self filters' });
  await expect(appliedSelfFilters.getByRole('button', { name: 'Remove PTS filter' })).toBeVisible();
});

test('an open Self Filters control follows a player change to that season', async ({
  authenticatedPage: page,
}) => {
  const seasonRequests = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (
      url.pathname === '/api/games/game_logs' &&
      [...url.searchParams.keys()].join() === 'player_name'
    ) {
      seasonRequests.push(url.searchParams.get('player_name'));
    }
  });

  await page.goto('/?player_name=LeBron+James&game_filter=10');
  await expect(page.getByRole('heading', { name: 'Game Logs', exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Self Filters' }).click();
  await expect.poll(() => seasonRequests).toEqual(['LeBron James']);
  await page.getByLabel('Self filter stat').selectOption('PTS');
  await expect(page.getByText('PTS: 27.0 - 31.0')).toBeVisible();

  await page.getByLabel('Player:').fill('Stephen');
  await page.getByRole('option', { name: 'Stephen Curry' }).click();

  await expect.poll(() => seasonRequests).toEqual(['LeBron James', 'Stephen Curry']);
  // The ranges on offer are this player's, not the one we arrived on.
  await page.getByLabel('Self filter stat').selectOption('PTS');
  await expect(page.getByText('PTS: 18.0 - 42.0')).toBeVisible();
});

test('a superseded season never bounds the player on screen', async ({
  authenticatedPage: page,
}) => {
  let release;
  const held = new Promise((resolve) => {
    release = resolve;
  });
  await page.route('**/api/games/game_logs**', async (route) => {
    const url = new URL(route.request().url());
    const player = url.searchParams.get('player_name');
    const isSeason = [...url.searchParams.keys()].join() === 'player_name';
    if (isSeason && player === 'LeBron James') await held;
    try {
      await route.fulfill({
        json: {
          game_logs: player === 'Stephen Curry' ? curryGameLogs : gameLogs,
          averages: [averages],
          season_averages: [averages],
          next_game: 'Atlanta Hawks',
        },
      });
    } catch {
      // The browser gave up on this request while it was held. Nothing to send.
    }
  });

  await page.goto('/?player_name=LeBron+James&game_filter=10');
  await expect(page.getByRole('heading', { name: 'Game Logs', exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Self Filters' }).click();
  await page.getByLabel('Player:').fill('Stephen');
  await page.getByRole('option', { name: 'Stephen Curry' }).click();

  await page.getByLabel('Self filter stat').selectOption('PTS');
  await expect(page.getByText('PTS: 18.0 - 42.0')).toBeVisible();

  // The season asked for before the player changed arrives late. It belongs to
  // nobody on screen, so it must change nothing.
  release();
  await expect(page.getByText('PTS: 27.0 - 31.0')).toHaveCount(0);
  await expect(page.getByText('PTS: 18.0 - 42.0')).toBeVisible();
});

test('a player left and returned to gets a fresh season request', async ({
  authenticatedPage: page,
}) => {
  const seasonRequests = [];
  const cancelledSeasonRequests = [];
  const isSeasonUrl = (url) =>
    url.pathname === '/api/games/game_logs' &&
    [...url.searchParams.keys()].join() === 'player_name';

  page.on('request', (request) => {
    const url = new URL(request.url());
    if (isSeasonUrl(url)) seasonRequests.push(url.searchParams.get('player_name'));
  });
  page.on('requestfailed', (request) => {
    const url = new URL(request.url());
    if (isSeasonUrl(url)) cancelledSeasonRequests.push(url.searchParams.get('player_name'));
  });

  let release;
  const held = new Promise((resolve) => {
    release = resolve;
  });
  let leBronSeasonCount = 0;
  await page.route('**/api/games/game_logs**', async (route) => {
    const url = new URL(route.request().url());
    const player = url.searchParams.get('player_name');
    if (isSeasonUrl(url) && player === 'LeBron James') {
      leBronSeasonCount += 1;
      // Only the first one waits, so the request that answers the return is
      // deterministically the second.
      if (leBronSeasonCount === 1) await held;
    }
    try {
      await route.fulfill({
        json: {
          game_logs: player === 'Stephen Curry' ? curryGameLogs : gameLogs,
          averages: [averages],
          season_averages: [averages],
          next_game: 'Atlanta Hawks',
        },
      });
    } catch {
      // The browser gave up on this request while it was held. Nothing to send.
    }
  });

  await page.goto('/?player_name=LeBron+James&game_filter=10');
  await expect(page.getByRole('heading', { name: 'Game Logs', exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Self Filters' }).click();
  await expect.poll(() => seasonRequests).toEqual(['LeBron James']);

  await page.getByLabel('Player:').fill('Stephen');
  await page.getByRole('option', { name: 'Stephen Curry' }).click();
  await page.getByLabel('Self filter stat').selectOption('PTS');
  await expect(page.getByText('PTS: 18.0 - 42.0')).toBeVisible();

  // Back to the player we started on. The first request for them was abandoned
  // on the way out, so returning has to ask again rather than wait on it.
  await page.getByLabel('Player:').fill('LeBron');
  await page.getByRole('option', { name: 'LeBron James' }).click();
  await expect
    .poll(() => seasonRequests)
    .toEqual(['LeBron James', 'Stephen Curry', 'LeBron James']);
  await page.getByLabel('Self filter stat').selectOption('PTS');
  await expect(page.getByText('PTS: 27.0 - 31.0')).toBeVisible();

  // The abandoned first request answers at last, for the player now on screen.
  // It is not the request anyone is waiting on, so it changes nothing.
  release();
  await expect(page.getByText('PTS: 18.0 - 42.0')).toHaveCount(0);
  await expect(page.getByText('PTS: 27.0 - 31.0')).toBeVisible();
  expect(cancelledSeasonRequests).toEqual(['LeBron James']);
});

test('leaving the Workspace cancels a season still in flight', async ({
  authenticatedPage: page,
}) => {
  const cancelledSeasonRequests = [];
  page.on('requestfailed', (request) => {
    const url = new URL(request.url());
    if (
      url.pathname === '/api/games/game_logs' &&
      [...url.searchParams.keys()].join() === 'player_name'
    ) {
      cancelledSeasonRequests.push(url.searchParams.get('player_name'));
    }
  });

  let release;
  const held = new Promise((resolve) => {
    release = resolve;
  });
  await page.route('**/api/games/game_logs**', async (route) => {
    const url = new URL(route.request().url());
    if ([...url.searchParams.keys()].join() === 'player_name') await held;
    try {
      await route.fulfill({
        json: {
          game_logs: gameLogs,
          averages: [averages],
          season_averages: [averages],
          next_game: 'Atlanta Hawks',
        },
      });
    } catch {
      // The browser gave up on this request while it was held. Nothing to send.
    }
  });

  await page.goto('/?player_name=LeBron+James&game_filter=10');
  await expect(page.getByRole('heading', { name: 'Game Logs', exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Self Filters' }).click();
  await expect(page.getByText('Loading the season for this player…')).toBeVisible();

  // The slowest endpoint in the application does not keep working for a
  // workspace nobody is in any more.
  await page.getByRole('button', { name: 'Back to search' }).click();
  await expect(page.getByRole('textbox')).toBeVisible();
  await expect.poll(() => cancelledSeasonRequests).toEqual(['LeBron James']);
  release();
});

test('a season that fails to load says so, and loads on re-opening', async ({
  authenticatedPage: page,
}) => {
  const seasonRequests = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (
      url.pathname === '/api/games/game_logs' &&
      [...url.searchParams.keys()].join() === 'player_name'
    ) {
      seasonRequests.push(url.searchParams.get('player_name'));
    }
  });
  let seasonAttempts = 0;
  await installApiContract(page, {
    '/api/games/game_logs': (request) => {
      const url = new URL(request.url());
      if ([...url.searchParams.keys()].join() === 'player_name') {
        seasonAttempts += 1;
        // The first attempt fails, the retry succeeds, so the message has to
        // both appear and go away.
        if (seasonAttempts === 1) {
          return { status: 500, body: { error: 'The season could not be loaded.' } };
        }
      }
      return {
        body: {
          game_logs: gameLogs,
          averages: [averages],
          season_averages: [averages],
          next_game: 'Atlanta Hawks',
        },
      };
    },
  });

  await page.goto('/?player_name=LeBron+James&game_filter=10');
  await expect(page.getByRole('heading', { name: 'Game Logs', exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Self Filters' }).click();
  // An empty stat list with no explanation is indistinguishable from a player
  // with no stats.
  const failure = page.getByRole('status').filter({ hasText: 'could not be loaded' });
  await expect(failure).toBeVisible();

  await page.getByRole('button', { name: 'Self Filters' }).click();
  await page.getByRole('button', { name: 'Self Filters' }).click();

  await expect.poll(() => seasonRequests).toEqual(['LeBron James', 'LeBron James']);
  await expect(failure).toHaveCount(0);
  await page.getByLabel('Self filter stat').selectOption('PTS');
  await expect(page.getByText('PTS: 27.0 - 31.0')).toBeVisible();
});

test('a session that never opens Self Filters pays for no extra request', async ({
  authenticatedPage: page,
}) => {
  const gameLogRequests = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.pathname === '/api/games/game_logs') gameLogRequests.push(url);
  });

  await page.goto('/?player_name=LeBron+James&game_filter=10');
  await expect(page.getByRole('heading', { name: 'Game Logs', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: '31', exact: true })).toBeVisible();

  await page.getByLabel('Last N games:').fill('5');
  await page.getByRole('button', { name: 'Apply Filters' }).click();

  await expect.poll(() => gameLogRequests.length).toBe(2);
  // The slowest endpoint in the application is only asked for the season when
  // the control that needs it is opened.
  expect(gameLogRequests.every((url) => url.searchParams.has('game_filter'))).toBe(true);
});

test('@critical the escape hatch reaches a result with no language model', async ({
  authenticatedPage: page,
}) => {
  const parserCalls = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/api/nl-query') parserCalls.push(request.url());
  });
  await page.goto('/');

  await page.getByRole('button', { name: 'Browse without a query' }).click();
  await expect(page).toHaveURL(/\?browse=1$/);
  await expect(page.getByLabel('Player:')).toBeVisible();

  await page.getByLabel('Player:').fill('LeBron');
  await page.getByRole('option', { name: 'LeBron James' }).click();

  await expect(page.getByRole('heading', { name: 'Game Logs', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: '31', exact: true })).toBeVisible();
  expect(parserCalls).toHaveLength(0);
});

test('@critical the manual entry control is present but disabled when signed out', async ({
  page,
}) => {
  await installApiContract(page);
  await page.goto('/');

  // Rendered rather than hidden, so the page does not shift on sign-in and the
  // capability is discoverable before you have an account.
  const browse = page.getByRole('button', { name: 'Browse without a query' });
  await expect(browse).toBeVisible();
  await expect(browse).toBeDisabled();

  await page.getByRole('button', { name: 'Sign in with Google' }).click();
  await expect(browse).toBeEnabled();
});

test('an empty workspace is shareable, and the sentinel never reaches a request', async ({
  authenticatedPage: page,
}) => {
  const gameLogRequests = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/api/games/game_logs') {
      gameLogRequests.push(new URL(request.url()));
    }
  });

  await page.goto('/?browse=1');
  await expect(page.getByLabel('Player:')).toBeVisible();
  expect(gameLogRequests).toHaveLength(0);

  await page.getByLabel('Player:').fill('LeBron');
  await page.getByRole('option', { name: 'LeBron James' }).click();

  await expect.poll(() => gameLogRequests.length).toBeGreaterThan(0);
  expect(gameLogRequests.at(-1).searchParams.has('browse')).toBe(false);

  // Applying puts real filters in the URL, and the sentinel has stopped being
  // true, so it goes.
  await page.getByLabel('Last N games:').fill('5');
  await page.getByRole('button', { name: 'Apply Filters' }).click();
  await expect(page).toHaveURL(/game_filter=5/);
  await expect(page).not.toHaveURL(/browse/);
});

test('the sentinel is dropped when it arrives alongside filters', async ({
  authenticatedPage: page,
}) => {
  await page.goto('/?browse=1&player_name=LeBron+James');

  await expect(page.getByRole('heading', { name: 'Game Logs', exact: true })).toBeVisible();
  await expect(page).not.toHaveURL(/browse/);
  await expect(page).toHaveURL(/player_name=LeBron\+James/);
});

test('the sentinel is dropped without destroying a link we must refuse', async ({
  authenticatedPage: page,
}) => {
  await page.goto('/?browse=1&game_filter=0');

  // Dropping the sentinel must not take the offending parameter with it: a
  // refusal that names nothing, on a bare route, is worse than no refusal.
  await expect(page.getByRole('alert')).toContainText('game_filter');
  await expect(page).toHaveURL(/game_filter=0/);
  await expect(page).not.toHaveURL(/browse/);
});

test('@critical changing player keeps the Filter Set', async ({ authenticatedPage: page }) => {
  const gameLogRequests = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/api/games/game_logs') {
      gameLogRequests.push(new URL(request.url()));
    }
  });

  await page.goto('/?player_name=LeBron+James');
  await expect(page.getByRole('heading', { name: 'Game Logs', exact: true })).toBeVisible();

  await page.getByLabel('Last N games:').fill('5');
  await page.getByRole('button', { name: 'Apply Filters' }).click();
  await expect.poll(() => gameLogRequests.length).toBeGreaterThan(1);
  const appliedCount = gameLogRequests.length;

  await page.getByLabel('Player:').fill('Stephen');
  await page.getByRole('option', { name: 'Stephen Curry' }).click();

  // Comparing two players under identical conditions is one action, so the
  // filter the user applied is still on the wire for the new player.
  await expect.poll(() => gameLogRequests.length).toBeGreaterThan(appliedCount);
  const afterChange = gameLogRequests.at(-1);
  expect(afterChange.searchParams.get('player_name')).toBe('Stephen Curry');
  expect(afterChange.searchParams.get('game_filter')).toBe('5');

  await expect(page).toHaveURL(/player_name=Stephen\+Curry/);
  await expect(page).toHaveURL(/game_filter=5/);
});

test('the applied-filter badges describe the data after a player change', async ({
  authenticatedPage: page,
}) => {
  // The shared contract answers every player identically, which cannot tell
  // "the new player's rows arrived" from "the old player's rows never left".
  // Registered after the contract, so it wins for this journey only.
  await page.route('**/api/games/game_logs**', async (route) => {
    const requested = new URL(route.request().url()).searchParams.get('player_name');
    const points = requested === 'Stephen Curry' ? 77 : 31;
    await route.fulfill({
      json: {
        game_logs: [{ ...gameLogs[0], PTS: points }, gameLogs[1]],
        averages: [averages],
        season_averages: [averages],
        next_game: 'Atlanta Hawks',
      },
    });
  });

  await page.goto('/?player_name=LeBron+James&game_filter=5');
  await expect(page.getByRole('cell', { name: '31', exact: true })).toBeVisible();
  const badgePlaces = await page.getByText('GAMES <= 5').count();
  expect(badgePlaces).toBe(3);

  await page.getByLabel('Player:').fill('Stephen');
  await page.getByRole('option', { name: 'Stephen Curry' }).click();

  // The new player's rows are what is on screen, and every place the badges
  // render is still describing the Filter Set that fetched them.
  await expect(page.getByRole('cell', { name: '77', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: '31', exact: true })).toBeHidden();
  await expect(page).toHaveURL(/player_name=Stephen\+Curry/);
  await expect(page.getByText('GAMES <= 5')).toHaveCount(badgePlaces);
});

test("a player change never leaves the previous player's rows under the new name", async ({
  authenticatedPage: page,
}) => {
  let release;
  const held = new Promise((resolve) => {
    release = resolve;
  });
  await page.route('**/api/games/game_logs**', async (route) => {
    if (new URL(route.request().url()).searchParams.get('player_name') === 'Stephen Curry') {
      await held;
    }
    await route.fulfill({
      json: {
        game_logs: gameLogs,
        averages: [averages],
        season_averages: [averages],
        next_game: 'Atlanta Hawks',
      },
    });
  });

  await page.goto('/?player_name=LeBron+James');
  await expect(page.getByRole('cell', { name: '31', exact: true })).toBeVisible();

  await page.getByLabel('Player:').fill('Stephen');
  await page.getByRole('option', { name: 'Stephen Curry' }).click();

  // The request is still in flight, so there is no data for the player now
  // named on screen. Showing the previous player's is worse than showing none.
  await expect(page.getByRole('cell', { name: '31', exact: true })).toBeHidden();
  await expect(page.getByText('Loading game logs…')).toBeVisible();

  release();
  await expect(page.getByRole('cell', { name: '31', exact: true })).toBeVisible();
});

test('a refused link is not quietly replaced by choosing a player', async ({
  authenticatedPage: page,
}) => {
  const gameLogRequests = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/api/games/game_logs') {
      gameLogRequests.push(new URL(request.url()));
    }
  });

  await page.goto('/?player_name=LeBron+James&game_filter=0');
  await expect(page.getByRole('alert')).toContainText('game_filter');

  // The refusal withheld the whole Filter Set, so there is nothing to show, edit,
  // or patch a player into. Offering controls that cannot act on it would invite
  // an apply that drops the parameter the alert is naming and loads unfiltered
  // data the link never asked for.
  await expect(page.getByLabel('Player:')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Apply Filters' })).toBeHidden();
  await expect(page).toHaveURL(/game_filter=0/);
  expect(gameLogRequests).toHaveLength(0);

  // Leaving is still one action, so the refusal is never a dead end.
  await page.getByRole('button', { name: 'Back to search' }).click();
  await expect(page.getByRole('textbox')).toBeVisible();
});

test('a refused link keeps its explanation when prose names no player', async ({
  authenticatedPage: page,
}) => {
  await installApiContract(page, {
    '/api/nl-query': { body: { game_count: 10, confidence: 0.9 } },
  });
  await page.goto('/?player_name=LeBron+James&game_filter=0');
  await expect(page.getByRole('alert')).toContainText('game_filter');

  // Reached from the keyboard: the toggle is overlapped by the header in the
  // workspace, which is a separate pre-existing defect on every link, not this
  // one's to fix.
  await page.getByRole('button', { name: 'Open search' }).press('Enter');
  await page.getByRole('textbox').fill('last 10 games');
  await page.getByRole('textbox').press('Enter');

  // The advice to choose a player points at a selector a refused link does not
  // render. Replacing the alert that names the real problem with it would leave
  // the user holding neither.
  await expect(page.getByRole('alert')).toContainText('game_filter');
  await expect(page.getByText('Choose a player before applying these filters.')).toBeHidden();
});

test('a slow request never claims the result was empty', async ({ authenticatedPage: page }) => {
  let release;
  const held = new Promise((resolve) => {
    release = resolve;
  });
  await page.route('**/api/games/game_logs**', async (route) => {
    if (new URL(route.request().url()).searchParams.has('game_filter')) {
      await held;
    }
    await route.fulfill({
      json: {
        game_logs: gameLogs,
        averages: [averages],
        season_averages: [averages],
        next_game: 'Atlanta Hawks',
      },
    });
  });

  await page.goto('/?player_name=LeBron+James');
  await expect(page.getByRole('cell', { name: '31', exact: true })).toBeVisible();

  await page.getByLabel('Last N games:').fill('5');
  await page.getByRole('button', { name: 'Apply Filters' }).click();

  // "No game logs to display" is a finding. A request that has not answered yet
  // has not found anything, and a user who acts on that reads a real result.
  await expect(page.getByText('Loading game logs…')).toBeVisible();
  await expect(page.getByText('No game logs to display')).toBeHidden();

  release();
  await expect(page.getByRole('cell', { name: '31', exact: true })).toBeVisible();
});

test('a link carrying filters but no player applies them to the player chosen', async ({
  authenticatedPage: page,
}) => {
  const gameLogRequests = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/api/games/game_logs') {
      gameLogRequests.push(new URL(request.url()));
    }
  });

  await page.goto('/?game_filter=10');
  expect(gameLogRequests).toHaveLength(0);

  await page.getByLabel('Player:').fill('LeBron');
  await page.getByRole('option', { name: 'LeBron James' }).click();

  await expect.poll(() => gameLogRequests.length).toBeGreaterThan(0);
  const requested = gameLogRequests.at(-1);
  expect(requested.searchParams.get('player_name')).toBe('LeBron James');
  expect(requested.searchParams.get('game_filter')).toBe('10');
});
