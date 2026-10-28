import config from '../config';

const ET = 'America/New_York';
const DAY_MS = 24 * 60 * 60 * 1000;

// A report older than this carries a badge (crf04/statsplus#372).
export const STALE_DAYS = 3;

/* "Oct 25, 2026" for an ISO date or timestamp, in Eastern time. */
export const shortDate = (value) => {
  const at = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00Z`) : new Date(value);
  return at.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: /^\d{4}-\d{2}-\d{2}$/.test(value) ? 'UTC' : ET,
  });
};

/* "Published October 25, 2026, data as of 6:30 PM EDT": both from when it was published. */
export const publishedLine = (createdAt) => {
  const at = new Date(createdAt);
  const day = at.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: ET,
  });
  const time = at.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: ET,
    timeZoneName: 'short',
  });
  return `Published ${day}, data as of ${time}`;
};

/* Whole days since publication once past STALE_DAYS, else null. */
export const staleDays = (createdAt, now = Date.now()) => {
  const age = now - Date.parse(createdAt);
  return age > STALE_DAYS * DAY_MS ? Math.floor(age / DAY_MS) : null;
};

/* A preview path the API serves resolves against the API, as every request does. */
export const previewSrc = (url) =>
  /^https?:\/\//.test(url) ? url : `${config.API_BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;

export const authorPath = (handle) => `/research/@${handle}`;
