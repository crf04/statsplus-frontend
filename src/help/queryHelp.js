// The query language, as the landing page and the reference page teach it.
// The ladder is ordered: each rung is the rung above it plus `added`.

export const QUERY_LADDER = [
  {
    id: 'start',
    rung: 'Start with a player',
    query: 'Jalen Johnson this year',
    added: 'this year',
    note: 'A name and a period is a complete query. Everything else narrows it.',
  },
  {
    id: 'narrow',
    rung: 'Narrow it down',
    query: 'Jalen Johnson this year without Trae Young',
    added: 'without Trae Young',
    note: 'Ask what he does when the offence runs through him instead.',
  },
  {
    id: 'stack',
    rung: 'Stack the filters',
    query:
      'Jalen Johnson this year without Trae Young against bottom 10 defenses playing 25+ minutes',
    added: 'against bottom 10 defenses playing 25+ minutes',
    note: 'Filters combine. Keep adding clauses until the sample is the one you mean.',
  },
];

export const KEYWORDS = [
  { keyword: 'last', means: 'Only the most recent N games.' },
  { keyword: 'since', means: 'Only games after a date you name.' },
  { keyword: 'without', means: 'Only games a named teammate missed.' },
  { keyword: 'with', means: 'Only games a named teammate played.' },
  { keyword: 'against', means: 'Only games versus opponents matching a defensive rank.' },
  { keyword: 'at home', means: 'Home games only. Use "on the road" for away games.' },
  { keyword: 'playing 30+ minutes', means: 'Drops blowout and injury outliers by workload.' },
];

export const OPPONENT_RANK_NOTE =
  'Use "top" for the best defenses and "bottom" for the worst. Bottom ranks are the better matchups for the player.';

// The vocabulary is the backend's `SUPPORTED_TEAM_FILTERS`
// (statsplus-backend app/models/catalogs.py), which is wider than the
// frontend's own `defensiveOptions` dropdown in src/utils.js.
export const OPPONENT_FILTERS = [
  {
    category: 'General defense',
    items: [
      { token: 'OPP_PTS', means: 'Overall defense' },
      { token: 'OPP_REB', means: 'Rebounds allowed' },
      { token: 'OPP_AST', means: 'Assists allowed' },
      { token: 'OPP_STOCKS', means: 'Steals + blocks allowed' },
      { token: 'OPP_STL', means: 'Steals allowed' },
      { token: 'OPP_BLK', means: 'Blocks allowed' },
      { token: 'OPP_FTA', means: 'Fouls (FT attempts)' },
      { token: 'OPP_TOV', means: 'Turnovers forced' },
    ],
  },
  {
    category: 'Shot type defense',
    items: [
      { token: 'C&S PTS', means: 'Catch-and-shoot defense' },
      { token: 'C&S 3s', means: 'Catch-and-shoot threes allowed' },
      { token: 'C&S 3A', means: 'Catch-and-shoot 3PT attempts' },
      { token: 'PU PTS', means: 'Pull-up shot defense' },
      { token: 'PU 2s', means: 'Pull-up two defense' },
      { token: 'PU 3s', means: 'Pull-up three defense' },
      { token: 'Less Than 10 ft', means: 'Paint protection' },
      { token: 'OPP_FG3M', means: 'Threes allowed' },
      { token: 'OPP_FG3A', means: 'Three-point attempts allowed' },
    ],
  },
  {
    category: 'Play type defense',
    items: [
      { token: 'Transition', means: 'Fast-break defense' },
      { token: 'Isolation', means: 'Iso defense' },
      { token: 'Spotup', means: 'Spot-up defense' },
      { token: 'Handoff', means: 'Handoff defense' },
      { token: 'OffScreen', means: 'Off-screen defense' },
      { token: 'Postup', means: 'Post-up defense' },
      { token: 'PRBallHandler', means: 'Pick-and-roll ball-handler defense' },
      { token: 'PRRollMan', means: 'Pick-and-roll roll-man defense' },
      { token: 'Cut', means: 'Cutting defense' },
      { token: 'OffRebound', means: 'Putback defense' },
      { token: 'Misc', means: 'Everything the other play types do not cover' },
    ],
  },
  {
    category: 'Assists allowed',
    items: [
      { token: 'AtRimAssists', means: 'Assists on shots at the rim' },
      { token: 'TwoPtAssists', means: 'Assists on two-point shots' },
      { token: 'ThreePtAssists', means: 'Assists on three-point shots' },
      { token: 'Arc3Assists', means: 'Assists on above-the-break threes' },
      { token: 'Corner3Assists', means: 'Assists on corner threes' },
      { token: 'ShortMidRangeAssists', means: 'Assists on short mid-range shots' },
      { token: 'LongMidRangeAssists', means: 'Assists on long mid-range shots' },
    ],
  },
];

export const STACKED_EXAMPLES = [
  'LeBron James games without Anthony Davis and with Austin Reaves last 15 games',
  'Trae Young games without Jalen Johnson against bottom 10 defenses since January 1st',
  'Giannis games at home with 10+ FGA playing 30+ minutes',
  'Anthony Davis games with Kyrie Irving and Klay Thompson against bottom 10 paint defenses',
];

/**
 * Split a rung's query around the clause it adds, so the addition can be marked
 * without dangerously setting inner HTML.
 */
export const splitAddedClause = (query, added) => {
  const at = query.lastIndexOf(added);
  if (at < 0) return { before: query, added: '', after: '' };
  return { before: query.slice(0, at), added, after: query.slice(at + added.length) };
};
