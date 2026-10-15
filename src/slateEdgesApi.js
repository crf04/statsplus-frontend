import { apiClient, getApiUrl } from './config';
import { isCalendarDate } from './calendarDate';
import { isRecord, strictDecoders } from './decoding';

/*
 * Slate Edges (crf04/statsplus#204): one read for the home page in place of a
 * Matchup per game. Each game carries its three biggest season PTS Matchup
 * effects and every player's PTS score; the spotlight names the slate's most
 * and least favourable points Matchup and the one play-type slice behind it.
 * The backend composes it from the same Slate and Matchup documents those
 * pages serve, so the home page and a Matchup cannot disagree.
 */
const createInvalidEdgesError = () =>
  new Error('The slate edges endpoint returned an invalid response.');

const { requireString, requireNumber } = strictDecoders(createInvalidEdgesError);

const requireBoolean = (value) => {
  if (typeof value !== 'boolean') throw createInvalidEdgesError();
  return value;
};

const decodeEffect = (effect) => {
  if (!isRecord(effect)) throw createInvalidEdgesError();
  return {
    canonicalId: requireNumber(effect.canonical_id),
    name: requireString(effect.name),
    tricode: requireString(effect.tricode),
    seasonScoring: requireNumber(effect.season_scoring),
    value: requireNumber(effect.value),
    thin: requireBoolean(effect.thin),
  };
};

const decodeScore = (score) => {
  if (!isRecord(score)) throw createInvalidEdgesError();
  return [requireNumber(score.canonical_id), requireNumber(score.value)];
};

// The contract's bounds, refused rather than rendered: a rank outside 1-30
// would read as "the 0th most".
const MAX_EFFECTS = 3;
const requireRank = (value) => {
  if (!Number.isInteger(value) || value < 1 || value > 30) throw createInvalidEdgesError();
  return value;
};
const requireShare = (value) => {
  if (requireNumber(value) < 0 || value > 1) throw createInvalidEdgesError();
  return value;
};

const decodeGame = (game) => {
  if (
    !isRecord(game) ||
    !Array.isArray(game.effects) ||
    game.effects.length > MAX_EFFECTS ||
    !Array.isArray(game.scores)
  ) {
    throw createInvalidEdgesError();
  }
  return {
    gameId: requireString(game.game_id),
    effects: game.effects.map(decodeEffect),
    // Keyed by canonical id: a Target's fit is looked up by the same id.
    scores: new Map(game.scores.map(decodeScore)),
  };
};

const decodeReason = (reason) => {
  if (!isRecord(reason)) throw createInvalidEdgesError();
  return {
    base: requireString(reason.base),
    sliceKey: requireString(reason.slice_key),
    share: requireShare(reason.share),
    leagueAverageShare: requireShare(reason.league_average_share),
    // 30 allows the most of the slice, 1 the fewest.
    opponentRank: requireRank(reason.opponent_rank),
    opponentPercentVsLeague: requireNumber(reason.opponent_percent_vs_league),
  };
};

const decodePick = (pick) => {
  if (pick === null) return null;
  if (!isRecord(pick)) throw createInvalidEdgesError();
  return {
    gameId: requireString(pick.game_id),
    canonicalId: requireNumber(pick.canonical_id),
    name: requireString(pick.name),
    tricode: requireString(pick.tricode),
    opponent: requireString(pick.opponent),
    seasonScoring: requireNumber(pick.season_scoring),
    value: requireNumber(pick.value),
    reason: decodeReason(pick.reason),
  };
};

export const decodeSlateEdges = (payload) => {
  if (
    !isRecord(payload) ||
    !isCalendarDate(payload.slate_date) ||
    !Array.isArray(payload.games) ||
    !isRecord(payload.spotlight) ||
    !('best' in payload.spotlight) ||
    !('toughest' in payload.spotlight)
  ) {
    throw createInvalidEdgesError();
  }
  const best = decodePick(payload.spotlight.best);
  const toughest = decodePick(payload.spotlight.toughest);
  // A pick's sign is its whole meaning: a "best" that hurts is half an answer.
  if ((best && best.value <= 0) || (toughest && toughest.value >= 0)) {
    throw createInvalidEdgesError();
  }
  return {
    slateDate: payload.slate_date,
    games: payload.games.map(decodeGame),
    spotlight: { best, toughest },
  };
};

/*
 * One slate date's edges (the current one when no date is named), or null when the backend does not serve the
 * route yet (404): the home page then shows no ticker or Tonight row rather
 * than an error.
 */
export const fetchSlateEdges = async ({ date, signal } = {}) => {
  try {
    const response = await apiClient.get(getApiUrl('SLATE_EDGES'), {
      params: date ? { date } : {},
      signal,
    });
    return decodeSlateEdges(response.data);
  } catch (error) {
    if (error?.response?.status === 404) return null;
    throw error;
  }
};
