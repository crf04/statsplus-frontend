import fs from 'fs';
import path from 'path';

const SRC = path.resolve(__dirname, '..');
// Sign-in and administrator-claim failures are not request errors: they carry
// no (ref xxxxxxxx) and have nothing to report.
const NOT_REQUEST_ERRORS = [
  'components/Auth/LoginButton.js',
  'components/Auth/ProtectedRoute.js',
  // The popover's own send failure, which is never a (ref ...) message.
  'feedback/FeedbackPopover.js',
];
const BARE_ERROR_IN_JSX = /(?<![=\w])\{\s*(?:[\w?]+\.)*\w*[eE]rror\s*\}(?=\s*(?:\{' '\}|<|$))/gm;

const sources = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) return sources(file);
    return /\.js$/.test(entry.name) && !/\.test\.js$/.test(entry.name) ? [file] : [];
  });

test('a request error message is never rendered as bare text, so it always offers Report this', () => {
  const offenders = sources(SRC)
    .filter((file) => !NOT_REQUEST_ERRORS.includes(path.relative(SRC, file)))
    .flatMap((file) =>
      [...fs.readFileSync(file, 'utf8').matchAll(BARE_ERROR_IN_JSX)].map(
        (match) => `${path.relative(SRC, file)}: ${match[0].trim()}`,
      ),
    );
  expect(offenders).toEqual([]);
});
