const DEFAULT_API_TIMEOUT = 5000;

export const parseApiTimeout = (value, fallback = DEFAULT_API_TIMEOUT) => {
  const parsedValue = Number.parseInt(value, 10);
  return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : fallback;
};

export const API_TIMEOUT = parseApiTimeout(process.env.REACT_APP_API_TIMEOUT);
