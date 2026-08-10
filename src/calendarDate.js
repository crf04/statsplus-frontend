const calendarDatePattern = /^\d{4}-\d{2}-\d{2}$/;

export const isCalendarDate = (value) => {
  if (typeof value !== 'string' || !calendarDatePattern.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};
