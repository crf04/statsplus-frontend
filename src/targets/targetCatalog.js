/*
 * The vocabulary a Qualifier is written in: the four diet bases and their
 * slices, as the backend's player diet publishes them. The matchup decoder
 * validates the same slice keys, but it validates rather than labels them and
 * also carries the team-only `traditional` base, which no Qualifier can use.
 */
export const TARGET_BASES = [
  { key: 'shot_zones', label: 'Shot zones', unit: 'of FGA' },
  { key: 'play_types', label: 'Play types', unit: 'of possessions' },
  { key: 'shot_types', label: 'Shot types', unit: 'of FGA' },
  { key: 'assist_locations', label: 'Assist locations', unit: 'of assists' },
];

export const TARGET_SLICES = {
  shot_zones: [
    ['Restricted Area', 'Restricted area'],
    ['In The Paint (Non-RA)', 'Paint (non-RA)'],
    ['Mid-Range', 'Mid-range'],
    ['Corner 3', 'Corner 3'],
    ['Above the Break 3', 'Above-break 3'],
  ],
  play_types: [
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
  shot_types: [
    ['Catch and Shoot', 'Catch & shoot'],
    ['Pullups', 'Pull-up'],
    ['Less Than 10 ft', 'Inside 10 ft'],
  ],
  assist_locations: [
    ['Arc3Assists', 'Arc 3 assists'],
    ['Corner3Assists', 'Corner 3 assists'],
    ['AtRimAssists', 'At-rim assists'],
    ['ShortMidRangeAssists', 'Short mid assists'],
    ['LongMidRangeAssists', 'Long mid assists'],
  ],
};

export const TARGET_COMPARATORS = [
  { key: 'at_or_above', symbol: '≥', label: 'At or above' },
  { key: 'at_or_below', symbol: '≤', label: 'At or below' },
];

/*
 * A Target names its opponent by tricode, which is also what the derived title
 * reads. No endpoint publishes the tricodes on their own, so the picker holds
 * the league.
 */
export const NBA_TEAM_TRICODES = [
  'ATL',
  'BOS',
  'BKN',
  'CHA',
  'CHI',
  'CLE',
  'DAL',
  'DEN',
  'DET',
  'GSW',
  'HOU',
  'IND',
  'LAC',
  'LAL',
  'MEM',
  'MIA',
  'MIL',
  'MIN',
  'NOP',
  'NYK',
  'OKC',
  'ORL',
  'PHI',
  'PHX',
  'POR',
  'SAC',
  'SAS',
  'TOR',
  'UTA',
  'WAS',
];

export const findTargetBase = (base) => TARGET_BASES.find((entry) => entry.key === base);

export const targetBaseLabel = (base) => findTargetBase(base)?.label || base;

export const targetSliceLabel = (base, sliceKey) =>
  (TARGET_SLICES[base] || []).find(([key]) => key === sliceKey)?.[1] || sliceKey;

export const comparatorSymbol = (comparator) =>
  TARGET_COMPARATORS.find((entry) => entry.key === comparator)?.symbol || comparator;

export const formatShare = (share) => `${Math.round(share * 100)}%`;

export const formatQualifier = (qualifier) =>
  `${targetSliceLabel(qualifier.base, qualifier.sliceKey)} ${comparatorSymbol(
    qualifier.comparator,
  )} ${formatShare(qualifier.threshold)}`;

/*
 * The backend owns the stored title (ADR 0001), so this derivation exists only
 * to preview the title an unsaved draft would earn. It follows the documented
 * format: opponent tricode, "vs", then each Qualifier, comma-separated. The
 * slice wording is this page's, so if the backend spells a slice differently
 * the labels above are what has to move, never the saved title.
 */
export const deriveTargetTitle = ({ opponent, qualifiers }) =>
  `${opponent} vs ${qualifiers.map(formatQualifier).join(', ')}`;

/*
 * A threshold is typed as a whole percentage and stored as a 0–1 share. A blank
 * or out-of-range entry has no share, which is what keeps the draft unsaveable.
 */
export const parseThresholdPercent = (percentText) => {
  const trimmed = String(percentText).trim();
  if (!trimmed) return null;
  const percent = Number(trimmed);
  if (!Number.isFinite(percent) || percent < 0 || percent > 100) return null;
  return Math.round(percent * 100) / 10000;
};
