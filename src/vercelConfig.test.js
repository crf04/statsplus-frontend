import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const vercelConfig = JSON.parse(
  fs.readFileSync(path.resolve(process.cwd(), 'vercel.json'), 'utf8'),
);

const loadPlaywrightUseConfig = (vercelAutomationBypassSecret) => {
  const env = { ...process.env };

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

  test('keeps hermetic Playwright runs free of deployment bypass headers', () => {
    expect(loadPlaywrightUseConfig()).not.toHaveProperty('extraHTTPHeaders');
    expect(loadPlaywrightUseConfig('')).not.toHaveProperty('extraHTTPHeaders');
  });

  test('passes Vercel deployment bypass headers when configured', () => {
    expect(loadPlaywrightUseConfig('test-secret')).toMatchObject({
      extraHTTPHeaders: {
        'x-vercel-protection-bypass': 'test-secret',
        'x-vercel-set-bypass-cookie': 'true',
      },
    });
  });
});
