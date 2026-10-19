import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const PRODUCTION_API_ORIGIN = 'https://statsplus-backend-production.up.railway.app';
const STAGING_API_ORIGIN = 'https://statsplus-backend-staging.up.railway.app';

// Vercel evaluates vercel.ts at build time; run it the same way in a fresh process.
const loadVercelConfig = ({ apiOrigin } = {}) => {
  const env = { ...process.env, NODE_NO_WARNINGS: '1' };
  delete env.STATSPLUS_API_ORIGIN;
  if (apiOrigin !== undefined) env.STATSPLUS_API_ORIGIN = apiOrigin;

  return JSON.parse(
    execFileSync(
      process.execPath,
      [
        '--input-type=module',
        '--eval',
        "import { config } from './vercel.ts'; process.stdout.write(JSON.stringify(config));",
      ],
      { cwd: process.cwd(), encoding: 'utf8', env },
    ),
  );
};

const productionRewrites = (apiOrigin) => [
  { source: '/api/:path*', destination: `${apiOrigin}/api/:path*` },
  {
    source: '/__/auth/:path*',
    destination: 'https://courtai-6eccf.firebaseapp.com/__/auth/:path*',
  },
  { source: '/:path*', destination: '/index.html' },
];

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
  test('is the only Vercel configuration file', () => {
    expect(fs.existsSync(path.resolve(process.cwd(), 'vercel.json'))).toBe(false);
  });

  test('without STATSPLUS_API_ORIGIN, builds and routes exactly as the former vercel.json did', () => {
    expect(loadVercelConfig()).toEqual({
      framework: 'vite',
      buildCommand: 'npm run build',
      outputDirectory: 'build',
      rewrites: productionRewrites(PRODUCTION_API_ORIGIN),
    });
  });

  test('treats an empty STATSPLUS_API_ORIGIN as unset', () => {
    expect(loadVercelConfig({ apiOrigin: '' }).rewrites).toEqual(
      productionRewrites(PRODUCTION_API_ORIGIN),
    );
  });

  test('sends /api to the origin named by STATSPLUS_API_ORIGIN and leaves other rewrites alone', () => {
    expect(loadVercelConfig({ apiOrigin: STAGING_API_ORIGIN }).rewrites).toEqual(
      productionRewrites(STAGING_API_ORIGIN),
    );
  });

  test.each([
    'http://statsplus-backend-staging.up.railway.app',
    'statsplus-backend-staging.up.railway.app',
    'https://statsplus-backend-staging.up.railway.app/',
    'https://statsplus-backend-staging.up.railway.app/api',
    'https://statsplus-backend-staging.up.railway.app?x=1',
    'ftp://example.com',
    ' ',
  ])('fails the build for STATSPLUS_API_ORIGIN=%j', (apiOrigin) => {
    expect(() => loadVercelConfig({ apiOrigin })).toThrow(
      /STATSPLUS_API_ORIGIN must be an https origin/,
    );
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
      baseUrl: 'https://statsplus-frontend-pj8o7a8n2-chris-fus-projects.vercel.app/',
      vercelAutomationBypassSecret: 'opaque-test-value',
    });

    expect(use).not.toHaveProperty('extraHTTPHeaders');
    expect(use.trace).toBe('off');
    expect(use.video).toBe('off');
  });
});
