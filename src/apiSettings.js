const DEFAULT_API_TIMEOUT = 5000;
const DEFAULT_NL_QUERY_TIMEOUT = 15000;
const DEFAULT_TARGET_READ_TIMEOUT = 20000;

export const parseApiTimeout = (value, fallback = DEFAULT_API_TIMEOUT) => {
  const parsedValue = Number.parseInt(value, 10);
  return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : fallback;
};

export const API_TIMEOUT = parseApiTimeout(process.env.REACT_APP_API_TIMEOUT);
export const NL_QUERY_TIMEOUT = parseApiTimeout(
  process.env.REACT_APP_NL_QUERY_TIMEOUT,
  DEFAULT_NL_QUERY_TIMEOUT,
);
// A Target backtest or preview is a league-wide game-log scan, slower than the
// default request budget even on a warm backend.
export const TARGET_READ_TIMEOUT = parseApiTimeout(
  process.env.REACT_APP_TARGET_READ_TIMEOUT,
  DEFAULT_TARGET_READ_TIMEOUT,
);
