// A Defense Sheet reading with no league comparison says so rather than
// printing a relative figure it does not have. The Matchup sheet and a
// Target's readings show the same rows, so they refuse in the same words.
export const UNAVAILABLE_RELATIVE_LABEL = 'vs league: unavailable (not comparable)';

export const DIET_SHARE_DISPLAY_THRESHOLDS = Object.freeze({
  playTypes: Object.freeze({ minimumSigmaDeviation: 0.5, minimumVolumePerGame: 1 }),
  shotZones: Object.freeze({ minimumSigmaDeviation: 0.5, minimumVolumePerGame: 1 }),
  shotTypes: Object.freeze({ minimumSigmaDeviation: 0.5, minimumVolumePerGame: 4 }),
  assistLocations: Object.freeze({ minimumSigmaDeviation: 0.5, minimumVolumePerGame: 1 }),
  // A shot type's twos or threes alone: a lower floor, so a +2 sigma pull-up
  // threes shooter at 3 a game still shows.
  shotValues: Object.freeze({ minimumSigmaDeviation: 0.5, minimumVolumePerGame: 2 }),
});

export const shouldDisplayDietShare = (base, value) => {
  const threshold = DIET_SHARE_DISPLAY_THRESHOLDS[base];
  return (
    Boolean(threshold) &&
    value.sigmaDeviation !== null &&
    Math.abs(value.sigmaDeviation) >= threshold.minimumSigmaDeviation &&
    value.volumePerGame >= threshold.minimumVolumePerGame
  );
};

// Books are named in full where a sentence names them and by a two-letter mark
// where a row only needs to say which posted him.
const BOOK_NAMES = {
  prizepicks: 'PrizePicks',
  underdog: 'Underdog',
  draftkings: 'DraftKings',
  fanduel: 'FanDuel',
  dabble: 'Dabble',
  kalshi: 'Kalshi',
  novig: 'Novig',
  polymarket: 'Polymarket',
};
const BOOK_MARKS = {
  prizepicks: 'PP',
  underdog: 'UD',
  draftkings: 'DK',
  fanduel: 'FD',
  dabble: 'DB',
  kalshi: 'KX',
  novig: 'NV',
  polymarket: 'PM',
};
// Prediction markets price the line from what traders pay, so a row leads with
// one when it can. Listed in the order they win a tie.
export const MARKET_PROVIDERS = Object.freeze(['polymarket', 'novig', 'kalshi']);
export const bookName = (provider) =>
  BOOK_NAMES[provider] || provider.charAt(0).toUpperCase() + provider.slice(1);
export const bookMark = (provider) => BOOK_MARKS[provider] || provider.slice(0, 2).toUpperCase();

// A Matchup Score reads as a signed whole percent wherever it is shown.
export const formatScorePercent = (value) => `${value >= 0 ? '+' : ''}${Math.round(value * 100)}%`;

/*
 * Defense Sheet slices in plain English. The wire names a slice by its
 * provider key (`Arc3Assists`, `OffRebound`); a reader should not have to
 * know it. Every slice the decoder accepts is named here.
 */
const SLICE_NAMES = {
  Transition: 'Transition',
  Isolation: 'Isolation',
  PRBallHandler: 'P&R ball handler',
  PRRollMan: 'P&R roll man',
  OffRebound: 'Putbacks',
  Spotup: 'Spot up',
  Cut: 'Cut',
  Handoff: 'Handoff',
  OffScreen: 'Off screen',
  Postup: 'Post up',
  'Restricted Area': 'Restricted area',
  'In The Paint (Non-RA)': 'Paint (non-restricted)',
  'Mid-Range': 'Mid-range',
  'Corner 3': 'Corner 3s',
  'Above the Break 3': 'Above-the-break 3s',
  'Catch and Shoot': 'Catch-and-shoot',
  Pullups: 'Pull-up',
  'Less Than 10 ft': 'Under 10 ft',
  Arc3Assists: 'Above-the-break 3s',
  Corner3Assists: 'Corner 3s',
  AtRimAssists: 'At the rim',
  ShortMidRangeAssists: 'Short mid-range',
  LongMidRangeAssists: 'Long mid-range',
  OPP_REB: 'Rebounds',
  OPP_TOV: 'Turnovers forced',
  OPP_STL: 'Steals',
  OPP_BLK: 'Blocks',
};
export const sliceName = (sliceKey) => SLICE_NAMES[sliceKey] || sliceKey;

// One player's season diet fact for one slice, whether or not it is displayable.
// Capture reads it for the league average the slice is measured against, which
// the display gate has no say over. A shot value ('2' or '3') reads just the
// shot type's twos or threes, or nothing when the split is missing.
export const findDietShare = (player, base, sliceKey, shotValue = null) => {
  const season = player.dietShares[base]?.find((entry) => entry.key === sliceKey)?.season;
  if (!season) return null;
  return shotValue ? season.shotValues?.[shotValue] || null : season;
};

export const getDisplayableDietShare = (player, base, sliceKey, shotValue = null) => {
  const value = findDietShare(player, base, sliceKey, shotValue);
  return value && shouldDisplayDietShare(shotValue ? 'shotValues' : base, value) ? value : null;
};

// Stat Categories read in box-score order wherever a reader picks one: the
// Defense Sheet market tabs and the selection card. The API lists them
// alphabetically. Anything unnamed here keeps its API position at the end.
export const CATEGORY_ORDER = Object.freeze([
  'PTS',
  'REB',
  'AST',
  '3PM',
  'STL',
  'BLK',
  'TOV',
  'FGA',
  'FG2A',
  'FG3A',
  'PR',
  'PA',
  'RA',
  'PRA',
  'STKS',
]);

export const orderCategories = (categories) => {
  const rank = (category) => {
    const index = CATEGORY_ORDER.indexOf(category);
    return index === -1 ? CATEGORY_ORDER.length : index;
  };
  return [...categories].sort((a, b) => rank(a) - rank(b));
};
