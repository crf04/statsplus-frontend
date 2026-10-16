import { getSurfaceFreshnessPresentation } from './slateStatus';

const NOW = Date.parse('2026-01-15T12:00:00Z');
const minutesAgo = (minutes) => new Date(NOW - minutes * 60 * 1000).toISOString();

const fresh = { status: 'fresh', warning: false, thresholdNote: null };
const staleBeyond = (bar) => ({
  status: 'stale',
  warning: true,
  thresholdNote: `older than ${bar}m freshness bar`,
});

// The backend serves a prizepicks line as fresh for 90 minutes because The Odds API is polled
// hourly (crf04/statsplus-backend#419); every other provider is fresh for 15.
test.each([
  ['prizepicks', 89, fresh],
  ['prizepicks', 90, fresh],
  ['prizepicks', 91, staleBeyond(90)],
  ['underdog', 15, fresh],
  ['underdog', 16, staleBeyond(15)],
  ['constructor', 16, staleBeyond(15)],
])('a fresh %s entry read %i minutes ago presents as %j', (name, minutes, expected) => {
  const provider = { name, status: 'fresh', retrievedAt: minutesAgo(minutes) };

  expect(getSurfaceFreshnessPresentation(provider, 'pool', NOW)).toEqual(expected);
});

// The pool's aggregate time follows PrizePicks only when no other provider has evidence (the backend
// documents this in crf04/statsplus-backend#419); it is then held to PrizePicks's bar, otherwise to 15.
const entry = (name, minutes) => ({ name, status: 'fresh', retrievedAt: minutesAgo(minutes) });
const missing = (name) => ({ name, status: 'missing', retrievedAt: null });
const pool = (minutes, providers) => ({
  status: 'fresh',
  retrievedAt: minutesAgo(minutes),
  providers,
});

test.each([
  ['a pool of prizepicks alone', 89, [entry('prizepicks', 89)], fresh],
  ['a pool of prizepicks alone', 90, [entry('prizepicks', 90)], fresh],
  ['a pool of prizepicks alone', 91, [entry('prizepicks', 91)], staleBeyond(90)],
  [
    'prizepicks beside a provider with no evidence',
    89,
    [entry('prizepicks', 89), missing('underdog')],
    fresh,
  ],
  [
    'prizepicks beside a provider with no evidence',
    91,
    [entry('prizepicks', 91), missing('underdog')],
    staleBeyond(90),
  ],
  ['prizepicks beside underdog', 15, [entry('prizepicks', 40), entry('underdog', 15)], fresh],
  [
    'prizepicks beside underdog',
    16,
    [entry('prizepicks', 40), entry('underdog', 16)],
    staleBeyond(15),
  ],
  ['underdog alone', 16, [entry('underdog', 16)], staleBeyond(15)],
  ['a pool with no providers', 16, [], staleBeyond(15)],
  ['a pool whose providers have no evidence', 16, [missing('underdog')], staleBeyond(15)],
])('%s read %i minutes ago is held to its bar', (_label, minutes, providers, expected) => {
  expect(getSurfaceFreshnessPresentation(pool(minutes, providers), 'pool', NOW)).toEqual(expected);
});

test('a prizepicks entry the backend did not serve as fresh keeps its own status', () => {
  const missing = { name: 'prizepicks', status: 'missing', retrievedAt: null };

  expect(getSurfaceFreshnessPresentation(missing, 'pool', NOW)).toEqual({
    status: 'missing',
    warning: true,
    thresholdNote: null,
  });
});
