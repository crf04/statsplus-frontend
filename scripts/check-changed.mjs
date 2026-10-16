// Affected-only inner-loop gate. `npm run check` stays the full suite and CI
// stays the authority; this runs what the current diff can break.
import { execFileSync, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const lines = (text) => text.split('\n').filter(Boolean);

const base = git('merge-base', 'origin/master', 'HEAD');
const changed = [
  ...new Set([
    ...lines(git('diff', '--name-only', base)), // committed + staged + unstaged
    ...lines(git('ls-files', '--others', '--exclude-standard')),
  ]),
].filter(existsSync);

const under = (...prefixes) => changed.filter((f) => prefixes.some((p) => f.startsWith(p)));
const specs = changed.filter((f) => f.startsWith('e2e/specs/') && f.endsWith('.spec.js'));
const flows = changed.filter((f) => /^e2e\/flows\/[^/]+\.e2e\.ts$/.test(f));
const jsChanged = changed.some((f) => /\.(js|jsx|mjs|cjs)$/.test(f));
const critical =
  under('src/', 'e2e/fixtures', 'e2e/support', 'e2e/flows/support', 'e2e/bridge').length > 0 ||
  changed.some((f) =>
    /^(vite|playwright)\.config|^e2e(\.bugbash)?\.config\.ts$|^package(-lock)?\.json$/.test(f),
  );

const run = (cmd, args, env = {}) =>
  new Promise((resolve) => {
    const child = spawn(cmd, args, { env: { ...process.env, ...env }, shell: false });
    let out = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (out += d));
    child.on('close', (code) => resolve({ code, out }));
  });

const summary = [];
let failed = false;
const step = async (name, cmd, args, env) => {
  const t = Date.now();
  console.log(`> ${name}`);
  const { code, out } = await run(cmd, args, env);
  if (code !== 0) {
    failed = true;
    console.log(out);
  }
  summary.push(
    `${code === 0 ? 'ok     ' : 'FAILED '} ${name} (${((Date.now() - t) / 1000).toFixed(0)}s)`,
  );
  return code === 0;
};
const skip = (name, why) => summary.push(`skipped ${name}: ${why}`);

console.log(`merge base ${base.slice(0, 7)}, ${changed.length} changed file(s)`);

for (const [name, args] of [
  ['eslint --cache', ['eslint', '--cache', '.']],
  ['format:check', null],
  ['typecheck:e2e', null],
  ['build', null],
]) {
  if (args) await step(name, 'npx', args);
  else await step(name, 'npm', ['run', '--silent', name]);
  if (failed) break;
}

if (!failed) {
  if (jsChanged) {
    await step(
      `jest --changedSince=${base.slice(0, 7)}`,
      'npx',
      ['jest', '--ci', `--changedSince=${base}`, '--passWithNoTests'],
      { TZ: 'Asia/Tokyo' },
    );
  } else skip('jest', 'no JS changed');
}

if (!failed) {
  // Serial on purpose: overlapping Playwright and e2e flows starved each other
  // locally and made the @critical specs time out.
  if (specs.length)
    await step(`playwright ${specs.length} changed spec(s)`, 'npx', [
      'playwright',
      'test',
      ...specs,
    ]);
  else skip('playwright changed specs', 'no e2e/specs changes');
  if (critical)
    await step('playwright @critical', 'npx', ['playwright', 'test', '--grep', '@critical']);
  else skip('playwright @critical', 'no src, fixture, bridge or config changes');
  if (flows.length)
    await step(`e2e flows ${flows.length} changed file(s)`, 'npx', [
      'e2e',
      'run',
      '--exclude-tag',
      'agent',
      ...flows,
    ]);
  else skip('e2e changed flows', 'no e2e/flows changes');
  if (critical)
    await step('e2e flows critical', 'npx', [
      'e2e',
      'run',
      '--tag',
      'critical',
      '--exclude-tag',
      'agent',
    ]);
  else skip('e2e flows critical', 'no src, fixture, bridge or config changes');
}

console.log(`\ncheck:changed summary\n${summary.join('\n')}`);
console.log(failed ? '\nFAILED' : '\nPASSED (CI runs the full `npm run check` suite)');
process.exit(failed ? 1 : 0);
