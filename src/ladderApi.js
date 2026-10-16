import { apiClient, getApiUrl } from './config';
import { isRecord, strictDecoders } from './decoding';
import { QUERY_LADDER } from './help/queryHelp';

/*
 * The query ladder's answers (crf04/statsplus#211): one anonymous read in
 * place of a Game Logs request per rung. The backend owns the three Filter
 * Sets and computes each the way the Log Workspace does, so a rung's answer is
 * the one it opens. `points` is null for a rung that kept no games.
 */
const createInvalidLadderError = () =>
  new Error('The ladder endpoint returned an invalid response.');

const { requireNumber, requireNumberOrNull } = strictDecoders(createInvalidLadderError);

const decodeRung = (rung, id) => {
  if (!isRecord(rung) || rung.id !== id || !Array.isArray(rung.series)) {
    throw createInvalidLadderError();
  }
  const games = requireNumber(rung.games);
  if (!Number.isInteger(games) || games < 0) throw createInvalidLadderError();
  return {
    points: requireNumberOrNull(rung.points),
    games,
    series: rung.series.map(requireNumber),
  };
};

// One answer per QUERY_LADDER rung, in rung order; null unless every rung has
// points, because half a ladder reads as a broken one.
export const decodeLadder = (payload) => {
  if (!isRecord(payload) || !Array.isArray(payload.rungs)) throw createInvalidLadderError();
  if (payload.rungs.length !== QUERY_LADDER.length) throw createInvalidLadderError();
  const rungs = QUERY_LADDER.map((step, index) => decodeRung(payload.rungs[index], step.id));
  return rungs.every((rung) => rung.points !== null) ? rungs : null;
};

export const fetchLadder = async ({ signal } = {}) => {
  const response = await apiClient.get(getApiUrl('LADDER'), { signal });
  return decodeLadder(response.data);
};
