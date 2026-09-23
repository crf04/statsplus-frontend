/*
 * The app-wide opponent (defensive) filter vocabulary, grouped by category.
 *
 * The vocabulary is the backend's `SUPPORTED_TEAM_FILTERS`
 * (statsplus-backend app/models/catalogs.py); the defensive filter dropdown,
 * the applied-filter badges, the Saved Filter Set descriptions, and the query
 * reference page all render from this one structure so they cannot drift.
 *
 * `token` is the value the API speaks, `label` is the short name the controls
 * show, and `means` is the description the reference page teaches.
 */
export const OPPONENT_FILTERS = [
  {
    category: 'General defense',
    items: [
      { token: 'OPP_PTS', label: 'Points Allowed', means: 'Overall defense' },
      { token: 'OPP_REB', label: 'Rebounds Allowed', means: 'Rebounds allowed' },
      { token: 'OPP_AST', label: 'Assists Allowed', means: 'Assists allowed' },
      { token: 'OPP_STOCKS', label: 'Steals + Blocks', means: 'Steals + blocks allowed' },
      { token: 'OPP_STL', label: 'Steals', means: 'Steals allowed' },
      { token: 'OPP_BLK', label: 'Blocks', means: 'Blocks allowed' },
      { token: 'OPP_FTA', label: 'Free Throws Allowed', means: 'Fouls (FT attempts)' },
      { token: 'OPP_TOV', label: 'Turnovers Forced', means: 'Turnovers forced' },
    ],
  },
  {
    category: 'Shot type defense',
    items: [
      { token: 'C&S PTS', label: 'Catch & Shoot Points', means: 'Catch-and-shoot defense' },
      { token: 'C&S 3s', label: 'Catch & Shoot 3s', means: 'Catch-and-shoot threes allowed' },
      { token: 'C&S 3A', label: 'Catch & Shoot 3PA', means: 'Catch-and-shoot 3PT attempts' },
      { token: 'PU PTS', label: 'Pull-Up Points', means: 'Pull-up shot defense' },
      { token: 'PU 2s', label: 'Pull-Up 2s', means: 'Pull-up two defense' },
      { token: 'PU 3s', label: 'Pull-Up 3s', means: 'Pull-up three defense' },
      { token: 'Less Than 10 ft', label: 'Inside 10 ft', means: 'Paint protection' },
      { token: 'OPP_FG3M', label: '3s Allowed', means: 'Threes allowed' },
      { token: 'OPP_FG3A', label: '3PT Attempts Allowed', means: 'Three-point attempts allowed' },
    ],
  },
  {
    category: 'Play type defense',
    items: [
      { token: 'Transition', label: 'Transition', means: 'Fast-break defense' },
      { token: 'Isolation', label: 'Isolation', means: 'Iso defense' },
      { token: 'Spotup', label: 'Spot-Up', means: 'Spot-up defense' },
      { token: 'Handoff', label: 'Handoff', means: 'Handoff defense' },
      { token: 'OffScreen', label: 'Off-Screen', means: 'Off-screen defense' },
      { token: 'Postup', label: 'Post-Up', means: 'Post-up defense' },
      {
        token: 'PRBallHandler',
        label: 'P&R Ball-Handler',
        means: 'Pick-and-roll ball-handler defense',
      },
      { token: 'PRRollMan', label: 'P&R Roll-Man', means: 'Pick-and-roll roll-man defense' },
      { token: 'Cut', label: 'Cuts', means: 'Cutting defense' },
      { token: 'OffRebound', label: 'Putbacks', means: 'Putback defense' },
      {
        token: 'Misc',
        label: 'Miscellaneous',
        means: 'Everything the other play types do not cover',
      },
    ],
  },
  {
    category: 'Assists allowed',
    items: [
      { token: 'AtRimAssists', label: 'At-Rim Assists', means: 'Assists on shots at the rim' },
      { token: 'TwoPtAssists', label: 'Two-Point Assists', means: 'Assists on two-point shots' },
      {
        token: 'ThreePtAssists',
        label: 'Three-Point Assists',
        means: 'Assists on three-point shots',
      },
      { token: 'Arc3Assists', label: 'Arc 3 Assists', means: 'Assists on above-the-break threes' },
      { token: 'Corner3Assists', label: 'Corner 3 Assists', means: 'Assists on corner threes' },
      {
        token: 'ShortMidRangeAssists',
        label: 'Short Mid-Range Assists',
        means: 'Assists on short mid-range shots',
      },
      {
        token: 'LongMidRangeAssists',
        label: 'Long Mid-Range Assists',
        means: 'Assists on long mid-range shots',
      },
    ],
  },
];

const labelByToken = new Map(
  OPPONENT_FILTERS.flatMap((group) => group.items).map((item) => [item.token, item.label]),
);

/** The short display name for an opponent filter token; unknown tokens pass through. */
export const opponentFilterLabel = (token) => labelByToken.get(token) ?? token;

/**
 * The backend ranks every team by the filter's own metric, rank 1 being the
 * highest value, and one `rank_filter[]` entry selects from that list: `N` is
 * ranks 1 through N, `-N` the last N ranked teams, and `low,high` the
 * inclusive ranks low through high. Whether rank 1 is the tougher defense
 * depends on the metric, so the words stay with ranks rather than claiming it.
 */
export const RANK_TEAM_LIMIT = 30;

const SIGNED_RANK = /^[+-]?\d+$/;
const RANK_RANGE = /^(\d+),(\d+)$/;

/**
 * One rank_filter[] entry in its canonical form: a nonzero whole number, or a
 * "low,high" string with 1 <= low <= high. Anything else is null, because the
 * API rejects it (and a zero rank would match no team).
 */
export const parseRank = (rank) => {
  const text = String(rank).replace(/\s+/g, '');
  if (SIGNED_RANK.test(text)) {
    const value = Number(text);
    return value === 0 ? null : value;
  }
  const range = RANK_RANGE.exec(text);
  if (!range) return null;
  const [low, high] = [Number(range[1]), Number(range[2])];
  return low >= 1 && low <= high ? `${low},${high}` : null;
};

/**
 * The rank_filter[] entry for an inclusive rank range. A range starting at
 * rank 1 is sent as the plain count, the form every earlier link used.
 */
export const encodeRankRange = ([low, high]) => (low === 1 ? high : `${low},${high}`);

/**
 * The slider position for a parsed rank. "The last N" has no fixed ranks when
 * a filter ranks fewer than every team, so it is shown against the full league.
 */
export const rankRangeOf = (rank) => {
  if (typeof rank === 'string') return rank.split(',').map(Number);
  if (rank > 0) return [1, Math.min(rank, RANK_TEAM_LIMIT)];
  return [Math.max(1, RANK_TEAM_LIMIT + rank + 1), RANK_TEAM_LIMIT];
};

const describeRanks = (low, high) => (low === high ? `rank ${low}` : `ranks ${low}–${high}`);

/** "ranks 1–10", "rank 7", "ranks 11–20", or "last 8"; an unusable entry passes through. */
export const describeRank = (rank) => {
  const parsed = parseRank(rank);
  if (parsed === null) return String(rank);
  if (typeof parsed === 'string') return describeRanks(...rankRangeOf(parsed));
  return parsed > 0 ? describeRanks(1, parsed) : `last ${-parsed}`;
};

/** The badge text for one opponent filter, e.g. "Points Allowed (ranks 11–20)". */
export const opponentFilterRankLabel = (token, rank) =>
  `${opponentFilterLabel(token)} (${describeRank(rank)})`;

/** The flat token list the dropdown accepts, with the `None` sentinel first. */
export const defensiveOptions = [
  'None',
  ...OPPONENT_FILTERS.flatMap((group) => group.items.map((item) => item.token)),
];
