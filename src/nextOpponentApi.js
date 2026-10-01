import { apiClient, getApiUrl } from './config';

export const decodeNextOpponent = (payload) => {
  if (!payload || !Array.isArray(payload.opponent_ranks)) {
    throw new Error('The next opponent API returned an invalid response.');
  }
  const game = payload.next_game;
  if (
    game !== null &&
    (!game ||
      typeof game.opponent !== 'string' ||
      typeof game.date !== 'string' ||
      typeof game.home !== 'boolean')
  ) {
    throw new Error('The next opponent API returned an invalid game.');
  }
  for (const stat of payload.opponent_ranks) {
    if (
      !stat ||
      !Number.isFinite(stat.value) ||
      !Number.isInteger(stat.most_rank) ||
      !Number.isInteger(stat.ranked_teams) ||
      stat.most_rank < 1 ||
      stat.most_rank > stat.ranked_teams ||
      typeof stat.group !== 'string' ||
      typeof stat.label !== 'string' ||
      !['count', 'percent', 'league_ratio'].includes(stat.unit) ||
      (stat.team_filter !== null && typeof stat.team_filter !== 'string') ||
      (stat.vs_league_pct !== null && !Number.isFinite(stat.vs_league_pct))
    ) {
      throw new Error('The next opponent API returned an invalid rank.');
    }
  }
  return payload;
};

export const fetchNextOpponent = async (playerName, { signal } = {}) => {
  const { data } = await apiClient.get(getApiUrl('NEXT_OPPONENT'), {
    params: { player_name: playerName },
    signal,
  });
  return decodeNextOpponent(data);
};
