/**
 * @jest-environment node
 */
import path from 'node:path';
import { build } from 'esbuild';

// Vercel bundles middleware.js and everything it imports as plain JavaScript,
// so one JSX file anywhere in that import graph fails the whole deployment.
test('middleware bundles without JSX, as the Vercel edge build does', async () => {
  const result = await build({
    entryPoints: [path.join(__dirname, '..', 'middleware.js')],
    bundle: true,
    write: false,
    platform: 'neutral',
    logLevel: 'silent',
  }).catch((error) => error);

  expect(result.errors).toEqual([]);
});
