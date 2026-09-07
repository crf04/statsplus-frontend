import { isCalendarDate, getTodaySlateDate } from './calendarDate';

// Short-lived decoded results only; one 32-entry budget across both surfaces.
const entries = new Map();
let session = 0;
let resolutions = 0;
export const clearRevisitCaches = () => {
  session += 1;
  entries.clear();
};
export const invalidateTargetResolutions = () => {
  resolutions += 1;
  for (const [key, entry] of entries) if (entry.kind === 'resolution') entries.delete(key);
};
export const historicalDate = (date) => isCalendarDate(date) && date < getTodaySlateDate();

export const readRevisit = async (
  kind,
  userId,
  identity,
  load,
  { signal, bypass = false } = {},
) => {
  if (!userId) return load();
  const key = JSON.stringify([kind, userId, identity]);
  const cached = entries.get(key);
  if (!bypass && !signal?.aborted && cached && Date.now() - cached.at < 30000) return cached.data;
  entries.delete(key);
  const capturedSession = session;
  const capturedResolutions = resolutions;
  const data = await load();
  if (
    !signal?.aborted &&
    session === capturedSession &&
    (kind !== 'resolution' || resolutions === capturedResolutions)
  ) {
    entries.set(key, { kind, data, at: Date.now() });
    while (entries.size > 32) entries.delete(entries.keys().next().value);
  }
  return data;
};
