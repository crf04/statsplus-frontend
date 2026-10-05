import { defineConfig, devices } from '@playwright/test';

const externalBaseUrl = process.env.E2E_BASE_URL;
// Parallel worktrees each need their own port. Reusing a server is opt-in so a
// run never silently tests another checkout's build.
const localPort = process.env.E2E_PORT || '4173';
const localBaseUrl = `http://127.0.0.1:${localPort}`;
const vercelAutomationBypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
const bypassSecretActive = Boolean(vercelAutomationBypassSecret);

export default defineConfig({
  testDir: './e2e/specs',
  outputDir: 'test-results',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI
    ? [['line'], ['html', { outputFolder: 'playwright-report', open: 'never' }]]
    : [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  use: {
    baseURL: externalBaseUrl || localBaseUrl,
    trace: bypassSecretActive ? 'off' : 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: bypassSecretActive ? 'off' : 'retain-on-failure',
  },
  expect: {
    timeout: 10_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile-chromium',
      grep: /@smoke/,
      use: { ...devices['Pixel 7'] },
    },
  ],
  webServer: externalBaseUrl
    ? undefined
    : {
        // Keep the hermetic auth adapter cross-platform. The previous inline
        // POSIX assignment is not understood by Windows PowerShell/cmd.
        command: `npm start -- --host 127.0.0.1 --port ${localPort} --strictPort`,
        env: { ...process.env, REACT_APP_E2E_MODE: 'true' },
        url: localBaseUrl,
        reuseExistingServer: process.env.E2E_REUSE_SERVER === 'true',
        timeout: 120_000,
      },
});
