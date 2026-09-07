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
    const chartAssets = JSON.parse(stdout)
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
    for (const route of ['/matchups', '/help', '/targets', '/targets/3']) {
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
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
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
    if (server) await new Promise((resolve) => server.httpServer.close(resolve));
    await rm(outDir, { recursive: true, force: true });
  }
});
