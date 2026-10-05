import {
  BACKTEST_SEASONS,
  describeBacktestSeason,
  publishedSeasonOf,
  seasonUnavailableDetails,
} from './backtestSample';

const refusal = (details, code = 'season_unavailable') => ({
  response: {
    status: 503,
    data: { error: { code, message: 'The season is unavailable.', details } },
  },
});

test('a Backtest reads 2025-26 or 2026-27, in that order, and never 2024-25', () => {
  expect(BACKTEST_SEASONS).toEqual(['2025-26', '2026-27']);
});

/*
 * A refusal names either Backtest season, whatever the published season
 * actually is: 2026-27 refused before it is published, or 2025-26 refused
 * after it.
 */
test('refusal details name either Backtest season against the actual published one', () => {
  expect(
    seasonUnavailableDetails(
      refusal({ season: '2026-27', published_season: '2025-26', stream: 'player_game_logs' }),
    ),
  ).toEqual({ season: '2026-27', publishedSeason: '2025-26', stream: 'player_game_logs' });
  expect(
    seasonUnavailableDetails(
      refusal({ season: '2025-26', published_season: '2026-27', stream: 'grouped_shot_types' }),
    ),
  ).toEqual({ season: '2025-26', publishedSeason: '2026-27', stream: 'grouped_shot_types' });
  expect(
    seasonUnavailableDetails(
      refusal({ season: '2025-26', published_season: '2025-26', stream: 'player_game_logs' }),
    ),
  ).toEqual({ season: '2025-26', publishedSeason: '2025-26', stream: 'player_game_logs' });
});

test.each([
  ['a season no Backtest reads', { season: '2024-25', published_season: '2025-26', stream: 's' }],
  ['a malformed season', { season: '2026-99', published_season: '2026-27', stream: 's' }],
  ['a malformed published season', { season: '2026-27', published_season: '2026', stream: 's' }],
  ['a missing stream', { season: '2025-26', published_season: '2026-27' }],
])('refusal details naming %s say nothing', (_, details) => {
  expect(seasonUnavailableDetails(refusal(details))).toBeNull();
});

test('only a season_unavailable refusal has season details', () => {
  expect(
    seasonUnavailableDetails(
      refusal(
        { season: '2025-26', published_season: '2025-26', stream: 'player_game_logs' },
        'invalid_input',
      ),
    ),
  ).toBeNull();
  expect(seasonUnavailableDetails(refusal(undefined))).toBeNull();
});

/*
 * The default is not the published season: a default read implies nothing
 * about which season is published, unlike an earlier backend's reasons.
 */
test('a default read names the published season only when the backend does', () => {
  expect(publishedSeasonOf({ season: '2025-26', seasonReason: 'default' })).toBeNull();
  expect(
    publishedSeasonOf({ season: '2025-26', seasonReason: 'default', publishedSeason: '2026-27' }),
  ).toBe('2026-27');
  expect(publishedSeasonOf({ season: '2025-26', seasonReason: 'published' })).toBe('2025-26');
  expect(publishedSeasonOf({ season: '2025-26', seasonReason: 'fallback_no_games' })).toBe(
    '2026-27',
  );
});

test('a Backtest names its season as default, to date, or whole', () => {
  expect(describeBacktestSeason({ season: '2025-26', seasonReason: 'default' })).toBe(
    '2025-26 default season',
  );
  expect(
    describeBacktestSeason({
      season: '2026-27',
      seasonReason: 'requested',
      publishedSeason: '2025-26',
    }),
  ).toBe('2026-27 season to date');
  expect(
    describeBacktestSeason({
      season: '2025-26',
      seasonReason: 'requested',
      publishedSeason: '2026-27',
    }),
  ).toBe('2025-26 season');
  expect(describeBacktestSeason(null)).toBe('season to date');
});
