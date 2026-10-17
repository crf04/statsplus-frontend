/*
 * Why a Defense Sheet window is withheld, in words. The Matchup page and the
 * Targets fits read the same backend reasons, so they read the same sentences.
 * A code absent here is shown as the backend sent it.
 */
const LAST_15_NOT_OPEN =
  'Last 15 has not opened yet; it opens once every team has played 15 games.';

export const WINDOW_REASONS = {
  insufficient_governed_games: LAST_15_NOT_OPEN,
  window_not_ready: LAST_15_NOT_OPEN,
  publication_inactive: 'Not published yet.',
};
