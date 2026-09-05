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

/*
 * The backend writes a share as a whole percent when it is one and to a single
 * decimal otherwise, so 0.4 reads 40% and 0.405 reads 40.5%. The preview has to
 * spell it the same way or it would promise a title the backend will not store.
 */
export const formatShare = (share) => {
  const percent = (share * 100).toFixed(1);
  return `${percent.endsWith('.0') ? percent.slice(0, -2) : percent}%`;
};

/*
 * An observed share is an estimate from a season of shots, so it reads to the
 * whole percent the Matchup's Diet chips use. A Qualifier's threshold is not:
 * it is what was typed, and keeps the decimal its title was derived with.
 */
export const formatObservedShare = (share) => `${Math.round(share * 100)}%`;

/*
 * A figure read against a baseline carries its direction, whether the baseline
 * is the league, a player's own season, or zero sigma.
 */
export const signed = (value) => `${value > 0 ? '+' : ''}${value.toFixed(1)}`;

/*
 * A Qualifier reads as a slice and the bound put on it. The card sets the bound
 * apart from the slice it applies to, so the two parts are published separately
 * and the flat form is built from them rather than spelled twice.
 */
export const formatQualifierParts = (qualifier) => ({
  label: targetSliceLabel(qualifier.base, qualifier.sliceKey),
  value: `${comparatorSymbol(qualifier.comparator)} ${formatShare(qualifier.threshold)}`,
});

export const formatQualifier = (qualifier) => {
  const { label, value } = formatQualifierParts(qualifier);
  return `${label} ${value}`;
};

/*
 * The backend owns the stored title, so this derivation exists only to preview
 * the title an unsaved draft would earn. It follows the documented format:
 * opponent tricode, "vs", then each Qualifier, comma-separated. The slice
 * wording is this page's, so if the backend spells a slice differently the
 * labels above are what has to move, never the saved title. See crf04/statsplus
 * docs/adr/0001-targets-store-player-criteria-not-team-readings.md.
 */
export const deriveTargetTitle = ({ opponent, qualifiers }) =>
  `${opponent} vs ${qualifiers.map(formatQualifier).join(', ')}`;

/*
 * A threshold is typed as a percentage and stored as a 0–1 share, rounded to
 * the single decimal the title is written at so that what was previewed is
 * what gets stored. A blank or out-of-range entry has no share, which is what
 * keeps the draft unsaveable.
 */
export const parseThresholdPercent = (percentText) => {
  const trimmed = String(percentText).trim();
  if (!trimmed) return null;
  const percent = Number(trimmed);
  if (!Number.isFinite(percent) || percent < 0 || percent > 100) return null;
  return Math.round(percent * 10) / 1000;
};

/*
 * The inverse: a share that arrives from somewhere else — a stored Qualifier,
 * a slice's league average — spelled as the percentage the field is typed in.
 * Every share the form shows travels through here, so there is one conversion
 * rule rather than one per caller. It rounds to the single decimal the parser
 * keeps, except for a capture prefill, which asks for `whole` because a league
 * average is a round number to argue with rather than a figure to reproduce.
 */
export const shareToThresholdPercent = (share, { whole = false } = {}) =>
  String(whole ? Math.round(share * 100) : Math.round(share * 1000) / 10);
