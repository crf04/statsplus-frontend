// One open-ended research brief, every call made for it in order, and the
// report. Every figure is a production connector answer captured 2026-10-19 and
// re-checked 2026-10-20, for the March 20, 2026 Slate (a past game day).

export const RESEARCH_BRIEF = [
  { part: 'Question', text: 'Research the March 20, 2026 slate for me.' },
  { part: 'Method', text: 'Start wide, then test every lead against past games.' },
  { part: 'Bar', text: "Drop anything that doesn't hold up or rests on a thin sample." },
  {
    part: 'Report',
    text: 'Tell me what survived, with the evidence, and what you dropped and why.',
  },
];

export const RESEARCH_PROMPT = RESEARCH_BRIEF.map((piece) => piece.text).join(' ');

// verdict: 'lead' opens a lead, 'kept' / 'mixed' / 'dropped' settles one.
export const RESEARCH_PHASES = [
  {
    phase: 'Survey',
    note: 'Map the night before picking anything.',
    calls: [
      {
        tool: 'Slate',
        args: '2026-03-20',
        found:
          '6 games. Boston at Memphis holds 8 of the top 10 points Matchups; Karl-Anthony Towns has a soft rim matchup in Brooklyn.',
        verdict: 'lead',
      },
      {
        tool: 'Injury report',
        args: '2026-03-20',
        found:
          '70 players listed. Cade Cunningham and Anthony Edwards are Out; so is Boston’s Nikola Vučević.',
        verdict: 'lead',
      },
      {
        tool: 'Injury Scenarios',
        args: '2026-03-20, then POR @ MIN',
        calls: 2,
        found: '44 flagged teammate spots. The strongest: Daniss Jenkins’ assists with Cade out.',
        verdict: 'lead',
      },
    ],
  },
  {
    phase: 'Test',
    note: 'Check each lead against past games, and look for a reason it might be wrong.',
    calls: [
      {
        tool: 'Game logs',
        args: 'Towns, vs the 10 softest rim defenses',
        found:
          '22.2 points in 21 games against 20.0 for his season, over his 18.5 line in 16 of 21.',
        verdict: 'kept',
      },
      {
        tool: 'Game logs',
        args: 'Queta, vs the 10 softest rim defenses',
        found: '12.0 points in 25 games against 9.9, but over his 10.5 line in only 12 of 25.',
        verdict: 'mixed',
      },
      {
        tool: 'Game logs',
        args: 'Queta, without Vučević',
        found:
          'He played without Vučević in 54 of his 65 games, at 9.9 points. The absence changes nothing.',
        verdict: 'dropped',
      },
      {
        tool: 'Backtest',
        args: 'MEM, pull-ups ≥ 40% of shots',
        found:
          '48 players, 99 games: +0.9 points against their own average, above it in 52%. Boston’s guards have 1 or 2 games each.',
        verdict: 'dropped',
      },
      {
        tool: 'Matchup',
        args: 'Jenkins, assists, GSW @ DET',
        found:
          'Assists Matchup +2% vs league. Golden State is middling on his main slice (9th in rim assists allowed), so the case rests on the role change.',
        verdict: 'kept',
      },
    ],
  },
];

export const RESEARCH_REPORT = [
  {
    verdict: 'kept',
    title: 'Karl-Anthony Towns, points',
    body: 'Brooklyn gives up rim makes, and against the 10 softest rim defenses he averaged 22.2 points over 21 games, beating his 18.5 line in 16 of them.',
  },
  {
    verdict: 'kept',
    title: 'Daniss Jenkins, assists',
    body: 'In the 18 games Cade missed he started 16 and averaged 7.9 assists against 2.5 with him; the on/off split agrees (7.5 per 36 against 4.1).',
  },
  {
    verdict: 'mixed',
    title: 'Neemias Queta, points',
    body: 'Up 2.1 points against soft rim defenses over 25 games, but he cleared his line in only 12 of them. A real edge in the averages, but the line record is even.',
  },
  {
    verdict: 'dropped',
    title: 'Queta gains from Vučević sitting',
    body: 'Vučević played only 11 of Queta’s games, so “without him” is Queta’s normal role.',
  },
  {
    verdict: 'dropped',
    title: 'Boston’s pull-up guards vs Memphis',
    body: 'The type barely beat its own average (52% of games), and each guard has one or two games against Memphis.',
  },
];
