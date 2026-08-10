import fs from 'node:fs';
import path from 'node:path';

const vercelConfig = JSON.parse(
  fs.readFileSync(path.resolve(process.cwd(), 'vercel.json'), 'utf8'),
);

describe('Vercel deployment configuration', () => {
  test('builds the Vite application into the configured deployment directory', () => {
    expect(vercelConfig).toMatchObject({
      framework: 'vite',
      buildCommand: 'npm run build',
      outputDirectory: 'build',
    });
  });

  test('proxies API requests before applying the SPA fallback', () => {
    expect(vercelConfig.rewrites).toEqual([
      {
        source: '/api/:path*',
        destination: 'https://your-backend.example.com/api/:path*',
      },
      { source: '/:path*', destination: '/index.html' },
    ]);
  });
});
