// Everything the connector can do, one real prompt and one real answer each.
// Answers are production connector results captured 2026-10-19 and re-checked
// 2026-10-20 on the completed 2025-26 season. `card` marks answers drawn as a
// card where the chat app supports it; `writes` marks the two create-only tools.

export const GROUPS = [
  { id: 'night', label: 'Read a night' },
  { id: 'matchup', label: 'Explain a matchup' },
  { id: 'history', label: 'Check the history' },
  { id: 'roles', label: 'Roles and absences' },
  { id: 'ideas', label: 'Build and keep ideas' },
];

export const CAPABILITIES = [
  {
    group: 'night',
    tool: 'Slate',
    title: 'Scan a whole night',
    what: "A date's games, the top and bottom 10 points Matchups, and each game's injury counts.",
    prompt: 'What stands out on the March 20, 2026 slate?',
    answer:
      'Boston at Memphis holds 8 of the top 10 points Matchups; Neemias Queta leads at +8% vs league.',
    card: true,
  },
  {
    group: 'night',
    tool: 'Matchup',
    title: 'Break down one game',
    what: "Both teams' top scores and each defense's three softest and three toughest spots.",
    prompt: 'Break down DET @ CHA on April 10, 2026.',
    answer:
      'Charlotte allows the most to off-screen shooters (25th, +16% vs league) and pick-and-roll ball handlers (26th).',
    card: true,
  },
  {
    group: 'night',
    tool: 'Injury report',
    title: 'Read the injury report',
    what: 'The official report by date or team, with each player’s minutes per game so you know who matters.',
    prompt: "Who's out on March 20, 2026?",
    answer:
      '70 players across 6 games. Biggest absences: Anthony Edwards (35.0 min), Cade Cunningham (33.9).',
    card: true,
  },
  {
    group: 'matchup',
    tool: 'Matchup',
    title: 'Any stat, not just points',
    what: 'Fifteen markets, from rebounds and threes to PRA and steals plus blocks, each with its Season and Last 15 score.',
    prompt: "Show Cade Cunningham's assists matchup against Charlotte.",
    answer:
      'On the completed 2025-26 season: −3% vs league, and the Last 15 agrees (−14%). His rim assists are 49% of the total; Charlotte ranks 16th there.',
    card: true,
  },
  {
    group: 'matchup',
    tool: 'Matchup',
    title: 'No game needed',
    what: 'An Unscheduled Matchup: any player or team against any opponent, any day, offseason included.',
    prompt: "Show Cade Cunningham's matchup against Charlotte.",
    answer:
      'On the completed 2025-26 season: points +0.4% vs league. The edge is his pick-and-roll: 37% of his plays, and Charlotte ranks 26th against it.',
    card: true,
  },
  {
    group: 'matchup',
    tool: 'Matchup',
    title: 'See how he scores',
    what: 'His Diet in every Base: shot types, zones, play types, assist locations and rebound types, against the league share.',
    prompt: "What does Cade Cunningham's shot diet look like against Charlotte?",
    answer:
      'On the completed 2025-26 season: pick-and-roll ball handler on 37% of his plays (league 18%); pull-ups are 40% of his shots (league 24%).',
  },
  {
    group: 'history',
    tool: 'Game logs',
    title: 'Against defenses like tonight’s',
    what: "Pass a Matchup's driver straight into the game logs, ranked on exactly the same metric.",
    prompt:
      'Before DET @ CHA on April 10, 2026, how had Cade done against the 10 defenses that allow the most pick-and-roll points?',
    answer: '21 games: 26.1 points against 24.4 for his season.',
  },
  {
    group: 'history',
    tool: 'Game logs',
    title: 'Stack the filters',
    what: 'Several opponent ranks at once, plus home or away, minutes, one opponent and a date window.',
    prompt:
      'Jalen Duren at home last season against teams that allow the most rebounds and the most roll-man points.',
    answer: '3 games, flagged as a thin sample: 15.0 rebounds against 10.5 for his season.',
  },
  {
    group: 'history',
    tool: 'Game logs',
    title: 'Filter on his own stat line',
    what: 'Keep only games where he hit a mark: 30-point nights, 10-assist games, a usage range.',
    prompt: "Show Cade Cunningham's 35-point games last season.",
    answer: '4 games: 42.3 points, 10.3 rebounds and 10.0 assists in 39.8 minutes.',
  },
  {
    group: 'history',
    tool: 'Game logs',
    title: 'With or without a teammate',
    what: 'Only games where named teammates played, or only games they missed.',
    prompt: 'How did Daniss Jenkins do in the games Cade Cunningham missed last season?',
    answer:
      '18 games: 17.3 points and 7.9 assists in 34.0 minutes, against 9.3 and 3.9 for his season.',
  },
  {
    group: 'history',
    tool: 'Game logs',
    title: 'Count games over a line',
    what: 'Over a line you name, the posted line for his next game, or each game’s stored closing line.',
    prompt:
      'Has Jaime Jaquez beaten his closing lines against the 10 worst transition defenses last season?',
    answer: 'Over his DraftKings closing line in 17 of 27 games (25 had a line); 4 of his last 5.',
  },
  {
    group: 'roles',
    tool: 'Rotation',
    title: "A player's role lately",
    what: 'Starts, minutes, stints and minutes by quarter, recent against the season.',
    prompt: "How did Ausar Thompson's minutes look at the end of last season?",
    answer:
      'Started all of his last 5, at 25.4 minutes against 23.1 for the season; closed none of them.',
  },
  {
    group: 'roles',
    tool: 'Rotation',
    title: 'Every stint of one game',
    what: 'Who played when, for both teams, with each stretch’s in and out clock.',
    prompt: 'Show the rotation for DET @ CHA on April 10, 2026.',
    answer:
      'Ronald Holland II closed from the bench with 21.0 minutes; Jalen Duren played 0.5 minutes in the third.',
    card: true,
  },
  {
    group: 'roles',
    tool: 'Rotation',
    title: 'The whole team without a player',
    what: 'Every teammate’s starts, minutes and per-game stats in the games one or more players missed.',
    prompt: "How did Detroit's players do without Cade Cunningham last season?",
    answer:
      'Jenkins: 16 starts in 18 games, 17.3 points and 7.9 assists. Huerter: 22.8 minutes, up from 11.4.',
  },
  {
    group: 'roles',
    tool: 'On/off',
    title: 'While he sits',
    what: "A team's per-36 rates and usage with chosen players on or off the floor.",
    prompt: 'How did Daniss Jenkins play with Cade Cunningham off the floor last season?',
    answer:
      'Usage 22.5% over 1,164 minutes, against 16.6% beside Cade; assists per 36 rise from 4.1 to 7.5.',
    card: true,
  },
  {
    group: 'roles',
    tool: 'Injury Scenarios',
    title: 'Who benefits on the report',
    what: 'Every teammate of every listed player, scored in the games he missed and the minutes he sat.',
    prompt: 'Which teammates moved when the injured players sat on March 20, 2026?',
    answer: '44 flagged spots, led by Jenkins’ assists with Cade out.',
  },
  {
    group: 'ideas',
    tool: 'Backtest',
    title: 'Test a type of player',
    what: 'Describe players by their Diet and see how everyone who fit did against an opponent.',
    prompt:
      'Backtest players who ran 25% or more of their plays in transition against Washington last season.',
    answer: '35 players over 79 games: +1.2 points against their own average, above it in 49%.',
    card: true,
  },
  {
    group: 'ideas',
    tool: 'Backtest',
    title: 'Add conditions',
    what: "Narrow the opponent's games: a date range, a defender's minutes, each player's own minutes.",
    prompt: 'Backtest rim-heavy players against OKC last season in games Chet Holmgren sat.',
    answer:
      '13 of OKC’s 82 games kept. Rebounds +1.1 against their own average (above it in 54%); points flat.',
    card: true,
  },
  {
    group: 'ideas',
    tool: 'Targets',
    title: 'Your Targets on a date',
    what: 'Your saved Targets resolved against a Slate: which opponents play and which players fit.',
    prompt: 'Which players fit my Targets today?',
    answer:
      'Each fitting player with his shares, the league share and the opponent’s rank, plus each Target’s Backtest.',
    card: true,
  },
  {
    group: 'ideas',
    tool: 'Save Target',
    title: 'Keep an idea as a Target',
    what: 'Save a Backtest you like to your account, to check on every Slate in the web app.',
    prompt: 'Save that as a Target.',
    answer:
      'Created in your account, with a link to open it. It only creates; it never edits or deletes.',
    writes: true,
  },
  {
    group: 'ideas',
    tool: 'Save Filter Set',
    title: 'Keep game-log filters',
    what: 'Save the filters from a game-log answer so they open in the web app’s Log Workspace.',
    prompt: 'Save these filters as "Duren at home vs bad rebounding".',
    answer: 'Saved to your account under that name. It only creates; it never edits or deletes.',
    writes: true,
  },
];
