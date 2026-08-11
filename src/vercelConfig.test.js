import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { getOriginScopedBypassHeaders } from './vercelBypass';

const vercelConfig = JSON.parse(
  fs.readFileSync(path.resolve(process.cwd(), 'vercel.json'), 'utf8'),
);

const loadPlaywrightUseConfig = ({ baseUrl, vercelAutomationBypassSecret } = {}) => {
  const env = { ...process.env };

  if (baseUrl === undefined) {
    delete env.E2E_BASE_URL;
  } else {
    env.E2E_BASE_URL = baseUrl;
  }

  if (vercelAutomationBypassSecret === undefined) {
    delete env.VERCEL_AUTOMATION_BYPASS_SECRET;
  } else {
    env.VERCEL_AUTOMATION_BYPASS_SECRET = vercelAutomationBypassSecret;
  }

  const output = execFileSync(
    process.execPath,
    [
      '--input-type=module',
      '--eval',
      "import config from './playwright.config.mjs'; process.stdout.write(JSON.stringify(config.use));",
    ],
    { cwd: process.cwd(), encoding: 'utf8', env },
  );

  return JSON.parse(output);
};

describe('Vercel deployment configuration', () => {
  test('builds the Vite application into the configured deployment directory', () => {
    expect(vercelConfig).toMatchObject({
      framework: 'vite',
      buildCommand: 'npm run build',
      outputDirectory: 'build',
    });
  });

  test('proxies API requests before applying the SPA fallback', () => {
    expect(vercelConfig.rewrites).toHaveLength(2);
    expect(vercelConfig.rewrites[0]).toMatchObject({ source: '/api/:path*' });
    expect(vercelConfig.rewrites[1]).toEqual({ source: '/:path*', destination: '/index.html' });
  });

  test('keeps hermetic Playwright runs free of deployment credentials and preserves evidence', () => {
    const use = loadPlaywrightUseConfig();

    expect(use).not.toHaveProperty('extraHTTPHeaders');
    expect(use.trace).toBe('retain-on-failure');
    expect(use.video).toBe('retain-on-failure');
  });

  test('does not add deployment headers to a hermetic run with an accidental secret', () => {
    const use = loadPlaywrightUseConfig({ vercelAutomationBypassSecret: 'opaque-test-value' });

    expect(use).not.toHaveProperty('extraHTTPHeaders');
    expect(use.trace).toBe('off');
    expect(use.video).toBe('off');
  });

  test('disables credential-bearing evidence for a protected deployment run', () => {
    const use = loadPlaywrightUseConfig({
      baseUrl: 'https://preview.example.com/path',
      vercelAutomationBypassSecret: 'opaque-test-value',
    });

    expect(use).not.toHaveProperty('extraHTTPHeaders');
    expect(use.trace).toBe('off');
    expect(use.video).toBe('off');
  });

  test('adds bypass headers only for the configured deployment origin', () => {
    const options = {
      configuredBaseUrl: 'https://preview.example.com/path',
      bypassSecret: 'opaque-test-value',
    };

    expect(
      getOriginScopedBypassHeaders({ ...options, requestUrl: 'https://preview.example.com/' }),
    ).toEqual({
      'x-vercel-protection-bypass': options.bypassSecret,
      'x-vercel-set-bypass-cookie': 'true',
    });
    expect(
      getOriginScopedBypassHeaders({
        ...options,
        requestUrl: 'https://cdn.example.com/app.js',
      }),
    ).toEqual({});
    expect(
      getOriginScopedBypassHeaders({
        configuredBaseUrl: undefined,
        bypassSecret: options.bypassSecret,
        requestUrl: 'https://preview.example.com/',
      }),
    ).toEqual({});
  });
});
