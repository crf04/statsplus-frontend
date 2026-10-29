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

/*
 * What the server refused, in the contract's
 * `{"error": {"code", "message", "details"}}`: the code, its message, the
 * choices a needs_choice offers, the call a publish rerun names, and the
 * seconds a rate limit asks to wait. Null when the failure is not such a refusal.
 */
export const cardRefusal = (failure) => {
  const response = failure?.response;
  const error = isRecord(response?.data) ? response.data.error : null;
  if (!isRecord(error) || typeof error.code !== 'string') return null;
  const details = isRecord(error.details) ? error.details : {};
  const retryAfter = Number.parseInt(response.headers?.['retry-after'], 10);
  return {
    code: error.code,
    message: typeof error.message === 'string' ? error.message : '',
    choices: Array.isArray(details.choices) ? details.choices.map(choiceValue).filter(Boolean) : [],
    call: typeof details.call === 'string' ? details.call : null,
    retryAfter: retryAfter > 0 ? retryAfter : null,
  };
};
