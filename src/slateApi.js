import { apiClient, getApiUrl } from './config';

const invalidSlate = () => new Error('The slate endpoint returned an invalid response.');

const decodeTeam = (team) => {
  if (
    !team ||
    !Number.isInteger(team.team_id) ||
    typeof team.tricode !== 'string' ||
    typeof team.name !== 'string' ||
    !Number.isInteger(team.targetable_player_count)
  ) {
    throw invalidSlate();
  }

  return {
    teamId: team.team_id,
    tricode: team.tricode,
    name: team.name,
    targetablePlayerCount: team.targetable_player_count,
  };
};

const decodeGame = (game) => {
  if (
    !game ||
    typeof game.game_id !== 'string' ||
    typeof game.scheduled_at !== 'string' ||
    !game.status ||
    !['scheduled', 'postponed', 'final'].includes(game.status.state) ||
    typeof game.status.label !== 'string' ||
    typeof game.preseason !== 'boolean'
  ) {
    throw invalidSlate();
  }

  const scheduledAt = new Date(game.scheduled_at);
  if (Number.isNaN(scheduledAt.getTime())) throw invalidSlate();

  return {
    gameId: game.game_id,
    away: decodeTeam(game.away_team),
    home: decodeTeam(game.home_team),
    scheduledAt: scheduledAt.toISOString(),
    status: game.status.state,
    statusLabel: game.status.label,
    classification: typeof game.classification === 'string' ? game.classification : null,
    preseason: game.preseason,
    targetableCounts: {
      away: game.away_team.targetable_player_count,
      home: game.home_team.targetable_player_count,
    },
  };
};

export const decodeSlate = (data) => {
  if (
    !data ||
    typeof data.slate_date !== 'string' ||
    !Array.isArray(data.games) ||
    !data.freshness ||
    typeof data.freshness !== 'object'
  ) {
    throw invalidSlate();
  }

  return {
    slateDate: data.slate_date,
    freshness: data.freshness,
    poolStatus: typeof data.pool_status === 'string' ? data.pool_status : null,
    games: data.games.map(decodeGame),
  };
};

export const fetchSlate = async (date, { signal } = {}) => {
  const response = await apiClient.get(getApiUrl('SLATE'), {
    params: date ? { date } : {},
    signal,
  });
  return decodeSlate(response.data);
};
