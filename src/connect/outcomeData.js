// Each run is one outcome prompt, the calls the model chose for it, and the
// answer it gave. Every figure is a production connector answer captured
// 2026-10-19 and re-checked 2026-10-20 (completed 2025-26 season; past dates,
// so the figures stay fixed).

// The parts of an outcome prompt, then the first example prompt split into
// plain text and marked parts (index into ANATOMY).
export const ANATOMY = [
  { part: 'Goal', hint: 'What you want to know' },
  { part: 'Scope', hint: 'The game, date, team or player' },
  { part: 'Proof', hint: 'What counts as evidence' },
  { part: 'Shape', hint: 'What to hand back' },
];

export const ANATOMY_SENTENCE = [
  'Scout ',
  [1, 'DET @ CHA on April 10, 2026'],
  '. ',
  [0, 'Tell me where Detroit has an edge'],
  ', ',
  [2, 'check whether it held up in past games'],
  ', and give me ',
  [3, 'one paragraph with the sample sizes'],
  '.',
];

export const OUTCOMES = [
  {
    id: 'injuries',
    label: 'Scan the injury report',
    prompt:
      'Scan the March 20, 2026 injury report and tell me who benefits if the key players sit. Give me the three strongest spots, with the evidence and sample sizes for each.',
    note: 'Leave the date out to scan today’s report, which is stored from 11:00 ET on game days.',
    calls: [
      {
        tool: 'Injury report',
        args: '2026-03-20',
        why: 'See who is listed and how many minutes each one usually plays.',
        got: '70 players across 6 games. The biggest absences: Anthony Edwards (35.0 min), Cade Cunningham (33.9), Michael Porter Jr. (32.5).',
      },
      {
        tool: 'Injury Scenarios',
        args: '2026-03-20, every game',
        why: 'Score every teammate of every Out, Doubtful or Questionable player in one pass.',
        got: '44 flagged spots: 27 in GSW @ DET, all from Cade sitting, and 17 in POR @ MIN, whose detail was cut for size.',
      },
      {
        tool: 'Injury Scenarios',
        args: 'POR @ MIN',
        why: 'The first answer said to call again for that game, so it did.',
        got: 'All 17 come from Edwards sitting. Naz Reid is also Out, so his spots are dropped.',
      },
      {
        tool: 'Matchup',
        args: 'Daniss Jenkins, assists, GSW @ DET',
        why: "Check the night's opponent for the strongest spot.",
        got: 'Assists Matchup +2% vs league against Golden State.',
      },
    ],
    answer: (
      <>
        Three spots, strongest first:
        <ul className="oc-spots">
          <li>
            <strong>Daniss Jenkins, assists</strong> (Cade out). In the 18 games Cade missed he
            started 16, played 34.0 minutes and averaged 7.9 assists, against 2.5 with him. Per 36
            with Cade off the floor: 7.5 against 4.1, over 1,164 minutes.
          </li>
          <li>
            <strong>Bones Hyland, PRA</strong> (Edwards out). 20.4 minutes against 12.3, and 17.2
            PRA in 20 games against 11.3.
          </li>
          <li>
            <strong>Caris LeVert, assists</strong> (Cade out). 3.7 in 15 games against 2.3, and 6.1
            per 36 against 3.2.
          </li>
        </ul>
        Each spot moved at least 10% in both samples: the games the star missed and the minutes he
        sat. Minnesota&apos;s on/off split is a stale cached copy.
      </>
    ),
  },
  {
    id: 'scout',
    label: 'Scout a game',
    prompt:
      'Scout DET @ CHA on April 10, 2026. Tell me where Detroit has an edge, check whether it held up in past games, and give me one paragraph with the sample sizes.',
    calls: [
      {
        tool: 'Matchup',
        args: 'DET @ CHA, 2026-04-10',
        why: "Start with both teams' top scores and the spots Charlotte defends worst.",
        got: 'Charlotte ranks 26th against pick-and-roll ball handlers (+12% vs league), one of its three softest spots.',
      },
      {
        tool: 'Injury report',
        args: 'DET, 2026-04-10',
        why: 'Make sure nobody who matters is out before reading roles.',
        got: 'Only two two-way players are Out. Kevin Huerter is listed Available.',
      },
      {
        tool: 'Matchup',
        args: 'Cade Cunningham',
        why: "Confirm the edge is his, and get the driver's row to pass on.",
        got: '37% of his plays are pick-and-roll ball handler. Points Matchup +0.4% vs league.',
      },
      {
        tool: 'Game logs',
        args: 'row: PnR ball handler, ranks 21–30, before 2026-04-10',
        why: 'Pass that row so the past games are ranked on the same metric.',
        got: '21 games against the 10 softest PnR defenses: 26.1 points vs 24.4 for his season.',
      },
    ],
    answer: (
      <>
        Detroit&apos;s edge runs through Cade&apos;s pick-and-roll: it is 37% of his plays and
        Charlotte ranks <strong>26th</strong> against it. In <strong>21 games</strong> against the
        10 softest pick-and-roll defenses he averaged <strong>26.1 points</strong>, against 24.4 for
        the season, and beat his DraftKings closing line in 11 of 21, close to even. Detroit had no
        rotation player out.
      </>
    ),
  },
  {
    id: 'absence',
    label: 'Plan around an absence',
    prompt:
      'Cade Cunningham is out. Tell me whose role changes on Detroit and whether it showed up in the games he missed last season.',
    calls: [
      {
        tool: 'Rotation',
        args: 'DET, without Cade, 2025-26',
        why: 'Find who started and whose minutes moved in the games he missed.',
        got: 'Daniss Jenkins started 16 of 18 and played 34.0 minutes, up from 13.3.',
      },
      {
        tool: 'On/off',
        args: 'DET, Cade off the floor',
        why: 'Check whether the role changed, not just the minutes.',
        got: 'Jenkins’ usage 22.5% over 1,164 minutes, against 16.6% beside Cade.',
      },
      {
        tool: 'Game logs',
        args: 'Daniss Jenkins, without Cade',
        why: 'See whether the bigger role showed up in his box scores.',
        got: '17.3 points and 7.9 assists over 18 games, against 9.3 and 3.9 for his season.',
      },
    ],
    answer: (
      <>
        Daniss Jenkins takes Cade&apos;s job. In the <strong>18 games</strong> Cade missed, Jenkins
        started 16 and played <strong>34.0 minutes</strong> (13.3 otherwise). With Cade off the
        floor his usage rose to <strong>22.5%</strong> from 16.6%, and in those games he averaged{' '}
        <strong>17.3 points and 7.9 assists</strong>, against 9.3 and 3.9 for the season.
      </>
    ),
  },
  {
    id: 'type',
    label: 'Find a type of player',
    prompt:
      'Find the kind of player Washington struggles with on April 10, 2026, tell me who on Miami fits, and show me it held up.',
    calls: [
      {
        tool: 'Matchup',
        args: 'MIA @ WAS, 2026-04-10',
        why: "Read Washington's softest spots and who it has out.",
        got: 'Washington ranks 30th in restricted-area makes allowed (+25% vs league), with 9 players Out.',
      },
      {
        tool: 'Backtest',
        args: 'WAS, Restricted area ≥ 40%',
        why: 'Test the type: players who take 40% or more of their shots at the rim.',
        got: '101 players over 201 games: +1.4 points vs their own average, above it in 53%.',
      },
      {
        tool: 'Slate',
        args: '2026-04-10',
        why: 'Find who on Miami fits that type that night.',
        got: "Kel'el Ware: 48% of his shots in the restricted area, the Slate's top points Matchup (+11%).",
      },
      {
        tool: 'Game logs',
        args: "Kel'el Ware, row: Restricted area, ranks 21–30",
        why: 'Check the fit held up against the softest rim defenses.',
        got: '26 games: 13.8 points vs 11.0 for his season.',
      },
    ],
    answer: (
      <>
        Bigs who live at the rim. Washington ranks <strong>30th</strong> in restricted-area makes
        allowed, and players taking 40% or more of their shots there scored{' '}
        <strong>+1.4 points</strong> over their own average against it (201 games, above average in
        53%). On Miami that is <strong>Kel&apos;el Ware</strong>: 48% of his shots, and{' '}
        <strong>13.8 points</strong> in 26 games against the 10 softest rim defenses, against 11.0
        for the season.
      </>
    ),
  },
];
