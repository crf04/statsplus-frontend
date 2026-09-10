import { apiClient } from '../config';
import { decodeOpponentProfile, fetchOpponentProfile } from './opponentContextApi';
import { TARGET_SLICES } from './targetCatalog';

jest.mock('../config', () => ({
  apiClient: { get: jest.fn() },
  getApiUrl: () => '/api/teams/stats',
}));

afterEach(() => jest.clearAllMocks());

test('requests the exact opponent and points-volume category through the shared transport', async () => {
  const signal = new AbortController().signal;
  apiClient.get.mockResolvedValue({ data: { Spotup: 24, Spotup_RANK: 2, Spotup_vs_avg_pct: -13 } });
  const result = await fetchOpponentProfile({ opponent: 'ORL', base: 'play_types', signal });
  expect(apiClient.get).toHaveBeenCalledWith('/api/teams/stats', {
    params: { team: 'Orlando Magic', category: 'Playtype Points' },
    signal,
  });
  expect(result.Spotup).toEqual({ value: 24, rank: 2, vsAverage: -13 });
});

test('uses the combined shot-attempt rank, never points or component ranks', () => {
  const result = decodeOpponentProfile('shot_types', [
    {
      ShootingType: 'Catch and Shoot',
      FGA: 10,
      FGA_RANK: 30,
      FGA_vs_avg_pct: 60,
      FG2A: 2,
      FG2A_RANK: 1,
      FG3A: 8,
      FG3A_RANK: 30,
      PTS: 22,
      PTS_RANK: 12,
      PTS_vs_avg_pct: -4,
    },
  ]);
  expect(result['Catch and Shoot']).toEqual({ value: 10, rank: 30, vsAverage: 60 });
  expect(result.Pullups).toBeUndefined();
});

test.each(
  Object.entries(TARGET_SLICES).flatMap(([base, slices]) => slices.map(([slice]) => [base, slice])),
)('maps %s / %s to its exact defensive field', (base, slice) => {
  const key = base === 'shot_types' ? 'FGA' : base === 'shot_zones' ? `${slice}_OPP_FGA` : slice;
  const row = {
    [key]: base === 'assist_locations' ? 1.25 : 25,
    [`${key}_RANK`]: 23,
    [`${key}_vs_avg_pct`]: base === 'assist_locations' ? 3 : 25,
  };
  const payload = base === 'shot_types' ? [{ ShootingType: slice, ...row }] : row;
  expect(decodeOpponentProfile(base, payload)[slice]).toEqual({
    value: row[key],
    rank: 23,
    vsAverage: 25,
  });
});

test('does not turn missing, malformed, or non-finite values into defensive strength', () => {
  expect(decodeOpponentProfile('play_types', { Spotup: '24' })).toEqual({});
  expect(
    decodeOpponentProfile('play_types', { Spotup: 0, Spotup_RANK: 0, Spotup_vs_avg_pct: null })
      .Spotup,
  ).toEqual({ value: 0, rank: null, vsAverage: null });
  expect(
    decodeOpponentProfile('shot_types', [{ ShootingType: 'Catch and Shoot', FG2A: 2, FG3A: 8 }]),
  ).toEqual({});
  expect(() => decodeOpponentProfile('shot_types', {})).toThrow('Invalid opponent profile');
  expect(() => decodeOpponentProfile('play_types', null)).toThrow('Invalid opponent profile');
});
