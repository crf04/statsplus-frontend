const calendarDatePattern = /^\d{4}-\d{2}-\d{2}$/;
const shortCalendarDateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'numeric',
  day: 'numeric',
  timeZone: 'UTC',
});
const fullCalendarDateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'numeric',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});

export const isCalendarDate = (value) => {
  if (typeof value !== 'string' || !calendarDatePattern.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};

export const parseCalendarDate = (value) => (isCalendarDate(value) ? value : null);

export const getTodaySlateDate = (now = new Date()) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);

export const shiftCalendarDate = (date, days) => {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
};

export const formatCalendarDate = (date) =>
  new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T12:00:00Z`));

/*
 * A tip time is a clock reading of an instant rather than a calendar date, and
 * is shown in the reader's own zone: the Slate row and a Target's game chip
 * name the same game, so they read it the same way.
 */
export const formatTip = (scheduledAt) =>
  new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(scheduledAt));

const serializedCalendarDate = (value) => {
  if (isCalendarDate(value)) return value;

  if (typeof value === 'string') {
    const trimmedValue = value.trim();
    const isoDatePrefix = /^(\d{4}-\d{2}-\d{2})(?:$|[T\s])/.exec(trimmedValue)?.[1];
    if (isoDatePrefix) return isCalendarDate(isoDatePrefix) ? isoDatePrefix : null;
  }

  if (
    !(value instanceof Date) &&
    typeof value !== 'string' &&
    (typeof value !== 'number' || !Number.isFinite(value))
  ) {
    return null;
  }
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
};

/** Format a game-log date while preserving the backend's calendar day. */
export const formatGameLogDate = (value, { includeYear = false } = {}) => {
  const calendarDate = serializedCalendarDate(value);
  if (!calendarDate) return 'N/A';
  const formatter = includeYear ? fullCalendarDateFormatter : shortCalendarDateFormatter;
  return formatter.format(new Date(`${calendarDate}T12:00:00Z`));
};
