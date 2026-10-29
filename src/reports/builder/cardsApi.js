import { apiClient, mcpBaseUrl } from '../../config';
import { isRecord, strictDecoders } from '../../decoding';

/*
 * The MCP server's two browser routes for Report Builder Cards
 * (crf04/statsplus#382, docs/contracts/report-builder-cards.md in the
 * coordination repository). The server draws every Card (ADR 0006): a
 * preview returns the canonical call and the Card, and a publish reruns each
 * call as the signed-in user. apiClient attaches the Firebase ID token.
 */

export const CARD_TOOLS = [
  'query_game_logs',
  'get_matchup',
  'get_rotation',
  'get_on_off',
  'get_injuries',
];

// A game-log or on/off call can take 20 s on the server; publishing reruns up to 48 of them.
const PREVIEW_TIMEOUT = 60000;
const PUBLISH_TIMEOUT = 180000;

const invalid = () => new Error('The CourtAI card server returned an invalid response.');
const { requireString } = strictDecoders(invalid);

const decodePreview = (data) => {
  if (!isRecord(data) || !isRecord(data.call) || !isRecord(data.call.args)) throw invalid();
  const tool = requireString(data.call.tool);
  if (!CARD_TOOLS.includes(tool)) throw invalid();
  return {
    call: { tool, args: data.call.args },
    preview: {
      card: requireString(data.card),
      html: requireString(data.html),
      structured: isRecord(data.structured) ? data.structured : {},
      meta: isRecord(data.meta) ? data.meta : null,
    },
  };
};

/*
 * One card request: `{tool, args}`, or `{tool: 'query_game_logs', filter_set}`
 * in the web app's own Filter Set names. Resolves to `{call, preview}`;
 * a refusal rejects with the axios error, read with `cardRefusal`.
 */
export const previewCard = async (request) => {
  const response = await apiClient.post(`${mcpBaseUrl()}/web/cards/preview`, request, {
    timeout: PREVIEW_TIMEOUT,
  });
  return decodePreview(response.data);
};

/* Publishes a Report with Cards; resolves to its id like the backend's publish. */
export const publishCardReport = async (body) => {
  const response = await apiClient.post(`${mcpBaseUrl()}/web/reports`, body, {
    timeout: PUBLISH_TIMEOUT,
  });
  const report = isRecord(response.data) ? response.data.report : null;
  if (!isRecord(report)) throw invalid();
  return { id: requireString(report.id) };
};

/* A choice a needs_choice refusal offers, as the player argument it names. */
const choiceValue = (choice) => {
  if (typeof choice === 'string') return choice;
  if (!isRecord(choice) || typeof choice.name !== 'string') return null;
  return typeof choice.team === 'string' && choice.team
    ? `${choice.name} (${choice.team})`
    : choice.name;
};

export const waitFor = (seconds) => {
  if (seconds < 60) return seconds === 1 ? '1 second' : `${seconds} seconds`;
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) return minutes === 1 ? '1 minute' : `${minutes} minutes`;
  const hours = Math.ceil(minutes / 60);
  return hours === 1 ? '1 hour' : `${hours} hours`;
};

// A Filter Set parameter the server names in `details.field`, as the author knows it.
const FIELDS = {
  player_name: 'player',
  line_type: 'market',
  line: 'line',
  season_filter: 'season',
  game_filter: 'last N games',
  date_filter: 'since date',
  date_to: 'until date',
  minutes_filter: 'minutes range',
  location_filter: 'home or away choice',
  opponent_tricode: 'opponent',
  'players_on[]': 'teammates on the floor',
  'players_off[]': 'teammates off the floor',
  'teams_against[]': 'opponent defense filter',
  'rank_filter[]': 'opponent defense filter',
  playstyle_RTG_min: 'playtype rating',
  playstyle_RTG_max: 'playtype rating',
};
const fieldName = (field) =>
  typeof field === 'string' && field.startsWith('self_filters[') ? 'stat filter' : FIELDS[field];

// Why a picker's choices draw no Card, where the tool says.
const NO_CARD_HINT = { get_rotation: 'Pick a game the team played.' };

/*
 * What each refusal tells the author. The server's own message is written
 * for an AI assistant, so it is never shown.
 */
const REFUSAL_TEXT = {
  call_failed: () => 'CourtAI couldn’t draw this Card. Try again.',
  needs_choice: () => 'More than one player has that name. Pick the one you mean.',
  no_card: ({ tool }) =>
    `No card for those choices. ${NO_CARD_HINT[tool] ?? 'Change one and preview again.'}`,
  unavailable: () => 'That data isn’t available right now. Try again later.',
  invalid_input: ({ details }) => {
    const field = fieldName(details.field);
    return field
      ? `A Card can’t use the ${field} you chose. Change it and preview again.`
      : 'CourtAI can’t use these choices. Change one and try again.';
  },
  rate_limited: ({ retryAfter }) =>
    `You’ve reached your CourtAI limit for now. Try again ${
      retryAfter ? `in ${waitFor(retryAfter)}` : 'later'
    }.`,
  waitlisted: () => 'Your account is still on the CourtAI waitlist, so it can’t use Cards yet.',
  unauthorized: () => 'Your sign-in has expired. Sign in again and try once more.',
  payload_too_large: () => 'That’s too much to send at once. Remove a Card or shorten the text.',
};
const UNKNOWN_REFUSAL = 'That didn’t go through. Try again.';

/*
 * What the server refused, in the contract's
 * `{"error": {"code", "message", "details"}}`: the code, the author-facing
 * text for it, the choices a needs_choice offers and the call a publish rerun
 * names. `tool` is the previewed call's, when there is one. Null when the
 * failure is not such a refusal.
 */
export const cardRefusal = (failure, tool) => {
  const response = failure?.response;
  const error = isRecord(response?.data) ? response.data.error : null;
  if (!isRecord(error) || typeof error.code !== 'string') return null;
  const details = isRecord(error.details) ? error.details : {};
  const retryAfter = Number.parseInt(response.headers?.['retry-after'], 10);
  const text = REFUSAL_TEXT[error.code];
  return {
    code: error.code,
    text: text
      ? text({ tool, details, retryAfter: retryAfter > 0 ? retryAfter : null })
      : UNKNOWN_REFUSAL,
    choices: Array.isArray(details.choices) ? details.choices.map(choiceValue).filter(Boolean) : [],
    call: typeof details.call === 'string' ? details.call : null,
  };
};
