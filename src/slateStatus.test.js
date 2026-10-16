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

test('the pool as a whole keeps the 15 minute bar', () => {
  const pool = { status: 'fresh', retrievedAt: minutesAgo(16), providers: [] };

  expect(getSurfaceFreshnessPresentation(pool, 'pool', NOW)).toEqual(staleBeyond(15));
});

test('a prizepicks entry the backend did not serve as fresh keeps its own status', () => {
  const missing = { name: 'prizepicks', status: 'missing', retrievedAt: null };

  expect(getSurfaceFreshnessPresentation(missing, 'pool', NOW)).toEqual({
    status: 'missing',
    warning: true,
    thresholdNote: null,
  });
});
