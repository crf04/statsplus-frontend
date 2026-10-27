// The files the theme tools read, the same set for the codemod, the checker
// and the dark-parity verifier.
import fs from 'node:fs';
import path from 'node:path';

export const THEME_FILE = 'src/theme.css';

// Generated from Bootstrap's own variables; its colours are Bootstrap's.
export const SKIPPED = new Set(['src/bootstrap-subset.scss']);

export const isTestFile = (file) =>
  /\.test\.jsx?$/.test(file) || file.includes('/__tests__/') || file.endsWith('setupTests.js');

export const isStylesheet = (file) => /\.(css|scss)$/.test(file);
export const isScript = (file) => /\.jsx?$/.test(file);

// Every --ct-* name a text mentions.
export const TOKEN_REFERENCE_RE = /--ct-[a-z0-9]+(?:-[a-z0-9]+)*/g;

const walk = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });

// Stylesheets and non-test scripts under src/, repo-relative and sorted.
export const sourceFiles = (rootDir) =>
  walk(path.join(rootDir, 'src'))
    .map((file) => path.relative(rootDir, file).split(path.sep).join('/'))
    .filter(
      (file) => !SKIPPED.has(file) && (isStylesheet(file) || (isScript(file) && !isTestFile(file))),
    )
    .sort();
