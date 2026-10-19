import fs from 'node:fs';
import path from 'node:path';
import {
  averages,
  curryGameLogs,
  E2E_AUTH_STORAGE_KEY,
  expect,
  gameLogs,
  installApiContract,
  RATE_LIMITED,
} from '../fixtures/courtai';
import { test } from '../fixtures/deployedSmoke';

// The signed-in landing reads the ladder rungs' Game Logs (all Jalen Johnson) on
// its own; request-seam assertions count only the Log Workspace's requests.
const isWorkspaceGameLogs = (requestUrl) => {
  const url = new URL(requestUrl);
  return (
    url.pathname === '/api/games/game_logs' &&
    url.searchParams.get('player_name') !== 'Jalen Johnson'
  );
};

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

  await expect(page.getByRole('heading', { name: 'Ask the box score' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign in with Google' })).toBeVisible();
  await expect(page.getByRole('textbox')).toBeEnabled();
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

test('@smoke production Matchup API routing reaches authenticated backend', async ({ request }) => {
  test.skip(!process.env.E2E_BASE_URL, 'Only meaningful against a deployed environment.');
  test.skip(
    process.env.E2E_PROTECTED_PREVIEW === 'true',
    'Production-only check avoids forwarding the protected-preview cookie through the proxy.',
  );

  const response = await request.get(
    new URL('/api/games/matchup?game_id=0022500584', process.env.E2E_BASE_URL).href,
  );

  expect(response.status()).toBe(401);
  expect(response.headers()['content-type']).toContain('application/json');
  await expect(response.json()).resolves.toMatchObject({
    error: { code: 'authentication_required' },
  });
});

// Release Check (crf04/statsplus#249). The checks below run logged out against a
// deployed frontend (E2E_BASE_URL), the API it serves (E2E_API_BASE_URL) and the
// MCP server (E2E_MCP_BASE_URL). They only read: every browser request must be a
// GET, and the one POST, an unauthenticated /mcp call, is refused before it acts.
const apiBaseUrl = () =>
  process.env.E2E_API_BASE_URL || 'https://statsplus-backend-production.up.railway.app';
const mcpBaseUrl = () => process.env.E2E_MCP_BASE_URL || 'https://mcp.courtai.app';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

const requireDeployedTarget = () =>
  test.skip(!process.env.E2E_BASE_URL, 'The Release Check needs a deployed frontend.');

const collectWrites = (page) => {
  const writes = [];
  page.on('request', (request) => {
    if (!SAFE_METHODS.has(request.method())) writes.push(`${request.method()} ${request.url()}`);
  });
  return writes;
};

const getJson = async (request, url) => {
  const response = await request.get(url);
  expect(response.status(), url).toBe(200);
  return response.json();
};

// The public home reads the Slate and its Edges anonymously. The page asks for
// the most recent game day when today has none, so the check does too.
const readPublicSlate = async (request) => {
  const query = '?fallback=previous_game_day';
  const slate = await getJson(request, `${apiBaseUrl()}/api/games/slate${query}`);
  const edges = await getJson(request, `${apiBaseUrl()}/api/games/slate/edges${query}`);
  expect(slate.games.length, 'the API serves at least one game').toBeGreaterThan(0);
  const edgeGames = edges.games.filter((game) => game.effects.length > 0);
  expect(edgeGames.length, 'the API serves edges for at least one game').toBeGreaterThan(0);
  const slateGame = (id) => slate.games.find((game) => game.game_id === id);
  return { slate, edgeGames, slateGame };
};

const lastName = (name) => {
  const parts = name.split(' ');
  while (parts.length > 1 && ['Jr.', 'Sr.', 'II', 'III', 'IV'].includes(parts.at(-1))) parts.pop();
  return parts.at(-1);
};
const signedPercent = (value) => {
  const shown = Math.abs(value * 100).toFixed(0);
  return `${Number(shown) === 0 ? '' : value > 0 ? '+' : '−'}${shown}%`;
};

test('@smoke public home Slate renders the games and edges the API serves', async ({
  deployedPage: page,
  request,
}) => {
  requireDeployedTarget();
  const writes = collectWrites(page);
  const { slate, edgeGames, slateGame } = await readPublicSlate(request);

  await page.goto('/');

  for (const game of slate.games) {
    await expect(page.locator(`a[href="/matchups/${game.game_id}"]`)).toBeVisible();
  }
  for (const edgeGame of edgeGames.slice(0, 3)) {
    const { away_team: away, home_team: home } = slateGame(edgeGame.game_id);
    const cell = page.locator(`a[href="/matchups/${edgeGame.game_id}"]`);
    await expect(cell).toContainText(`${away.tricode} @ ${home.tricode}`);
    for (const effect of edgeGame.effects) {
      await expect(cell).toContainText(lastName(effect.name));
      await expect(cell).toContainText(signedPercent(effect.value));
    }
  }
  expect(writes).toEqual([]);
});

test('@smoke Matchup deep links from the Slate resolve and their data is served', async ({
  deployedPage: page,
  request,
}) => {
  requireDeployedTarget();
  const writes = collectWrites(page);
  const { edgeGames } = await readPublicSlate(request);
  const gameId = edgeGames[0].game_id;

  // A Matchup is a signed-in read: logged out, the real route answers with its
  // sign-in gate (not the landing redirect or a blank page) and the API answers
  // for that game with the stable authentication error, not a 404 or a 5xx.
  await page.goto('/');
  await page.locator(`a[href="/matchups/${gameId}"]`).click();
  await expect(page).toHaveURL(new RegExp(`/matchups/${gameId}$`));
  await expect(page.getByRole('heading', { name: 'Sign in to view this matchup' })).toBeVisible();

  const response = await request.get(`${apiBaseUrl()}/api/games/matchup?game_id=${gameId}`);
  expect(response.status()).toBe(401);
  await expect(response.json()).resolves.toMatchObject({
    error: { code: 'authentication_required' },
  });
  expect(writes).toEqual([]);
});

test('@smoke MCP serves OAuth authorization-server metadata for its own issuer', async ({
  request,
}) => {
  requireDeployedTarget();
  const mcp = new URL(mcpBaseUrl());
  const metadata = await getJson(request, `${mcp.origin}/.well-known/oauth-authorization-server`);

  expect(new URL(metadata.issuer).origin).toBe(mcp.origin);
  for (const endpoint of ['authorization_endpoint', 'token_endpoint']) {
    expect(new URL(metadata[endpoint]).origin, endpoint).toBe(mcp.origin);
  }
});

test('@smoke MCP rejects an unauthenticated /mcp request with the protected-resource challenge', async ({
  request,
}) => {
  requireDeployedTarget();
  const mcp = new URL(mcpBaseUrl());
  const response = await request.post(`${mcp.origin}/mcp`, { data: {} });

  expect(response.status()).toBe(401);
  const challenge = response.headers()['www-authenticate'] ?? '';
  expect(challenge).toMatch(/^Bearer /);
  const resourceMetadata = /resource_metadata="([^"]+)"/.exec(challenge)?.[1];
  expect(resourceMetadata, 'the challenge names the protected-resource metadata').toBeTruthy();
  expect(new URL(resourceMetadata).origin).toBe(mcp.origin);
  const protectedResource = await getJson(request, resourceMetadata);
  expect(new URL(protectedResource.resource).origin).toBe(mcp.origin);
});

test('@critical the development auth adapter unlocks the search seam', async ({ page }) => {
  await installApiContract(page);
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Ask the box score' })).toBeVisible();
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
  await expect(page.getByRole('heading', { name: 'Ask the box score' })).toBeVisible();
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
  // Make the two Filter Sets observably different at the HTTP seam.
  await page.route('**/api/games/game_logs*', async (route) => {
    const url = new URL(route.request().url());
    gameLogRequests.push(url);
    await route.fulfill({
      json: {
        game_logs: url.searchParams.get('game_filter') === '1' ? gameLogs.slice(0, 1) : gameLogs,
        averages: [averages],
        season_averages: [averages],
        next_game: 'Atlanta Hawks',
      },
    });
  });

  await page.goto('/?player_name=LeBron+James');
  await expect(page.getByRole('heading', { name: 'Game Logs', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: '27', exact: true })).toBeVisible();

  if (await page.getByRole('button', { name: 'Done', exact: true }).isVisible())
    await page.getByRole('button', { name: 'Done', exact: true }).click();
  if (!(await page.getByLabel('Last N games', { exact: true }).isVisible()))
    await page.getByTestId('filter-panel').getByRole('button', { name: '+ Last N' }).click();
  await page.getByLabel('Last N games', { exact: true }).fill('1');
  await page.getByRole('button', { name: /^Apply/ }).click();
  await expect(page).toHaveURL(/game_filter=1/);
  await expect(page.getByText('GAMES <= 1').first()).toBeVisible();
  await expect(page.getByRole('cell', { name: '31', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: '27', exact: true })).toHaveCount(0);
  expect(gameLogRequests.at(-1).searchParams.get('game_filter')).toBe('1');
  const requestsBeforeBack = gameLogRequests.length;

  await page.goBack();
  await expect(page).not.toHaveURL(/game_filter/);
  await expect(page).toHaveURL(/player_name=LeBron\+James/);
  // Cached navigation must restore the table as well as its URL and badges.
  await expect(page.getByRole('cell', { name: '27', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: '31', exact: true })).toBeVisible();
  await expect(page.getByText('GAMES <= 1')).toHaveCount(0);
  expect(gameLogRequests).toHaveLength(requestsBeforeBack);
});

test('@critical leaving is one action however many filters were applied', async ({
  authenticatedPage: page,
}) => {
  await page.goto('/?player_name=LeBron+James');
  await expect(page.getByRole('heading', { name: 'Game Logs', exact: true })).toBeVisible();

  for (const games of ['9', '8', '7']) {
    if (await page.getByRole('button', { name: 'Done', exact: true }).isVisible())
      await page.getByRole('button', { name: 'Done', exact: true }).click();
    if (!(await page.getByLabel('Last N games', { exact: true }).isVisible()))
      await page.getByTestId('filter-panel').getByRole('button', { name: '+ Last N' }).click();
    await page.getByLabel('Last N games', { exact: true }).fill(games);
    await page.getByRole('button', { name: /^Apply/ }).click();
    await expect(page).toHaveURL(new RegExp(`game_filter=${games}`));
  }

  await page.getByRole('button', { name: 'Back to search' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { name: 'Ask the box score' })).toBeVisible();
});

test('a season the panel cannot express survives an unrelated apply', async ({
  authenticatedPage: page,
}) => {
  const gameLogRequests = [];
  page.on('request', (request) => {
    if (isWorkspaceGameLogs(request.url())) {
      gameLogRequests.push(request.url());
    }
  });

  await page.goto('/?player_name=LeBron+James&season_filter=2023-24');
  await expect(page.getByRole('heading', { name: 'Game Logs', exact: true })).toBeVisible();

  if (await page.getByRole('button', { name: 'Done', exact: true }).isVisible())
    await page.getByRole('button', { name: 'Done', exact: true }).click();
  if (!(await page.getByLabel('Last N games', { exact: true }).isVisible()))
    await page.getByTestId('filter-panel').getByRole('button', { name: '+ Last N' }).click();
  await page.getByLabel('Last N games', { exact: true }).fill('5');
  // Observe both initial game-log reads before Apply.
  await expect.poll(() => gameLogRequests.length).toBe(2);
  const requestsBeforeApply = gameLogRequests.length;
  await page.getByRole('button', { name: /^Apply/ }).click();

  await expect(page).toHaveURL(/season_filter=2023-24/);
  // Observe the new Apply request without constraining unrelated defaults.
  await expect.poll(() => gameLogRequests.length).toBe(requestsBeforeApply + 1);
  const applied = new URL(gameLogRequests[requestsBeforeApply]).searchParams;
  expect(applied.get('player_name')).toBe('LeBron James');
  expect(applied.get('season_filter')).toBe('2023-24');
  expect(applied.get('game_filter')).toBe('5');
  // Untouched controls stay absent so the API applies its own defaults.
  expect(applied.has('minutes_filter')).toBe(false);
  expect(applied.has('location_filter')).toBe(false);
});

test('@critical the query reference is linkable and hands an example back to search', async ({
  authenticatedPage: page,
}) => {
  await page.goto('/');

  await page.getByRole('link', { name: 'All filters' }).click();
  await expect(page).toHaveURL(/\/help$/);
  await expect(page.getByRole('heading', { name: 'Query reference' })).toBeVisible();
  await expect(page.getByRole('rowheader', { name: 'Less Than 10 ft' })).toBeVisible();

  // The reference survives a reload because it is a route, not an overlay.
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Query reference' })).toBeVisible();

  const example = 'Giannis games at home with 10+ FGA playing 30+ minutes';
  await page.getByRole('link', { name: example }).click();
  await expect(page.getByRole('heading', { name: 'Ask the box score' })).toBeVisible();
  await expect(page.getByRole('textbox')).toHaveValue(example);
});

test('@critical consulting the reference does not discard a half-typed query', async ({
  authenticatedPage: page,
}) => {
  await page.goto('/');

  const draft = 'Luka last 10 games';
  await page.getByRole('textbox').fill(draft);
  await page.getByRole('link', { name: 'All filters' }).click();

  await expect(page.getByRole('heading', { name: 'Query reference' })).toBeFocused();

  await page.getByRole('link', { name: 'Back to search' }).click();
  await expect(page.getByRole('textbox')).toHaveValue(draft);

  // The browser's own Back button has to restore it too, not just our link.
  await page.getByRole('link', { name: 'All filters' }).click();
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

  await page.getByRole('link', { name: 'All filters' }).click();
  await expect(page.getByRole('rowheader', { name: 'PRRollMan' })).toBeVisible();
  expect(await overflowsHorizontally()).toBe(false);
});

test('the Log Workspace fits a phone and every control stays tappable', async ({
  authenticatedPage: page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?player_name=LeBron+James&game_filter=10');
  await expect(page.getByRole('heading', { name: 'Game Logs', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Per 36 Minutes Comparison' })).toBeVisible();

  // The wide game-logs table scrolls inside its own container rather than
  // widening the page.
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );

  // Every reading and toggle can be brought wholly on screen by scrolling down
  // the page alone: nothing is clipped past a card's edge or pushed off the
  // left of the page. (Programmatic scrolling would also scroll the clipping
  // containers, which a finger cannot.)
  const readings = [
    page.getByText('Hit Rate', { exact: true }),
    ...['Playtypes', 'Zone Shooting', 'Shooting', 'Misc'].map((name) =>
      page.locator('label').filter({ hasText: new RegExp(`^${name}$`) }),
    ),
  ];
  for (const reading of readings) {
    const box = await reading.boundingBox();
    await page.mouse.wheel(0, box.y - 300);
    await expect(reading).toBeInViewport({ ratio: 1 });
  }
  await page.getByText('Misc', { exact: true }).click();
  await expect(page.getByRole('radio', { name: 'Misc' })).toBeChecked();

  // The floating search toggle does not cover the toolbar.
  await page.evaluate(() => window.scrollTo(0, 0));
  const save = page.getByRole('button', { name: 'Save Filter Set' });
  const saveBox = await save.boundingBox();
  const searchBox = await page.getByRole('button', { name: 'Open search' }).boundingBox();
  expect(
    saveBox.y + saveBox.height <= searchBox.y ||
      searchBox.y + searchBox.height <= saveBox.y ||
      saveBox.x + saveBox.width <= searchBox.x ||
      searchBox.x + searchBox.width <= saveBox.x,
  ).toBe(true);
  await save.click();
  await expect(page.getByRole('heading', { name: 'Save this Filter Set' })).toBeVisible();
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
    if (isWorkspaceGameLogs(request.url())) {
      gameLogRequests.push(request.url());
    }
  });
  await page.goto('/');
  await page.getByRole('textbox').fill('LeBron James last 10 games');
  await page.getByRole('textbox').press('Enter');
  await expect(page.getByRole('heading', { name: 'Game Logs', exact: true })).toBeVisible();

  if (await page.getByRole('button', { name: 'Done', exact: true }).isVisible())
    await page.getByRole('button', { name: 'Done', exact: true }).click();
  if (!(await page.getByLabel('Last N games', { exact: true }).isVisible()))
    await page.getByTestId('filter-panel').getByRole('button', { name: '+ Last N' }).click();
  await page.getByLabel('Last N games', { exact: true }).fill('5');
  await page.getByRole('button', { name: /^Apply/ }).click();

  await expect.poll(() => gameLogRequests.length).toBeGreaterThan(2);
  const latestRequest = new URL(gameLogRequests.at(-1));
  expect(latestRequest.searchParams.get('game_filter')).toBe('5');
});

test('@critical a manual defensive filter reaches the game-log request seam', async ({
  authenticatedPage: page,
}) => {
  const gameLogRequests = [];
  page.on('request', (request) => {
    if (isWorkspaceGameLogs(request.url())) {
      gameLogRequests.push(request.url());
    }
  });
  await page.goto('/');
  await page.getByRole('textbox').fill('LeBron James last 10 games');
  await page.getByRole('textbox').press('Enter');
  await expect(page.getByRole('heading', { name: 'Game Logs', exact: true })).toBeVisible();

  await page.getByTestId('filter-panel').getByRole('button', { name: '+ Opp. defense' }).click();
  const defensiveFilter = page.getByTestId('filter-panel');
  const fromRank = page.getByRole('slider', { name: 'From rank' });
  const toRank = page.getByRole('slider', { name: 'To rank' });
  // Isolation and Transition are both Play type filters, and the category
  // persists across the two selections below, so one pill click covers both.
  // A filter is addable only once one is picked; the range is always within
  // ranks 1-30, so there is no blank or zero rank left to guard against.
  await page.getByRole('tab', { name: 'Play type' }).click();
  await expect(
    defensiveFilter.getByRole('button', { name: /Pick a metric to add|Add:/ }),
  ).toBeDisabled();
  await page.getByLabel('Defensive metric').selectOption('Isolation');
  // The default range is ranks 21-30 (the 10 that allow the most); five steps up the lower
  // thumb is 26-30, which the backend knows as positions 1-5.
  for (let step = 0; step < 5; step += 1) await fromRank.press('ArrowRight');
  await expect(fromRank).toHaveAttribute('aria-valuenow', '26');
  await expect(page.getByText('26–30', { exact: true })).toBeVisible();
  await defensiveFilter.getByRole('button', { name: /Pick a metric to add|Add:/ }).click();
  await expect(
    page.getByTestId('filter-panel').getByRole('button', { name: /^Remove versus/ }),
  ).toBeVisible();
  await expect(page.getByText('Isolation (ranks 26–30)').first()).toBeVisible();

  await page.getByRole('button', { name: /^Apply/ }).click();

  await expect.poll(() => gameLogRequests.length).toBeGreaterThan(2);
  const latestRequest = new URL(gameLogRequests.at(-1));
  expect(latestRequest.searchParams.getAll('teams_against[]')).toEqual(['Isolation']);
  // A range ending at rank 30 is positions 1-5, sent as the plain count every earlier link used.
  expect(latestRequest.searchParams.getAll('rank_filter[]')).toEqual(['5']);

  // Both ends move: ranks 11-20 is a middle range, sent as low,high, and both
  // filters travel with paired ranks. Applying filters re-renders the panel
  // from appliedFilters and resets the category pill, so it needs clicking again.
  const rankedRequestCount = gameLogRequests.length;
  await page.getByTestId('filter-panel').getByRole('button', { name: '+ Opp. defense' }).click();
  await page.getByRole('tab', { name: 'Play type' }).click();
  await page.getByLabel('Defensive metric').selectOption('Transition');
  for (let step = 0; step < 10; step += 1) await fromRank.press('ArrowLeft');
  for (let step = 0; step < 10; step += 1) await toRank.press('ArrowLeft');
  await expect(fromRank).toHaveAttribute('aria-valuenow', '11');
  await expect(toRank).toHaveAttribute('aria-valuenow', '20');
  await defensiveFilter.getByRole('button', { name: /Pick a metric to add|Add:/ }).click();
  await expect(
    page
      .getByTestId('filter-panel')
      .getByRole('button', { name: /^Remove versus/ })
      .last(),
  ).toBeVisible();
  await expect(page.getByText('Transition (ranks 11–20)').first()).toBeVisible();

  await page.getByRole('button', { name: /^Apply/ }).click();

  await expect.poll(() => gameLogRequests.length).toBeGreaterThan(rankedRequestCount);
  const pairedRequest = new URL(gameLogRequests.at(-1));
  expect(pairedRequest.searchParams.getAll('teams_against[]')).toEqual(['Isolation', 'Transition']);
  expect(pairedRequest.searchParams.getAll('rank_filter[]')).toEqual(['5', '11,20']);
});

test('@critical applying an untouched panel emits only the controls the user moved', async ({
  authenticatedPage: page,
}) => {
  const gameLogRequests = [];
  page.on('request', (request) => {
    if (isWorkspaceGameLogs(request.url())) {
      gameLogRequests.push(request.url());
    }
  });
  await page.goto('/');
  await page.getByRole('textbox').fill('LeBron James last 10 games');
  await page.getByRole('textbox').press('Enter');
  await expect(page.getByRole('heading', { name: 'Game Logs', exact: true })).toBeVisible();

  if (await page.getByRole('button', { name: 'Done', exact: true }).isVisible())
    await page.getByRole('button', { name: 'Done', exact: true }).click();
  if (!(await page.getByLabel('Last N games', { exact: true }).isVisible()))
    await page.getByTestId('filter-panel').getByRole('button', { name: '+ Last N' }).click();
  await page.getByLabel('Last N games', { exact: true }).fill('5');
  await page.getByRole('button', { name: /^Apply/ }).click();

  await expect.poll(() => gameLogRequests.length).toBeGreaterThan(2);
  const latestRequest = new URL(gameLogRequests.at(-1));

  // The one moved control and the player travel; every untouched control stays
  // home so the API applies its own defaults.
  expect([...latestRequest.searchParams.keys()].sort()).toEqual(['game_filter', 'player_name']);
  expect(latestRequest.searchParams.get('game_filter')).toBe('5');
  expect(latestRequest.searchParams.get('player_name')).toBe('LeBron James');

  // Moving a second control keeps the filter the panel was pre-populated with,
  // and still leaves the untouched controls behind.
  const appliedRequestCount = gameLogRequests.length;
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await page.getByTestId('filter-panel').getByRole('button', { name: '+ Since' }).click();
  await page.getByLabel('Since date').fill('2025-01-09');
  await page.getByRole('button', { name: /^Apply/ }).click();

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
    if (isWorkspaceGameLogs(request.url())) {
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
    if (isWorkspaceGameLogs(request.url())) {
      gameLogRequests.push(request.url());
    }
  });

  await page.goto('/?game_filter=10');

  // A Filter Set without a player is partial, not malformed: the panel holds it.
  if (await page.getByRole('button', { name: 'Done', exact: true }).isVisible())
    await page.getByRole('button', { name: 'Done', exact: true }).click();
  if (!(await page.getByLabel('Last N games', { exact: true }).isVisible()))
    await page.getByTestId('filter-panel').getByRole('button', { name: '+ Last N' }).click();
  await expect(page.getByLabel('Last N games', { exact: true })).toHaveValue('10');
  await expect(page.getByRole('alert')).toBeHidden();
  expect(gameLogRequests).toHaveLength(0);
});

test('a link with an unusable value names it and applies nothing', async ({
  authenticatedPage: page,
}) => {
  const gameLogRequests = [];
  page.on('request', (request) => {
    if (isWorkspaceGameLogs(request.url())) {
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
    if (isWorkspaceGameLogs(request.url())) {
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
    if (isWorkspaceGameLogs(request.url())) {
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
  await expect.poll(() => gameLogRequests.length).toBe(2);
  const requested = new URL(
    gameLogRequests.find((url) => new URL(url).searchParams.has('game_filter')),
  );
  expect(requested.searchParams.get('player_name')).toBe('LeBron James');
  expect(requested.searchParams.get('game_filter')).toBe('10');
});

test('a bound the link arrived with survives a later apply', async ({
  authenticatedPage: page,
}) => {
  const gameLogRequests = [];
  page.on('request', (request) => {
    if (isWorkspaceGameLogs(request.url())) {
      gameLogRequests.push(request.url());
    }
  });

  // 0 is the API's own lower playstyle bound, so the panel must be able to hold
  // it. A falsy check here would drop the bound the link arrived with.
  await page.goto('/?player_name=LeBron+James&playstyle_RTG_min=0&playstyle_RTG_max=80');
  await expect(page.getByRole('heading', { name: 'Game Logs', exact: true })).toBeVisible();
  await expect.poll(() => gameLogRequests.length).toBeGreaterThan(0);

  // The label and the thumbs are two separate readings of the same range, and
  // this journey once passed while they disagreed. The playtype control is the
  // first of the two range sliders; both name their thumbs the same way.
  await page
    .getByTestId('filter-panel')
    .getByRole('button', { name: /rating playtype 0–80/ })
    .click();
  await expect(page.getByText('0–80', { exact: true })).toBeVisible();
  const playstyleThumbs = page.getByRole('slider');
  await expect(playstyleThumbs.first()).toHaveAttribute('aria-valuenow', '0');
  await expect(playstyleThumbs.nth(1)).toHaveAttribute('aria-valuenow', '80');

  const arrivedCount = gameLogRequests.length;
  // Touch an unrelated control, so the apply is a real change rather than a
  // rewrite of the Filter Set already in the address bar.
  if (await page.getByRole('button', { name: 'Done', exact: true }).isVisible())
    await page.getByRole('button', { name: 'Done', exact: true }).click();
  if (!(await page.getByLabel('Last N games', { exact: true }).isVisible()))
    await page.getByTestId('filter-panel').getByRole('button', { name: '+ Last N' }).click();
  await page.getByLabel('Last N games', { exact: true }).fill('5');
  await page.getByRole('button', { name: /^Apply/ }).click();
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
    if (isWorkspaceGameLogs(request.url())) {
      gameLogRequests.push(request.url());
    }
  });

  await page.goto('/?game_filter=10');
  if (await page.getByRole('button', { name: 'Done', exact: true }).isVisible())
    await page.getByRole('button', { name: 'Done', exact: true }).click();
  if (!(await page.getByLabel('Last N games', { exact: true }).isVisible()))
    await page.getByTestId('filter-panel').getByRole('button', { name: '+ Last N' }).click();
  await expect(page.getByLabel('Last N games', { exact: true })).toHaveValue('10');

  await page.getByRole('button', { name: /^Apply/ }).click();

  await expect(page.getByRole('alert')).toContainText('Choose a player');
  expect(gameLogRequests).toHaveLength(0);
});

test('@critical clearing a control clears its parameter', async ({ authenticatedPage: page }) => {
  const gameLogRequests = [];
  page.on('request', (request) => {
    if (isWorkspaceGameLogs(request.url())) {
      gameLogRequests.push(new URL(request.url()));
    }
  });

  // A one-game result must expand when its limit is cleared.
  await page.route('**/api/games/game_logs*', async (route) => {
    const url = new URL(route.request().url());
    await route.fulfill({
      json: {
        game_logs: url.searchParams.get('game_filter') === '1' ? gameLogs.slice(0, 1) : gameLogs,
        averages: [averages],
        season_averages: [averages],
        season_game_count: 2,
        next_game: 'Atlanta Hawks',
      },
    });
  });

  await page.goto('/?player_name=LeBron+James&game_filter=1');
  await expect(page.getByRole('heading', { name: 'Game Logs', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: '31', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: '27', exact: true })).toHaveCount(0);
  if (await page.getByRole('button', { name: 'Done', exact: true }).isVisible())
    await page.getByRole('button', { name: 'Done', exact: true }).click();
  if (!(await page.getByLabel('Last N games', { exact: true }).isVisible()))
    await page.getByTestId('filter-panel').getByRole('button', { name: '+ Last N' }).click();
  await expect(page.getByLabel('Last N games', { exact: true })).toHaveValue('1');

  // Emptying a control is a decision, not silence. It has to be able to say so.
  if (await page.getByRole('button', { name: 'Done', exact: true }).isVisible())
    await page.getByRole('button', { name: 'Done', exact: true }).click();
  if (!(await page.getByLabel('Last N games', { exact: true }).isVisible()))
    await page.getByTestId('filter-panel').getByRole('button', { name: '+ Last N' }).click();
  await page.getByLabel('Last N games', { exact: true }).fill('');
  // Observe the identical initial season query before recording Apply traffic.
  await expect
    .poll(() =>
      gameLogRequests.some(
        (url) =>
          url.searchParams.get('player_name') === 'LeBron James' &&
          !url.searchParams.has('game_filter'),
      ),
    )
    .toBe(true);
  const requestsBeforeApply = gameLogRequests.length;
  await page.getByRole('button', { name: /^Apply/ }).click();

  await expect(page).not.toHaveURL(/game_filter/);
  await expect.poll(() => gameLogRequests.length).toBe(requestsBeforeApply + 1);
  const applied = gameLogRequests[requestsBeforeApply].searchParams;
  expect(applied.get('player_name')).toBe('LeBron James');
  expect(applied.has('game_filter')).toBe(false);
  // A stray read cannot stand in for a response applied to the workspace.
  await expect(page.getByRole('cell', { name: '27', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: '31', exact: true })).toBeVisible();
  expect(gameLogRequests).toHaveLength(requestsBeforeApply + 1);
  await expect(page.getByText('GAMES <= 1')).toHaveCount(0);
});

/*
 * A Direct Filter Set can fix one specific opponent, which is how a Target will
 * hand off into the Log Workspace: "this player's games vs ATL" is a link.
 */
test('@critical a link fixing one opponent narrows the read, and the panel can clear it', async ({
  authenticatedPage: page,
}) => {
  const gameLogRequests = [];
  page.on('request', (request) => {
    if (isWorkspaceGameLogs(request.url())) {
      gameLogRequests.push(new URL(request.url()));
    }
  });

  await page.goto('/?player_name=LeBron+James&opponent_tricode=ATL');
  await expect(page.getByRole('heading', { name: 'Game Logs', exact: true })).toBeVisible();

  // The opponent travels on the request, and the panel says which one is fixed.
  await expect.poll(() => gameLogRequests.length).toBeGreaterThan(0);
  expect(gameLogRequests.at(-1).searchParams.get('opponent_tricode')).toBe('ATL');
  await expect(
    page.getByTestId('filter-panel').getByRole('button', { name: /^Remove versus/ }),
  ).toBeVisible();
  await expect(page.getByRole('cell', { name: 'ATL', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'DAL', exact: true })).toHaveCount(0);
  // The sample states itself against the whole season, which no filter changes.
  await expect(page.getByText('1 of 2 games', { exact: true })).toBeVisible();

  // Clearing it removes it from the URL and from the request that follows.
  const fixedRequestCount = gameLogRequests.length;
  await page
    .getByTestId('filter-panel')
    .getByRole('button', { name: /^Remove versus/ })
    .click();
  await page.getByRole('button', { name: /^Apply/ }).click();

  await expect(page).not.toHaveURL(/opponent_tricode/);
  await expect.poll(() => gameLogRequests.length).toBeGreaterThan(fixedRequestCount);
  expect(gameLogRequests.at(-1).searchParams.has('opponent_tricode')).toBe(false);
  await expect(page.getByRole('cell', { name: 'DAL', exact: true })).toBeVisible();
  await expect(page.getByText('2 of 2 games', { exact: true })).toBeVisible();
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
  await expect(page.getByRole('heading', { name: 'Ask the box score' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Game Logs', exact: true })).toHaveCount(0);
  await expect(page.getByRole('textbox')).toHaveValue('');
});

test('@critical removing every self filter clears its parameter', async ({
  authenticatedPage: page,
}) => {
  const gameLogRequests = [];
  page.on('request', (request) => {
    if (isWorkspaceGameLogs(request.url())) {
      gameLogRequests.push(new URL(request.url()));
    }
  });

  await page.goto('/?player_name=LeBron+James&self_filters%5BPTS%5D=30%2C60');
  await expect(page.getByRole('heading', { name: 'Game Logs', exact: true })).toBeVisible();
  // The chart line defaults to the season average (27), not the filtered one (29).
  await expect(page.getByLabel('Line Value:')).toHaveValue('27.0');
  await expect(page.getByRole('cell', { name: '31', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: '27', exact: true })).toHaveCount(0);
  await expect(
    page.getByTestId('filter-panel').getByRole('button', { name: /^Remove own/ }),
  ).toBeVisible();

  await page
    .getByTestId('filter-panel')
    .getByRole('button', { name: /^Remove own/ })
    .click();
  // The initial season read has the same query as the cleared workspace.
  // Observe it before Apply so it cannot satisfy the post-Apply assertion.
  await expect
    .poll(() =>
      gameLogRequests.some(
        (url) =>
          url.searchParams.get('player_name') === 'LeBron James' &&
          !url.searchParams.has('self_filters[PTS]'),
      ),
    )
    .toBe(true);
  const requestsBeforeApply = gameLogRequests.length;
  await page.getByRole('button', { name: /^Apply/ }).click();

  await expect(page).not.toHaveURL(/self_filters/);
  await expect.poll(() => gameLogRequests.length).toBe(requestsBeforeApply + 1);
  const applied = gameLogRequests[requestsBeforeApply].searchParams;
  expect(applied.get('player_name')).toBe('LeBron James');
  expect(applied.has('self_filters[PTS]')).toBe(false);
  // A stray read cannot stand in for a response applied to the workspace.
  await expect(page.getByRole('cell', { name: '27', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: '31', exact: true })).toBeVisible();
  expect(gameLogRequests).toHaveLength(requestsBeforeApply + 1);
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
  await expect.poll(() => gameLogRequests.length).toBe(2);

  await page.getByTestId('filter-panel').getByRole('button', { name: '+ Own stat line' }).click();

  await expect.poll(() => gameLogRequests.length).toBe(2);
  expect([
    ...gameLogRequests
      .find((url) => [...url.searchParams.keys()].join() === 'player_name')
      .searchParams.entries(),
  ]).toEqual([['player_name', 'LeBron James']]);

  await page.getByRole('combobox', { name: 'Stat', exact: true }).selectOption('PTS');
  await expect(page.getByText('27.0–31.0', { exact: true })).toBeVisible();

  await expect(page.getByRole('slider', { name: 'Minimum PTS' })).toBeVisible();
  await expect(page.getByRole('slider', { name: 'Maximum PTS' })).toBeVisible();

  // The season bounds the slider, so the filter the user arrived with can be
  // widened back out again.
  await page.getByRole('button', { name: 'Add stat filter' }).click();
  await page.getByRole('button', { name: /^Apply/ }).click();

  await expect.poll(() => gameLogRequests.length).toBe(3);
  expect(gameLogRequests.at(-1).searchParams.get('self_filters[PTS]')).toBe('27,31');
  await expect(page.getByRole('cell', { name: '27', exact: true })).toBeVisible();

  await expect(
    page.getByTestId('filter-panel').getByRole('button', { name: /^Remove own/ }),
  ).toBeVisible();
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

  await page.getByTestId('filter-panel').getByRole('button', { name: '+ Own stat line' }).click();
  await expect.poll(() => seasonRequests).toEqual(['LeBron James']);
  await page.getByRole('combobox', { name: 'Stat', exact: true }).selectOption('PTS');
  await expect(page.getByText('27.0–31.0', { exact: true })).toBeVisible();

  await page.getByLabel('Player:').fill('Stephen');
  await page.getByRole('option', { name: 'Stephen Curry' }).click();
  // Wait for the applied player to settle so this test checks request behavior.
  // player-switch-stat.spec.js (#159) owns the immediate-selection stat-reset regression.
  await expect(page.getByText('Player: Stephen Curry', { exact: true }).first()).toBeVisible();

  await expect.poll(() => seasonRequests).toEqual(['LeBron James', 'Stephen Curry']);
  // The ranges on offer are this player's, not the one we arrived on.
  await page.getByRole('combobox', { name: 'Stat', exact: true }).selectOption('PTS');
  await expect(page.getByText('18–42', { exact: true })).toBeVisible();
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

  await page.getByTestId('filter-panel').getByRole('button', { name: '+ Own stat line' }).click();
  await page.getByLabel('Player:').fill('Stephen');
  await page.getByRole('option', { name: 'Stephen Curry' }).click();
  // Wait for the applied player to settle so this test checks request behavior.
  // player-switch-stat.spec.js (#159) owns the immediate-selection stat-reset regression.
  await expect(page.getByText('Player: Stephen Curry', { exact: true }).first()).toBeVisible();

  await page.getByRole('combobox', { name: 'Stat', exact: true }).selectOption('PTS');
  await expect(page.getByText('18–42', { exact: true })).toBeVisible();

  // The season asked for before the player changed arrives late. It belongs to
  // nobody on screen, so it must change nothing.
  release();
  await expect(page.getByText('27.0–31.0', { exact: true })).toHaveCount(0);
  await expect(page.getByText('18–42', { exact: true })).toBeVisible();
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

  await page.getByTestId('filter-panel').getByRole('button', { name: '+ Own stat line' }).click();
  await expect.poll(() => seasonRequests).toEqual(['LeBron James']);

  await page.getByLabel('Player:').fill('Stephen');
  await page.getByRole('option', { name: 'Stephen Curry' }).click();
  // Wait for the applied player to settle so this test checks request behavior.
  // player-switch-stat.spec.js (#159) owns the immediate-selection stat-reset regression.
  await expect(page.getByText('Player: Stephen Curry', { exact: true }).first()).toBeVisible();
  await page.getByRole('combobox', { name: 'Stat', exact: true }).selectOption('PTS');
  await expect(page.getByText('18–42', { exact: true })).toBeVisible();

  // Back to the player we started on. The first request for them was abandoned
  // on the way out, so returning has to ask again rather than wait on it.
  await page.getByLabel('Player:').fill('LeBron');
  await page.getByRole('option', { name: 'LeBron James' }).click();
  // Wait for the applied player to settle so this test checks request behavior.
  // player-switch-stat.spec.js (#159) owns the immediate-selection stat-reset regression.
  await expect(page.getByText('Player: LeBron James', { exact: true }).first()).toBeVisible();
  await expect
    .poll(() => seasonRequests)
    .toEqual(['LeBron James', 'Stephen Curry', 'LeBron James']);
  await page.getByRole('combobox', { name: 'Stat', exact: true }).selectOption('PTS');
  await expect(page.getByText('27.0–31.0', { exact: true })).toBeVisible();

  // The abandoned first request answers at last, for the player now on screen.
  // It is not the request anyone is waiting on, so it changes nothing.
  release();
  await expect(page.getByText('18–42', { exact: true })).toHaveCount(0);
  await expect(page.getByText('27.0–31.0', { exact: true })).toBeVisible();
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

  await page.getByTestId('filter-panel').getByRole('button', { name: '+ Own stat line' }).click();
  await page.getByRole('combobox', { name: 'Stat', exact: true }).selectOption('PTS');
  await expect(page.getByText('Loading the season range…').first()).toBeVisible();

  // The slowest endpoint in the application does not keep working for a
  // workspace nobody is in any more.
  await page.getByRole('button', { name: 'Back to search' }).click();
  await expect(page.getByRole('heading', { name: 'Ask the box score', exact: true })).toBeVisible();
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

  await page.getByTestId('filter-panel').getByRole('button', { name: '+ Own stat line' }).click();
  await page.getByRole('combobox', { name: 'Stat', exact: true }).selectOption('PTS');
  // The season retry on opening the editor supplies the missing bounds.
  const failure = page.getByRole('status').filter({ hasText: "Couldn't load" });

  await expect.poll(() => seasonRequests).toEqual(['LeBron James', 'LeBron James']);
  await expect(failure).toHaveCount(0);
  await page.getByRole('combobox', { name: 'Stat', exact: true }).selectOption('PTS');
  await expect(page.getByText('27.0–31.0', { exact: true })).toBeVisible();
});

test('the season strip reads the unfiltered season once without opening Own stat line', async ({
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

  if (await page.getByRole('button', { name: 'Done', exact: true }).isVisible())
    await page.getByRole('button', { name: 'Done', exact: true }).click();
  if (!(await page.getByLabel('Last N games', { exact: true }).isVisible()))
    await page.getByTestId('filter-panel').getByRole('button', { name: '+ Last N' }).click();
  await page.getByLabel('Last N games', { exact: true }).fill('5');
  await page.getByRole('button', { name: /^Apply/ }).click();

  await expect.poll(() => gameLogRequests.length).toBe(3);
  // The slowest endpoint in the application is only asked for the season when
  // the control that needs it is opened.
  expect(gameLogRequests.filter((url) => !url.searchParams.has('game_filter'))).toHaveLength(1);
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

test('@critical signed out, Run it signs up and then runs exactly the typed query', async ({
  page,
}) => {
  await installApiContract(page);
  const parserBodies = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/api/nl-query') {
      parserBodies.push(request.postDataJSON());
    }
  });
  await page.goto('/');

  const box = page.getByRole('textbox');
  await expect(box).toBeEnabled();
  await expect(page.getByText('Free account. Sign up with Google to run it.')).toBeVisible();
  await box.fill('LeBron James last 10 games');
  await page.getByRole('button', { name: 'Run it' }).click();

  await expect(page.getByRole('heading', { name: 'Game Logs', exact: true })).toBeVisible();
  await expect(page.getByText('CourtAI Test User')).toBeVisible();
  await expect(page).toHaveURL(/player_name=LeBron\+James/);
  expect(parserBodies).toEqual([{ query: 'LeBron James last 10 games' }]);
});

test('@critical signed out, Browse without a query signs up and opens the browse workspace', async ({
  page,
}) => {
  await installApiContract(page);
  await page.goto('/');

  const browse = page.getByRole('button', { name: 'Browse without a query' });
  await expect(browse).toBeEnabled();
  await browse.click();

  await expect(page).toHaveURL(/\/\?browse=1$/);
  await expect(page.getByLabel('Player:')).toBeVisible();
  await expect(page.getByText('CourtAI Test User')).toBeVisible();
});

test('an empty workspace is shareable, and the sentinel never reaches a request', async ({
  authenticatedPage: page,
}) => {
  const gameLogRequests = [];
  page.on('request', (request) => {
    if (isWorkspaceGameLogs(request.url())) {
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
  if (await page.getByRole('button', { name: 'Done', exact: true }).isVisible())
    await page.getByRole('button', { name: 'Done', exact: true }).click();
  if (!(await page.getByLabel('Last N games', { exact: true }).isVisible()))
    await page.getByTestId('filter-panel').getByRole('button', { name: '+ Last N' }).click();
  await page.getByLabel('Last N games', { exact: true }).fill('5');
  await page.getByRole('button', { name: /^Apply/ }).click();
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
    if (isWorkspaceGameLogs(request.url())) {
      gameLogRequests.push(new URL(request.url()));
    }
  });

  await page.goto('/?player_name=LeBron+James');
  await expect(page.getByRole('heading', { name: 'Game Logs', exact: true })).toBeVisible();

  if (await page.getByRole('button', { name: 'Done', exact: true }).isVisible())
    await page.getByRole('button', { name: 'Done', exact: true }).click();
  if (!(await page.getByLabel('Last N games', { exact: true }).isVisible()))
    await page.getByTestId('filter-panel').getByRole('button', { name: '+ Last N' }).click();
  await page.getByLabel('Last N games', { exact: true }).fill('5');
  // The page load already sent two requests; wait for the one Apply sends.
  const requestsBeforeApply = gameLogRequests.length;
  await page.getByRole('button', { name: /^Apply/ }).click();
  await expect.poll(() => gameLogRequests.length).toBeGreaterThan(requestsBeforeApply);
  const appliedCount = gameLogRequests.length;

  await page.getByLabel('Player:').fill('Stephen');
  await page.getByRole('option', { name: 'Stephen Curry' }).click();

  // Comparing two players under identical conditions is one action, so the
  // filter the user applied is still on the wire for the new player.
  await expect.poll(() => gameLogRequests.length).toBeGreaterThan(appliedCount);
  await expect
    .poll(() =>
      gameLogRequests.some(
        (url) =>
          url.searchParams.get('player_name') === 'Stephen Curry' &&
          url.searchParams.get('game_filter') === '5',
      ),
    )
    .toBe(true);
  const afterChange = gameLogRequests.findLast(
    (url) =>
      url.searchParams.get('player_name') === 'Stephen Curry' &&
      url.searchParams.has('game_filter'),
  );
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
  // The chart section loads lazily after the table, and it renders its badges
  // with its canvas, so count only once every badge place has rendered.
  await expect(page.locator('.chart-container canvas')).toBeVisible();
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

test('the Log Workspace appears in one piece once every section has answered', async ({
  authenticatedPage: page,
}) => {
  let release;
  const held = new Promise((resolve) => {
    release = resolve;
  });
  // The opposing team's stats answer last; nothing else may appear before them.
  await page.route('**/api/teams/stats**', async (route) => {
    if (new URL(route.request().url()).searchParams.get('category') === 'Traditional') {
      await held;
    }
    await route.fallback();
  });

  const othersAnswered = Promise.all([
    page.waitForResponse('**/api/games/game_logs**'),
    page.waitForResponse('**/api/players/profile**'),
    page.waitForResponse('**/api/user/saved-filter-sets'),
  ]);
  await page.goto('/?player_name=LeBron+James');
  await othersAnswered;
  await expect(page.getByText('Loading game logs…')).toBeVisible();
  await expect(page.getByRole('cell', { name: '31', exact: true })).toBeHidden();
  await expect(page.getByRole('heading', { name: 'Player Profile', exact: true })).toBeHidden();

  release();
  await expect(page.getByRole('cell', { name: '31', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Player Profile', exact: true })).toBeVisible();
  await expect(page.getByText('Loading game logs…')).toBeHidden();
});

test("the Log Workspace waits for the filter panel's saved sets", async ({
  authenticatedPage: page,
}) => {
  let release;
  const held = new Promise((resolve) => {
    release = resolve;
  });
  await page.route('**/api/user/saved-filter-sets', async (route) => {
    await held;
    await route.fallback();
  });

  // Everything else has answered, so only the held read can be keeping it back.
  const othersAnswered = Promise.all([
    page.waitForResponse('**/api/games/game_logs**'),
    page.waitForResponse('**/api/players/profile**'),
    page.waitForResponse((response) => response.url().includes('category=Traditional')),
  ]);
  await page.goto('/?player_name=LeBron+James');
  await othersAnswered;
  await expect(page.getByText('Loading game logs…')).toBeVisible();
  await expect(page.getByRole('cell', { name: '31', exact: true })).toBeHidden();

  release();
  await expect(page.getByRole('cell', { name: '31', exact: true })).toBeVisible();
  await expect(page.getByText('Loading game logs…')).toBeHidden();
});

test('reopening the Log Workspace waits for every section again', async ({
  authenticatedPage: page,
}) => {
  let holdProfile = false;
  let release;
  const held = new Promise((resolve) => {
    release = resolve;
  });
  await page.route('**/api/players/profile**', async (route) => {
    if (holdProfile) await held;
    await route.fallback();
  });

  await page.goto('/?player_name=LeBron+James');
  await expect(page.getByRole('cell', { name: '31', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Back to search' }).click();
  await expect(page.getByRole('heading', { name: 'Ask the box score' })).toBeVisible();

  holdProfile = true;
  const logsAnswered = page.waitForResponse('**/api/games/game_logs**');
  await page.goBack();
  await logsAnswered;
  await expect(page.getByText('Loading game logs…')).toBeVisible();
  await expect(page.getByRole('cell', { name: '31', exact: true })).toBeHidden();

  release();
  await expect(page.getByRole('cell', { name: '31', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Player Profile', exact: true })).toBeVisible();
});

test('returning to a player waits for that player again', async ({ authenticatedPage: page }) => {
  let holdProfiles = false;
  let release;
  const held = new Promise((resolve) => {
    release = resolve;
  });
  await page.route('**/api/players/profile**', async (route) => {
    if (holdProfiles) await held;
    await route.fallback();
  });

  await page.goto('/?player_name=LeBron+James');
  await expect(page.getByRole('cell', { name: '31', exact: true })).toBeVisible();

  holdProfiles = true;
  await page.getByLabel('Player:').fill('Stephen');
  await page.getByRole('option', { name: 'Stephen Curry' }).click();
  await expect(page).toHaveURL(/player_name=Stephen\+Curry/);
  await expect(page.getByText('Loading game logs…')).toBeVisible();

  const logsAnswered = page.waitForResponse(
    (response) =>
      response.url().includes('/api/games/game_logs') && response.url().includes('LeBron'),
  );
  await page.goBack();
  await logsAnswered;
  await expect(page.getByText('Loading game logs…')).toBeVisible();
  await expect(page.getByRole('cell', { name: '31', exact: true })).toBeHidden();

  release();
  await expect(page.getByRole('cell', { name: '31', exact: true })).toBeVisible();
});

test('reopening a Workspace with no player still waits for every section', async ({
  authenticatedPage: page,
}) => {
  let holdSaved = false;
  let release;
  const held = new Promise((resolve) => {
    release = resolve;
  });
  await page.route('**/api/user/saved-filter-sets', async (route) => {
    if (holdSaved) await held;
    await route.fallback();
  });

  await page.goto('/?browse=1');
  await expect(page.getByLabel('Player:')).toBeVisible();
  await page.getByRole('button', { name: 'Back to search' }).click();
  await expect(page.getByRole('heading', { name: 'Ask the box score' })).toBeVisible();

  holdSaved = true;
  const savedRequested = page.waitForRequest('**/api/user/saved-filter-sets');
  await page.goBack();
  await savedRequested;
  await expect(page.getByText('Loading game logs…')).toBeVisible();
  await expect(page.getByLabel('Player:')).toBeHidden();

  release();
  await expect(page.getByLabel('Player:')).toBeVisible();
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
    if (isWorkspaceGameLogs(request.url())) {
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
  await expect(page.getByRole('button', { name: /^Apply/ })).toBeHidden();
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

  // Reached from the keyboard, which stays a way in of its own however the
  // toggle is placed.
  await page.getByRole('button', { name: 'Open search' }).press('Enter');
  await page.getByRole('textbox').fill('last 10 games');
  await page.getByRole('textbox').press('Enter');

  // The advice to choose a player points at a selector a refused link does not
  // render. Replacing the alert that names the real problem with it would leave
  // the user holding neither.
  await expect(page.getByRole('alert')).toContainText('game_filter');
  await expect(page.getByText('Choose a player before applying these filters.')).toBeHidden();
});

test('@critical the workspace search toggle answers a real pointer click', async ({
  authenticatedPage: page,
}) => {
  for (const viewport of [
    { width: 1280, height: 800 },
    { width: 375, height: 667 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto('/?player_name=LeBron+James');
    await expect(page.getByRole('heading', { name: 'Game Logs', exact: true })).toBeVisible();

    // A plain click, never `force`. Playwright's own hit test is the assertion:
    // it fails when the header covers the toggle, which is what a pointer hits
    // and the keyboard path hides.
    await page.getByRole('button', { name: 'Open search' }).click();
    await expect(page.getByPlaceholder('Ask about your favorite player')).toBeVisible();
    await page.getByRole('button', { name: 'Close search' }).click();

    // Moving the toggle out of the header cannot cost the header its own links.
    await page.getByRole('link', { name: 'Matchups' }).click();
    await expect(page).toHaveURL(/\/matchups$/);
  }
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

  if (await page.getByRole('button', { name: 'Done', exact: true }).isVisible())
    await page.getByRole('button', { name: 'Done', exact: true }).click();
  if (!(await page.getByLabel('Last N games', { exact: true }).isVisible()))
    await page.getByTestId('filter-panel').getByRole('button', { name: '+ Last N' }).click();
  await page.getByLabel('Last N games', { exact: true }).fill('5');
  await page.getByRole('button', { name: /^Apply/ }).click();

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
    if (isWorkspaceGameLogs(request.url())) {
      gameLogRequests.push(new URL(request.url()));
    }
  });

  await page.goto('/?game_filter=10');
  expect(gameLogRequests).toHaveLength(0);

  await page.getByLabel('Player:').fill('LeBron');
  await page.getByRole('option', { name: 'LeBron James' }).click();

  await expect.poll(() => gameLogRequests.length).toBeGreaterThan(0);
  await expect
    .poll(() => gameLogRequests.some((url) => url.searchParams.get('game_filter') === '10'))
    .toBe(true);
  const requested = gameLogRequests.findLast((url) => url.searchParams.get('game_filter') === '10');
  expect(requested.searchParams.get('player_name')).toBe('LeBron James');
  expect(requested.searchParams.get('game_filter')).toBe('10');
});

test('signed-out readers are offered no saved Filter Sets', async ({ page }) => {
  await installApiContract(page);
  await page.goto('/?player_name=LeBron+James&game_filter=10');

  await expect(page.getByText('Sign in to load these game logs')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save Filter Set' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Saved Filter Sets' })).toHaveCount(0);
});

test('saved Filter Set fixture answers the documented envelopes and rejections', async ({
  authenticatedPage: page,
}) => {
  await page.goto('/');

  const contract = await page.evaluate(async () => {
    const base = '/api/user/saved-filter-sets';
    const send = (path, method, body) =>
      fetch(path, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      });

    const created = await send(base, 'POST', {
      name: 'Fixture contract',
      query_string: 'player_name=LeBron+James',
    });
    const createdBody = await created.json();
    const renamed = await send(`${base}/${createdBody.saved_filter_set.id}`, 'PATCH', {
      name: 'Fixture contract renamed',
    });
    const renamedBody = await renamed.json();

    return {
      created: { status: created.status, body: createdBody },
      renamed: { status: renamed.status, body: renamedBody },
      rejections: await Promise.all(
        [
          send(base, 'POST', { name: '   ', query_string: 'player_name=LeBron+James' }),
          send(`${base}/${createdBody.saved_filter_set.id}`, 'PATCH', { name: '' }),
          send(`${base}/9999`, 'PATCH', { name: 'No such item' }),
          send(`${base}/9999`, 'DELETE'),
        ].map((response) => response.then((settled) => settled.status)),
      ),
    };
  });

  expect(contract.created.status).toBe(201);
  expect(contract.created.body).toMatchObject({
    success: true,
    saved_filter_set: { name: 'Fixture contract', query_string: 'player_name=LeBron+James' },
  });
  expect(contract.renamed.status).toBe(200);
  expect(contract.renamed.body.saved_filter_set).toMatchObject({
    name: 'Fixture contract renamed',
    // Renaming moves the name and its timestamp; the query string is immutable.
    query_string: 'player_name=LeBron+James',
    created_at: '2026-04-13T00:10:00Z',
    updated_at: '2026-04-13T00:20:00Z',
  });
  expect(contract.rejections).toEqual([400, 400, 404, 404]);
});

test('@critical the Traditional profile splits opponent rebounds into offensive and defensive', async ({
  authenticatedPage: page,
}) => {
  await page.goto('/?player_name=LeBron+James');
  await expect(page.getByRole('heading', { name: 'Opposing Team Profile' })).toBeVisible();

  // The Traditional view is the default, and every stat renders as one bar
  // that carries its value, its rank, and its league-average comparison.
  const readout = (label) =>
    page.getByRole('listitem').filter({ has: page.getByText(label, { exact: true }) });

  const offensive = readout('Off. rebounds');
  await expect(offensive.getByText('10.6', { exact: true })).toBeVisible();
  await expect(offensive.getByTitle('Rank 7 of 30')).toHaveText('7');
  // A negative comparison reads as fewer offensive boards allowed than the
  // league average, which is the whole point of an ascending defensive rank.
  await expect(offensive.getByText('−4.8%', { exact: true })).toBeVisible();

  const defensive = readout('Def. rebounds');
  await expect(defensive.getByText('33.5', { exact: true })).toBeVisible();
  await expect(defensive.getByTitle('Rank 24 of 30')).toHaveText('24');
  await expect(defensive.getByText('+3.9%', { exact: true })).toBeVisible();

  // The split has to agree with the total the profile already published, or the
  // reader is looking at contradictory rebound data.
  await expect(readout('Rebounds').getByText('44.1', { exact: true })).toBeVisible();
});

test('the workspace draws the game-log chart with the registered Chart.js pieces', async ({
  authenticatedPage: page,
}) => {
  // Chart.js registers only the controllers the app uses; an unregistered
  // piece throws while drawing, so a page error here means one is missing.
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.goto('/?player_name=LeBron+James');
  await expect(page.locator('.chart-container canvas')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Opposing Team Profile' })).toBeVisible();
  expect(pageErrors).toEqual([]);
});

test('a rate-limited game-logs read shows the backend message and is not retried', async ({
  authenticatedPage: page,
}) => {
  await page.clock.install();
  await installApiContract(page, { '/api/games/game_logs': RATE_LIMITED });
  const reads = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.pathname === '/api/games/game_logs') reads.push(url.search);
  });
  await page.goto('/?player_name=LeBron+James&game_filter=10');
  await expect(page.getByText('Too many requests. Try again in 3 seconds.')).toBeVisible();
  await expect(page.getByText('(ref')).toHaveCount(0);
  // Well past the 3 s Retry-After: still nothing repeated.
  await page.clock.fastForward(10000);
  // The page asks twice, for the season and for the filter; neither is repeated.
  expect(reads).toEqual(['?player_name=LeBron+James', '?player_name=LeBron+James&game_filter=10']);
});

test('the line defaults to his next game posted line, else the season average', async ({
  authenticatedPage: page,
}) => {
  await page.goto('/?player_name=Stephen+Curry');
  await expect(page.getByRole('heading', { name: 'Game Logs', exact: true })).toBeVisible();
  const lineValue = page.getByLabel('Line Value:');
  await expect(lineValue).toHaveValue('26.5');

  await page.getByLabel('Line Type:').selectOption('FG3M');
  await expect(lineValue).toHaveValue('4.5');
  // No posted REB line: the season average, as before.
  await page.getByLabel('Line Type:').selectOption('REB');
  await expect(lineValue).toHaveValue('7.5');
});
