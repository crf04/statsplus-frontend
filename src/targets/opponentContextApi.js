import { apiClient, getApiUrl } from '../config';
import { TARGET_SLICES } from './targetCatalog';

const TEAM_CODES = {
  'Atlanta Hawks': 'ATL',
  'Boston Celtics': 'BOS',
  'Brooklyn Nets': 'BKN',
  'Charlotte Hornets': 'CHA',
  'Chicago Bulls': 'CHI',
  'Cleveland Cavaliers': 'CLE',
  'Dallas Mavericks': 'DAL',
  'Denver Nuggets': 'DEN',
  'Detroit Pistons': 'DET',
  'Golden State Warriors': 'GSW',
  'Houston Rockets': 'HOU',
  'Indiana Pacers': 'IND',
  'Los Angeles Clippers': 'LAC',
  'Los Angeles Lakers': 'LAL',
  'Memphis Grizzlies': 'MEM',
  'Miami Heat': 'MIA',
  'Milwaukee Bucks': 'MIL',
  'Minnesota Timberwolves': 'MIN',
  'New Orleans Pelicans': 'NOP',
  'New York Knicks': 'NYK',
  'Oklahoma City Thunder': 'OKC',
  'Orlando Magic': 'ORL',
  'Philadelphia 76ers': 'PHI',
  'Phoenix Suns': 'PHX',
  'Portland Trail Blazers': 'POR',
  'Sacramento Kings': 'SAC',
  'San Antonio Spurs': 'SAS',
  'Toronto Raptors': 'TOR',
  'Utah Jazz': 'UTA',
  'Washington Wizards': 'WAS',
};

export const OPPONENT_CATEGORIES = {
  play_types: 'Playtype Points',
  shot_types: 'Shooting Type',
  shot_zones: 'Zone Shooting',
  assist_locations: 'Assists',
};

export const opponentMetricLabel = (base) =>
  base === 'play_types'
    ? 'Points allowed /48'
    : base === 'assist_locations'
      ? 'Assists allowed'
      : 'FGA allowed /48';

// Keep partial/unpublished data unavailable rather than inventing a zero or rank.
export function decodeOpponentProfile(base, payload) {
  const shooting = base === 'shot_types';
  if (
    shooting
      ? !Array.isArray(payload)
      : !payload || typeof payload !== 'object' || Array.isArray(payload)
  ) {
    throw new Error('Invalid opponent profile');
  }
  return Object.fromEntries(
    (TARGET_SLICES[base] ?? []).flatMap(([slice]) => {
      const row = shooting ? payload.find((entry) => entry?.ShootingType === slice) : payload;
      const key = shooting ? 'FGA' : base === 'shot_zones' ? `${slice}_OPP_FGA` : slice;
      const value = row?.[key];
      if (!Number.isFinite(value) || value < 0) return [];
      const rawRank = row[`${key}_RANK`];
      const rawDiff = base === 'assist_locations' ? (value - 1) * 100 : row[`${key}_vs_avg_pct`];
      return [
        [
          slice,
          {
            value,
            rank: Number.isInteger(rawRank) && rawRank >= 1 && rawRank <= 30 ? rawRank : null,
            vsAverage: Number.isFinite(rawDiff) ? rawDiff : null,
          },
        ],
      ];
    }),
  );
}

export async function fetchOpponentProfile({ opponent, base, signal }) {
  const team = Object.keys(TEAM_CODES).find((name) => TEAM_CODES[name] === opponent);
  const category = OPPONENT_CATEGORIES[base];
  if (!team || !category) throw new Error('Unsupported opponent profile');
  const { data } = await apiClient.get(getApiUrl('TEAM_STATS'), {
    params: { team, category },
    signal,
  });
  return decodeOpponentProfile(base, data);
}
