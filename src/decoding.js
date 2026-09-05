/*
 * The checks every response decoder makes before it trusts a value. Each
 * endpoint keeps its own refusal — a reader is told which surface returned
 * something it could not use — so the decoders are built around that failure
 * rather than throwing one shared error.
 */
export const isRecord = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

export const strictDecoders = (fail) => ({
  requireString: (value) => {
    if (typeof value !== 'string' || !value) throw fail();
    return value;
  },
  requireNumber: (value) => {
    if (typeof value !== 'number' || !Number.isFinite(value)) throw fail();
    return value;
  },
  requireNumberOrNull: (value) => {
    if (value === null) return null;
    if (typeof value !== 'number' || !Number.isFinite(value)) throw fail();
    return value;
  },
});
