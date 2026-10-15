import * as Sentry from '@sentry/react';

let enabled = false;

// Auth tokens, emails and request bodies must never leave the browser, so the
// event keeps only the exception, the tags and the page path.
const redact = (text) =>
  typeof text === 'string'
    ? text
        .replace(/[^\s@/=?&"']+@[^\s@/=?&"']+\.[^\s@/=?&"']+/g, '[email]')
        .replace(/Bearer\s+[\w.~+/=-]+/gi, 'Bearer [token]')
        .replace(/\beyJ[\w-]+\.[\w-]+\.[\w-]+/g, '[token]')
        .replace(/\b(access_token|id_token|token|key)=[^&\s#]+/gi, '$1=[redacted]')
    : text;

const pathOnly = (url) => {
  try {
    const { origin, pathname } = new URL(url);
    return `${origin}${pathname}`;
  } catch {
    return undefined;
  }
};

const scrubEvent = (event) => {
  delete event.user;
  delete event.breadcrumbs;
  delete event.extra;
  delete event.contexts?.replay;
  delete event.message;
  for (const value of event.exception?.values || []) {
    value.value = redact(value.value);
    for (const frame of value.stacktrace?.frames || []) {
      if (frame.filename) frame.filename = frame.filename.replace(/[?#].*$/, '');
      if (frame.abs_path) frame.abs_path = frame.abs_path.replace(/[?#].*$/, '');
    }
  }
  if (event.request) {
    event.request = { url: pathOnly(event.request.url), method: event.request.method };
  }
  return event;
};

/**
 * Starts Sentry only when a DSN is configured; without one nothing is
 * initialized and nothing is sent. Tracing and session replay are never on.
 * `transport` lets tests capture events instead of sending them.
 */
export const initErrorReporting = ({ dsn = process.env.REACT_APP_SENTRY_DSN, transport } = {}) => {
  if (!dsn) {
    enabled = false;
    return false;
  }
  Sentry.init({
    dsn,
    transport,
    environment: process.env.REACT_APP_ENVIRONMENT || undefined,
    sendDefaultPii: false,
    // Default integrations are error handlers only; browser tracing and
    // replay are separate integrations that are not added here.
    tracesSampleRate: 0,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    maxBreadcrumbs: 0,
    beforeSend: scrubEvent,
  });
  enabled = true;
  return true;
};

/** Reports a failed API response with a 5xx status, tagged with its full X-Request-ID. */
export const reportApiError = (error) => {
  const status = error?.response?.status;
  if (!enabled || !(status >= 500)) return;
  const requestId = error.response.headers?.['x-request-id'];
  Sentry.withScope((scope) => {
    if (typeof requestId === 'string' && requestId) scope.setTag('request_id', requestId);
    scope.setTag('http_status', String(status));
    Sentry.captureException(error);
  });
};

/** Reports a React render error caught by an error boundary. */
export const reportRenderError = (error, info) => {
  if (!enabled) return;
  Sentry.withScope((scope) => {
    if (info?.componentStack) scope.setContext('react', { componentStack: info.componentStack });
    Sentry.captureException(error);
  });
};
