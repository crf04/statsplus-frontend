// Computed-style parity between a base checkout and this one, served side by
// side through the e2e fixture contract. See computed-style.parity.js.
//
//   git worktree add --detach /tmp/courtai-base origin/master
//   (cd /tmp/courtai-base && npm ci)
//   PARITY_BASE_DIR=/tmp/courtai-base npx playwright test -c scripts/theme/parity/playwright.config.mjs
import { defineConfig, devices } from '@playwright/test';

const baseDir = process.env.PARITY_BASE_DIR;
if (!baseDir) throw new Error('Set PARITY_BASE_DIR to a checkout of the base revision.');
const basePort = process.env.PARITY_BASE_PORT || '4401';
const headPort = process.env.PARITY_HEAD_PORT || '4402';

const server = (cwd, port) => ({
  command: `npm start -- --host 127.0.0.1 --port ${port} --strictPort`,
  cwd,
  env: { ...process.env, REACT_APP_E2E_MODE: 'true' },
  url: `http://127.0.0.1:${port}`,
  reuseExistingServer: false,
  timeout: 120_000,
});

export default defineConfig({
  testDir: '.',
  testMatch: 'computed-style.parity.js',
  outputDir: '../../../test-results/theme-parity',
  fullyParallel: true,
  workers: 4,
  reporter: [['list']],
  timeout: 120_000,
  use: {
    ...devices['Desktop Chrome'],
    trace: 'off',
  },
  webServer: [server(baseDir, basePort), server(process.cwd(), headPort)],
});
