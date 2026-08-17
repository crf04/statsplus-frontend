const DEFAULT_API_TIMEOUT = 5000;
const DEFAULT_NL_QUERY_TIMEOUT = 15000;

export const parseApiTimeout = (value, fallback = DEFAULT_API_TIMEOUT) => {
  const parsedValue = Number.parseInt(value, 10);
  return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : fallback;
};

export const API_TIMEOUT = parseApiTimeout(process.env.REACT_APP_API_TIMEOUT);
export const NL_QUERY_TIMEOUT = parseApiTimeout(
  process.env.REACT_APP_NL_QUERY_TIMEOUT,
  DEFAULT_NL_QUERY_TIMEOUT,
);
