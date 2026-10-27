/*
 * What each part of the Matchup and Targets pages means, in one place so the
 * copy can be read and corrected without hunting through the pages.
 */
export const HELP_TIPS = {
  matchupPage: {
    title: 'Matchups',
    body: [
      'Use the matchups page to identify players to target, click the stat category that you want to see to look at the opponent stats and their matchup relative to league average',
    ],
  },
  matchupRail: {
    title: 'Targetable players',
    body: [
      'Players on the other team with a posted line for this market, highest scorers first.',
      'The number is the line when one is posted, otherwise the Matchup Score. Pick a player to open his card.',
    ],
  },
  matchupWindow: {
    title: 'Window',
    body: [
      'Season reads what this defense has allowed all season. Last 15 reads only its most recent games, so it catches a defense that has changed.',
    ],
  },
  matchupShow: {
    title: 'Show',
    body: [
      'Hides Defense Sheet rows close to the league average. At least 1 sigma keeps the rows one standard deviation or more from average; 2 sigma keeps only the extremes.',
    ],
  },
  defenseSheet: {
    title: 'Defense Sheet',
    body: [
      'How much this defense allows in each row (play types, shot zones, shot types and more) compared with the league average. Green means it allows more than average, red less.',
      'The track is its rank from 1 to 30, where 30 allows the most.',
    ],
  },
  scoreMatrix: {
    title: 'Score Matrix',
    body: [
      'Each cell crosses how this player gets the stat with how much this defense allows of it, against the league average. Positive is more of the stat than usual.',
      'Blend combines the columns. Thin marks a cell with too few games or too little volume to lean on.',
    ],
  },
  targets: {
    title: 'Targets',
    body: [
      'A Target pairs one opponent with Qualifiers, such as OKC vs players above 40% rim share.',
      'When that opponent plays, every player who meets every Qualifier shows as a Fit under Playing tonight.',
    ],
  },
  targetLab: {
    title: 'Backtest',
    body: [
      'Every player who faced this opponent this season and meets every Qualifier, with how they did in those games against their own season averages.',
      'Rules added here, such as a minutes floor, decide which of those games count. It updates as you edit and records past games; it does not predict tonight.',
    ],
  },
  targetGames: {
    title: 'Games',
    body: [
      'Each game in the Backtest, newest first. The mark shows how far the player finished above or below his season average in the stat it is graded on; pick another stat to regrade.',
    ],
  },
};
