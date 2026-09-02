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

/** The flat token list the dropdown accepts, with the `None` sentinel first. */
export const defensiveOptions = [
  'None',
  ...OPPONENT_FILTERS.flatMap((group) => group.items.map((item) => item.token)),
];
