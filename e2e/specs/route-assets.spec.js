import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test, expect } from '@playwright/test';

test('production routes defer chart downloads until Search is opened', async ({ browser }) => {
  test.setTimeout(120_000);
  const { preview } = await import('vite');
  const outDir = await mkdtemp(path.join(os.tmpdir(), 'courtai-route-assets-'));
  let server;
  const contexts = [];
  try {
    // Exercise the actual production graph, including Rollup's shared chunks and
    // Vite's modulepreload behavior. The development server cannot prove this.
    // Run Vite outside Playwright's module transform hooks (Tailwind loads its
    // own CommonJS configuration). Inspect module membership, not chunk names.
    const { stdout } = await promisify(execFile)(process.execPath, [
      '--input-type=module',
      '-e',
      `import { build } from 'vite';
       const result = await build({ build: { outDir: process.argv[1] }, logLevel: 'silent' });
       console.log(JSON.stringify(result.output
         .filter(output => output.type === 'chunk')
         .map(chunk => ({ fileName: chunk.fileName, modules: Object.keys(chunk.modules) }))));`,
      outDir,
    ]);
    const chunks = JSON.parse(stdout);
    const chartAssets = chunks
      .filter((chunk) =>
        chunk.modules.some((id) => /\/node_modules\/(chart\.js|recharts)\//.test(id)),
      )
      .map((chunk) => `/${chunk.fileName}`);
    expect(chartAssets.length).toBeGreaterThan(0);
    server = await preview({
      build: { outDir },
      preview: { host: '127.0.0.1', port: 0, open: false },
      logLevel: 'error',
    });
    const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
    const slateAsset = chunks.find((chunk) =>
      chunk.modules.some((id) => id.endsWith('/src/SlatePage.js')),
    );
    expect(slateAsset).toBeDefined();
    const chunkUrl = `${origin}/${slateAsset.fileName}`;
    const recoveryContext = await browser.newContext();
    contexts.push(recoveryContext);
    const recoveryPage = await recoveryContext.newPage();
    let releaseChunk;
    const chunkReleased = new Promise((resolve) => {
      releaseChunk = resolve;
    });
    await recoveryPage.route(chunkUrl, async (route) => {
      await chunkReleased;
      await route.continue();
    });
    try {
      await recoveryPage.goto(`${origin}/matchups`, { waitUntil: 'domcontentloaded' });
      await expect(recoveryPage.getByRole('status')).toHaveText('Loading page…');
      await expect(recoveryPage.getByRole('navigation', { name: 'Primary' })).toBeVisible();
    } finally {
      releaseChunk();
    }
    await expect(
      recoveryPage.getByRole('heading', { name: 'Sign in to view the slate' }),
    ).toBeVisible();
    await recoveryPage.unroute(chunkUrl);

    // Replay the missing-asset HTML response produced by the deployment's SPA
    // rewrite. Restoring the network alone cannot clear React.lazy's rejection.
    await recoveryPage.route(chunkUrl, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: '<!doctype html><html></html>',
      }),
    );
    await recoveryPage.reload();
    await expect(recoveryPage.getByRole('alert')).toContainText('Could not load this page.');
    await expect(recoveryPage.getByRole('navigation', { name: 'Primary' })).toBeVisible();
    await recoveryPage.getByRole('link', { name: 'Targets', exact: true }).click();
    await expect(
      recoveryPage.getByRole('heading', { name: 'Sign in to view your Targets' }),
    ).toBeVisible();
    await recoveryPage.getByRole('link', { name: 'Matchups', exact: true }).click();
    await expect(recoveryPage.getByRole('alert')).toContainText('Could not load this page.');
    await recoveryPage.unroute(chunkUrl);
    await recoveryPage.getByRole('button', { name: 'Reload page' }).click();
    await expect(
      recoveryPage.getByRole('heading', { name: 'Sign in to view the slate' }),
    ).toBeVisible();
    await recoveryContext.close();

    for (const [route, heading] of [
      ['/matchups', 'Sign in to view the slate'],
      ['/matchups/0022500584', 'Sign in to view this matchup'],
      ['/help', 'Query reference'],
      ['/targets', 'Sign in to view your Targets'],
      ['/targets/3', 'Sign in to view your Targets'],
    ]) {
      const context = await browser.newContext();
      contexts.push(context);
      const page = await context.newPage();
      const requestedCharts = new Set();
      page.on('request', (request) => {
        const pathname = new URL(request.url()).pathname;
        if (chartAssets.includes(pathname)) requestedCharts.add(pathname);
      });
      await page.goto(`${origin}${route}`);
      await expect(page.getByRole('navigation', { name: 'Primary' })).toBeVisible();
      await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
      await page.waitForLoadState('networkidle');
      expect([...requestedCharts], `Chart assets requested on ${route}`).toEqual([]);

      await page.getByRole('link', { name: 'Search', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'CourtAI', exact: true })).toBeVisible();
      expect([...requestedCharts].sort()).toEqual([...chartAssets].sort());
      await page.getByRole('link', { name: 'Matchups', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Sign in to view the slate' })).toBeVisible();
      await context.close();
    }
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
    if (server) await server.close();
    await rm(outDir, { recursive: true, force: true });
  }
});
