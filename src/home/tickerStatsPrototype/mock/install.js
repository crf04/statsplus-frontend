/*
 * PROTOTYPE — throwaway. Home-page responses captured from production on
 * 2026-11-09 with `live-shots --record` (no /api/user/*), replayed so the
 * public link needs no sign-in.
 */
import { apiClient } from '../../../config';
import recorded from './recorded.json';

const keyOf = (config) => {
  const url = new URL(apiClient.getUri(config), window.location.origin);
  url.searchParams.sort();
  return { path: url.pathname, key: `${url.pathname}?${url.searchParams}` };
};

const answer = (config) => {
  if ((config.method || 'get').toLowerCase() !== 'get') return null;
  const { path, key } = keyOf(config);
  if (recorded[key]) return recorded[key];
  const near = Object.keys(recorded).find((captured) => captured.startsWith(`${path}?`));
  return near ? recorded[near] : null;
};

export const installMockApi = () => {
  apiClient.interceptors.request.use((config) => {
    const data = answer(config);
    if (data) {
      config.adapter = async () => ({ data, status: 200, statusText: '200', headers: {}, config });
    }
    return config;
  });
};
