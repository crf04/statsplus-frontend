import fs from 'node:fs';
import path from 'node:path';

// Marketplace listings (the Grok Bot plugin form) take https://courtai.app/logo.svg
// and require a 1:1 image with a background plate.
const logo = fs.readFileSync(path.resolve(process.cwd(), 'public/logo.svg'), 'utf8');

describe('public/logo.svg', () => {
  test('is square', () => {
    expect(logo).toContain('viewBox="0 0 512 512"');
  });

  test('fills the whole square with the brand orange plate', () => {
    expect(logo).toContain('<rect width="512" height="512" fill="#F97316"/>');
  });
});
