import type { VercelConfig } from '@vercel/config/v1';

const DEFAULT_API_ORIGIN = 'https://statsplus-backend-production.up.railway.app';

// The /api rewrite destination is fixed when Vercel evaluates this file at build
// time. A staging build sets STATSPLUS_API_ORIGIN; unset or empty keeps production.
const resolveApiOrigin = (value: string | undefined): string => {
  if (value === undefined || value === '') return DEFAULT_API_ORIGIN;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    url = new URL('invalid:');
  }
  if (url.protocol !== 'https:' || url.origin !== value) {
    throw new Error(
      `STATSPLUS_API_ORIGIN must be an https origin such as ${DEFAULT_API_ORIGIN} (no path, query or trailing slash); got ${JSON.stringify(value)}`,
    );
  }
  return value;
};

export const config: VercelConfig = {
  framework: 'vite',
  buildCommand: 'npm run build',
  outputDirectory: 'build',
  rewrites: [
    {
      source: '/api/:path*',
      destination: `${resolveApiOrigin(process.env.STATSPLUS_API_ORIGIN)}/api/:path*`,
    },
    {
      source: '/__/auth/:path*',
      destination: 'https://courtai-6eccf.firebaseapp.com/__/auth/:path*',
    },
    { source: '/:path*', destination: '/index.html' },
  ],
};
