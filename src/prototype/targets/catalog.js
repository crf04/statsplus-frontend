/* PROTOTYPE — throwaway. Slice vocabulary mirrored from the matchup decoder. */

export const BASES = [
  { key: 'shotZones', apiKey: 'shot_zones', label: 'Shot zones', unit: 'of FGA' },
  { key: 'playTypes', apiKey: 'play_types', label: 'Play types', unit: 'of poss' },
  { key: 'shotTypes', apiKey: 'shot_types', label: 'Shot types', unit: 'of FGA' },
  { key: 'assistLocations', apiKey: 'assist_locations', label: 'Assist locations', unit: 'of AST' },
];

export const SLICES = {
  shotZones: [
    ['Restricted Area', 'Restricted area'],
    ['In The Paint (Non-RA)', 'Paint (non-RA)'],
    ['Mid-Range', 'Mid-range'],
    ['Corner 3', 'Corner 3'],
    ['Above the Break 3', 'Above-break 3'],
  ],
  playTypes: [
    ['Transition', 'Transition'],
    ['Isolation', 'Isolation'],
    ['PRBallHandler', 'P&R ball handler'],
    ['PRRollMan', 'P&R roll man'],
    ['Spotup', 'Spot up'],
    ['Cut', 'Cut'],
    ['Handoff', 'Handoff'],
    ['OffScreen', 'Off screen'],
    ['Postup', 'Post up'],
    ['OffRebound', 'Putback'],
  ],
  shotTypes: [
    ['Catch and Shoot', 'Catch & shoot'],
    ['Pullups', 'Pull-up'],
    ['Less Than 10 ft', 'Inside 10 ft'],
  ],
  assistLocations: [
    ['Arc3Assists', 'Arc 3 assists'],
    ['Corner3Assists', 'Corner 3 assists'],
    ['AtRimAssists', 'At-rim assists'],
    ['ShortMidRangeAssists', 'Short mid assists'],
    ['LongMidRangeAssists', 'Long mid assists'],
  ],
};

export const baseOf = (key) => BASES.find((base) => base.key === key || base.apiKey === key);
export const sliceLabel = (base, sliceKey) =>
  (SLICES[baseOf(base)?.key] || []).find(([key]) => key === sliceKey)?.[1] || sliceKey;

/* Box-score proxies the matchup already maps to each slice. */
export const marketsFor = (base, sliceKey) => {
  const b = baseOf(base)?.key;
  if (b === 'shotZones') return ['Corner 3', 'Above the Break 3'].includes(sliceKey) ? ['PTS', '3PM'] : ['PTS'];
  if (b === 'shotTypes') return sliceKey === 'Less Than 10 ft' ? ['PTS'] : ['PTS', '3PM'];
  if (b === 'assistLocations') return ['AST'];
  return ['PTS'];
};

// Volume floors the matchup uses before it will display a Diet Share.
export const THIN_VOLUME = { shotZones: 1, playTypes: 1, shotTypes: 4, assistLocations: 1 };

export const TEAMS = [
  'ATL', 'BOS', 'BKN', 'CHA', 'CHI', 'CLE', 'DAL', 'DEN', 'DET', 'GSW',
  'HOU', 'IND', 'LAC', 'LAL', 'MEM', 'MIA', 'MIL', 'MIN', 'NOP', 'NYK',
  'OKC', 'ORL', 'PHI', 'PHX', 'POR', 'SAC', 'SAS', 'TOR', 'UTA', 'WAS',
];
