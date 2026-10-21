// Writes <dir>/package.json and <dir>/package-lock.json holding only the
// committed lock file's Playwright entries, so `npm ci` there installs the
// report merge tool against the committed integrity hashes without the rest of
// the tree.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.argv[2];
if (!dir) throw new Error('usage: node scripts/playwright-only-lock.mjs <dir>');
const lock = JSON.parse(readFileSync('package-lock.json', 'utf8'));

// npm resolution: the nearest node_modules/<name> at or above the dependent.
const resolve = (from, name) => {
  let base = from;
  for (;;) {
    const key = `${base ? `${base}/` : ''}node_modules/${name}`;
    if (lock.packages[key]) return key;
    if (!base) return null;
    const above = base.lastIndexOf('node_modules/');
    base = above > 0 ? base.slice(0, above - 1) : '';
  }
};

const packages = {};
const queue = ['node_modules/playwright'];
for (const key of queue) {
  if (packages[key]) continue;
  const entry = lock.packages[key];
  if (!entry) throw new Error(`package-lock.json has no entry ${key}`);
  packages[key] = entry;
  for (const name of Object.keys({ ...entry.dependencies, ...entry.optionalDependencies })) {
    const dep = resolve(key, name);
    if (dep) queue.push(dep);
    else if (!entry.optionalDependencies?.[name])
      throw new Error(`package-lock.json has no ${name} for ${key}`);
  }
}

const manifest = {
  name: 'playwright-only',
  private: true,
  devDependencies: { playwright: packages['node_modules/playwright'].version },
};
mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`);
writeFileSync(
  join(dir, 'package-lock.json'),
  `${JSON.stringify(
    {
      name: manifest.name,
      lockfileVersion: lock.lockfileVersion,
      requires: true,
      packages: {
        '': { name: manifest.name, devDependencies: manifest.devDependencies },
        ...packages,
      },
    },
    null,
    2,
  )}\n`,
);
console.log(`${Object.keys(packages).join(', ')} -> ${dir}`);
