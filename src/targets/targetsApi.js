import { apiClient, getApiUrl } from '../config';
import { isCalendarDate } from '../calendarDate';
import { isRecord, strictDecoders } from '../decoding';
import { TARGET_COMPARATORS } from './targetCatalog';

const createInvalidResponseError = () => new Error('The Targets API returned an invalid response.');

const comparators = new Set(TARGET_COMPARATORS.map((entry) => entry.key));

/*
 * A Qualifier is one criterion: a diet slice, a comparator, and a share
 * threshold in the 0–1 range. A player fits a Target only by meeting every one
 * of them, so a Target with no Qualifier cannot exist.
 */
const decodeQualifier = (item) => {
  if (!item || typeof item !== 'object') throw createInvalidResponseError();
  const { base, slice_key: sliceKey, comparator, threshold } = item;
  if (
    typeof base !== 'string' ||
    typeof sliceKey !== 'string' ||
    !comparators.has(comparator) ||
    typeof threshold !== 'number' ||
    !Number.isFinite(threshold) ||
    threshold < 0 ||
    threshold > 1
  ) {
    throw createInvalidResponseError();
  }
  return { base, sliceKey, comparator, threshold };
};

/*
 * The title is derived by the backend and never stored or edited here, so it
 * arrives with the record rather than being rebuilt from it. See
 * crf04/statsplus docs/adr/0001-targets-store-player-criteria-not-team-readings.md.
 */
const decodeDraftTarget = (item) => {
  if (!item || typeof item !== 'object') throw createInvalidResponseError();
  const { opponent, title, note, qualifiers } = item;
  if (
    typeof opponent !== 'string' ||
    typeof title !== 'string' ||
    !Array.isArray(qualifiers) ||
    qualifiers.length === 0 ||
    (note !== null && note !== undefined && typeof note !== 'string')
  ) {
    throw createInvalidResponseError();
  }
  return { opponent, title, note: note || '', qualifiers: qualifiers.map(decodeQualifier) };
};

/*
 * A saved Target is a Draft Target with a record behind it: the id it is
 * opened by and the day it was set.
 */
const decodeTarget = (item) => {
  const draft = decodeDraftTarget(item);
  const { id, created_at: createdAt } = item;
  const hasId = typeof id === 'string' || typeof id === 'number';
  if (!hasId || typeof createdAt !== 'string') throw createInvalidResponseError();
  return { id, ...draft, createdAt };
};

export const decodeTargets = (payload = {}) => {
  if (!payload || !Array.isArray(payload.targets)) throw createInvalidResponseError();
  return payload.targets.map(decodeTarget);
};

/*
 * Resolution reads the same Targets against one Slate Date, so everything
 * below is the day-scoped half of the contract: the game the opponent plays,
 * the opponent's Defense Sheet readings on each Qualifier's slice, and the
 * opposing players who meet every Qualifier.
 *
 * Only what the Slate blocks and the Target detail render is decoded. The
 * response also carries the league aggregate behind each reading, each row's
 * markets, posted markets and injury badge refs; nothing on these two surfaces
 * shows them, and decoding a value no one reads would claim a guarantee no
 * test could make.
 */
const { requireString, requireNumber, requireNumberOrNull } = strictDecoders(
  createInvalidResponseError,
);

/*
 * A side is named by its tricode alone: that is what a Target is written in
 * and what the game chip and the honest-empty lines say.
 */
const decodeSide = (side) => {
  if (!isRecord(side)) throw createInvalidResponseError();
  return { tricode: requireString(side.tricode) };
};

const decodeGame = (game) => {
  if (game === null) return null;
  if (!isRecord(game) || !isRecord(game.status)) throw createInvalidResponseError();
  const scheduledAt = new Date(requireString(game.scheduled_at));
  if (Number.isNaN(scheduledAt.getTime())) throw createInvalidResponseError();
  return {
    gameId: requireString(game.game_id),
    scheduledAt: scheduledAt.toISOString(),
    status: { state: requireString(game.status.state), label: requireString(game.status.label) },
    // Which side is at home is the game's own fact, and is what lets a Target
    // name the game the way the Slate row does. Which side the Target is
    // about, and which one it filters, is the Target's.
    away: decodeSide(game.away),
    home: decodeSide(game.home),
    opponent: decodeSide(game.opponent),
    opposingTeam: decodeSide(game.opposing_team),
  };
};

/*
 * The pool status is what keeps an empty list from being read as "nobody
 * fits". `source` names the evidence that listed the participants, and is
 * null only when there is no game to have listed any.
 */
const POOL_SOURCES = [null, 'player_pool', 'game_logs'];

const decodePoolAvailability = (availability) => {
  if (
    !isRecord(availability) ||
    !['available', 'unavailable'].includes(availability.status) ||
    !POOL_SOURCES.includes(availability.source ?? null)
  ) {
    throw createInvalidResponseError();
  }
  return {
    status: availability.status,
    source: availability.source ?? null,
    unavailableReason:
      typeof availability.unavailable_reason === 'string' ? availability.unavailable_reason : null,
  };
};

const decodeWindowAvailability = (availability) => {
  if (
    !isRecord(availability) ||
    !['available', 'unavailable', 'missing'].includes(availability.status)
  ) {
    throw createInvalidResponseError();
  }
  return { status: availability.status };
};

/*
 * One window of one Defense Sheet row, read the way the Matchup reads it: a
 * window carries a value exactly when its Base and window are available, so a
 * value arriving under an unavailable window is a response we cannot trust.
 */
const decodeReading = (value, availability) => {
  if (availability.status !== 'available') {
    if (value !== null) throw createInvalidResponseError();
    return null;
  }
  if (!isRecord(value)) throw createInvalidResponseError();
  return {
    allowedPer48: requireNumber(value.allowed_per_48),
    percentVsLeagueAverage: requireNumberOrNull(value.percent_vs_league_average),
    sigmaDeviation: requireNumber(value.sigma_deviation),
    rank: requireNumber(value.rank),
  };
};

const decodeContext = (item) => {
  if (!isRecord(item) || !isRecord(item.availability) || !Array.isArray(item.metrics)) {
    throw createInvalidResponseError();
  }
  const availability = {
    season: decodeWindowAvailability(item.availability.season),
    last15: decodeWindowAvailability(item.availability.last_15),
  };
  return {
    // The label is the backend's own slice wording, so a Qualifier written
    // against a slice this build has no label for still reads as itself.
    label: requireString(item.label),
    metrics: item.metrics.map((metric) => {
      if (!isRecord(metric) || !isRecord(metric.opponent)) throw createInvalidResponseError();
      return {
        key: requireString(metric.key),
        label: requireString(metric.label),
        season: decodeReading(metric.opponent.season, availability.season),
        last15: decodeReading(metric.opponent.last_15, availability.last15),
      };
    }),
  };
};

const decodeShare = (share) => {
  if (!isRecord(share)) throw createInvalidResponseError();
  return {
    share: requireNumber(share.share),
    leagueAverageShare: requireNumberOrNull(share.league_average_share),
  };
};

/*
 * A fit's shares are index-parallel with the Qualifiers, which is what lets
 * the table put one column per Qualifier. A list of another length would
 * silently misattribute a share to the wrong Qualifier.
 */
const decodeFit = (player, qualifierCount) => {
  if (
    !isRecord(player) ||
    typeof player.thin !== 'boolean' ||
    !Array.isArray(player.shares) ||
    player.shares.length !== qualifierCount
  ) {
    throw createInvalidResponseError();
  }
  return {
    canonicalId: requireNumber(player.canonical_id),
    name: requireString(player.name),
    tricode: requireString(player.tricode),
    seasonScoring: requireNumberOrNull(player.season_scoring),
    thin: player.thin,
    shares: player.shares.map(decodeShare),
  };
};

const decodeResolvedTarget = (item) => {
  if (!isRecord(item) || !Array.isArray(item.context) || !Array.isArray(item.players)) {
    throw createInvalidResponseError();
  }
  const target = decodeTarget(item.target);
  const game = decodeGame(item.game);
  const availability = decodePoolAvailability(item.availability);
  // An idle Target has no game-scoped window to read, so it carries no
  // context; a live one carries one per Qualifier, in Qualifier order.
  if (item.context.length !== (game ? target.qualifiers.length : 0)) {
    throw createInvalidResponseError();
  }
  if (availability.status !== 'available' && item.players.length > 0) {
    throw createInvalidResponseError();
  }
  return {
    target,
    game,
    availability,
    context: item.context.map(decodeContext),
    players: item.players.map((player) => decodeFit(player, target.qualifiers.length)),
  };
};

/*
 * Live Targets first, then idle, each group newest-first: the order is the
 * backend's and is preserved rather than re-sorted here.
 */
export const decodeResolvedTargets = (payload = {}) => {
  if (!isRecord(payload) || !isCalendarDate(payload.slate_date) || !Array.isArray(payload.targets))
    throw createInvalidResponseError();
  return {
    slateDate: payload.slate_date,
    entries: payload.targets.map(decodeResolvedTarget),
  };
};

/*
 * The season-to-date backtest is a third read over the same Target: every
 * player league-wide whose diet meets the Qualifiers, and their games against
 * the opponent. Its columns are outcome markets the Matchup already maps to
 * the Qualifiers' slices, so every stat a row shows is named by
 * `stat_columns` and nothing else is read out of a game.
 *
 * The season label, the team id, the game id, the minutes and the matchup
 * string arrive too and are shown nowhere, so they are not decoded.
 */
const decodeStats = (stats, statColumns) => {
  if (!isRecord(stats)) throw createInvalidResponseError();
  return Object.fromEntries(statColumns.map((column) => [column, requireNumber(stats[column])]));
};

const decodeBacktestGame = (game, statColumns) => {
  if (!isRecord(game) || !isCalendarDate(game.game_date)) throw createInvalidResponseError();
  return { gameDate: game.game_date, stats: decodeStats(game.stats, statColumns) };
};

/*
 * A player is in the backtest because they have faced the opponent, so one
 * with no game is a response whose table would quietly drop a row. The shares
 * are index-parallel with the Qualifiers, as a fit's are.
 */
const decodeBacktestPlayer = (player, statColumns, qualifierCount) => {
  if (
    !isRecord(player) ||
    !Array.isArray(player.games) ||
    player.games.length === 0 ||
    !Array.isArray(player.shares) ||
    player.shares.length !== qualifierCount
  ) {
    throw createInvalidResponseError();
  }
  return {
    canonicalId: requireNumber(player.canonical_id),
    name: requireString(player.name),
    tricode: requireString(player.tricode),
    shares: player.shares.map(decodeShare),
    seasonAverages: decodeStats(player.season_averages, statColumns),
    games: player.games.map((game) => decodeBacktestGame(game, statColumns)),
  };
};

/*
 * The summary is the backend's arithmetic over every listed game, in the same
 * columns as the table: the mean signed difference from the player's season
 * average, and the share of games at or above it. A column with no game to
 * average has no figure, which is null rather than zero.
 */
const decodeSummaryColumn = (column) => {
  if (!isRecord(column)) throw createInvalidResponseError();
  const overAverageShare = requireNumberOrNull(column.over_average_share);
  if (overAverageShare !== null && (overAverageShare < 0 || overAverageShare > 1)) {
    throw createInvalidResponseError();
  }
  return { meanDifference: requireNumberOrNull(column.mean_difference), overAverageShare };
};

const decodeSummary = (summary, statColumns) => {
  if (!isRecord(summary) || !isRecord(summary.columns)) throw createInvalidResponseError();
  return {
    players: requireNumber(summary.players),
    games: requireNumber(summary.games),
    columns: Object.fromEntries(
      statColumns.map((column) => [column, decodeSummaryColumn(summary.columns[column])]),
    ),
  };
};

/*
 * Everything a backtest carries besides the Target it was run for. The saved
 * read and the Draft Target preview share it, which is what makes the Lab show
 * exactly what the detail will show after saving.
 */
const decodeBacktestBody = (payload, target) => {
  if (
    !isRecord(payload) ||
    !Array.isArray(payload.stat_columns) ||
    payload.stat_columns.length === 0 ||
    !Array.isArray(payload.players)
  ) {
    throw createInvalidResponseError();
  }
  const statColumns = payload.stat_columns.map(requireString);
  return {
    target,
    proxy: requireString(payload.proxy),
    statColumns,
    summary: decodeSummary(payload.summary, statColumns),
    players: payload.players.map((player) =>
      decodeBacktestPlayer(player, statColumns, target.qualifiers.length),
    ),
  };
};

export const decodeBacktest = (payload = {}) => {
  if (!isRecord(payload)) throw createInvalidResponseError();
  // The Target travels with its own backtest, so the rows are labelled by the
  // Qualifiers the backend actually ran rather than by whatever the page
  // happens to be holding.
  return decodeBacktestBody(payload, decodeTarget(payload.target));
};

/*
 * Whether the draft fires on the current Slate date: null when the opponent
 * is idle, else the game and how many opposing players meet every Qualifier
 * by the resolve rule. A game without a count, or a count without a game, is
 * half an answer.
 */
const decodeToday = (today) => {
  if (today === null) return null;
  if (!isRecord(today)) throw createInvalidResponseError();
  const game = decodeGame(today.game);
  if (game === null) throw createInvalidResponseError();
  return { game, fitCount: requireNumber(today.fit_count) };
};

/*
 * The preview is the backtest of a Draft Target: the same shape, with the
 * validated draft echoed back in place of a stored record, plus `today`.
 */
export const decodePreview = (payload = {}) => {
  if (!isRecord(payload) || payload.today === undefined) throw createInvalidResponseError();
  return {
    ...decodeBacktestBody(payload, decodeDraftTarget(payload.target)),
    today: decodeToday(payload.today),
  };
};

const encodeQualifier = (qualifier) => ({
  base: qualifier.base,
  slice_key: qualifier.sliceKey,
  comparator: qualifier.comparator,
  threshold: qualifier.threshold,
});

const targetsUrl = (path = '') => `${getApiUrl('TARGETS')}${path}`;

export const fetchTargets = async ({ signal } = {}) => {
  const response = await apiClient.get(targetsUrl(), { signal });
  return decodeTargets(response.data);
};

/*
 * An absent date is the Slate's own current date rather than one this page
 * computes, so the Slate and a Target detail opened from it always agree
 * about which day they are showing.
 */
export const fetchResolvedTargets = async ({ date, signal } = {}) => {
  const response = await apiClient.get(targetsUrl('/resolve'), {
    params: date ? { date } : {},
    signal,
  });
  return decodeResolvedTargets(response.data);
};

/*
 * The league-wide game-log scan the day view exists to avoid, so it is only
 * ever requested by a reader who asked for it.
 */
export const fetchTargetBacktest = async ({ id, signal } = {}) => {
  const response = await apiClient.get(targetsUrl(`/${encodeURIComponent(id)}/backtest`), {
    signal,
  });
  return decodeBacktest(response.data);
};

/*
 * The same scan for a Target that is not saved: the create body goes up and
 * the backtest comes back, with nothing stored. The Lab asks for this after
 * every settled edit, so the read is abortable by the edit after it.
 */
export const fetchTargetPreview = async ({ opponent, qualifiers, note, signal } = {}) => {
  const response = await apiClient.post(
    getApiUrl('TARGET_PREVIEW'),
    { opponent, qualifiers: qualifiers.map(encodeQualifier), note },
    { signal },
  );
  return decodePreview(response.data);
};

/*
 * Create answers with the stored Target and the rest report success or throw.
 * Either way the list caller reloads rather than patching one in place, so the
 * order and the derived titles shown are always the backend's.
 *
 * What create returns is the record as stored, carrying the title the backend
 * derived. A surface that confirms a save by name has to say that title rather
 * than a locally guessed one. See crf04/statsplus
 * docs/adr/0001-targets-store-player-criteria-not-team-readings.md.
 */
export const createTarget = async ({ opponent, qualifiers, note }) => {
  const response = await apiClient.post(targetsUrl(), {
    opponent,
    qualifiers: qualifiers.map(encodeQualifier),
    note,
  });
  return decodeTarget(response.data?.target);
};

/*
 * Only the Qualifiers and the note are editable. The opponent is what the
 * Target is about, so changing it would make a different Target.
 */
export const updateTarget = async ({ id, qualifiers, note }) => {
  await apiClient.patch(targetsUrl(`/${encodeURIComponent(id)}`), {
    qualifiers: qualifiers.map(encodeQualifier),
    note,
  });
};

export const deleteTarget = async ({ id }) => {
  await apiClient.delete(targetsUrl(`/${encodeURIComponent(id)}`));
};

export const decodeDietBaselines = (payload) => {
  if (!isRecord(payload) || !isRecord(payload.shares)) throw createInvalidResponseError();
  const shares = {};
  for (const [base, slices] of Object.entries(payload.shares)) {
    if (!isRecord(slices)) throw createInvalidResponseError();
    shares[base] = {};
    for (const [slice, share] of Object.entries(slices)) {
      if (
        share !== null &&
        (typeof share !== 'number' || !Number.isFinite(share) || share < 0 || share > 1)
      )
        throw createInvalidResponseError();
      shares[base][slice] = share;
    }
  }
  return { shares };
};

export const fetchDietBaselines = async ({ signal } = {}) => {
  const response = await apiClient.get(getApiUrl('DIET_BASELINES'), { signal });
  return decodeDietBaselines(response.data);
};
