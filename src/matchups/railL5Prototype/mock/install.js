/*
 * PROTOTYPE — throwaway. Production responses captured 2026-10-29 with
 * `live-shots --record` (SAC @ NOP and MEM @ POR), replayed so the public
 * link needs no sign-in.
 */
import { apiClient } from '../../../config';
import recorded from './recorded.json';

export const DEMO_URL = '/matchups/0022600145#proto=l5&v=A';

const keyOf = (config) => {
  const url = new URL(apiClient.getUri(config), window.location.origin);
  url.searchParams.sort();
  return { path: url.pathname, key: `${url.pathname}?${url.searchParams}` };
};

const answer = (config) => {
  if ((config.method || 'get').toLowerCase() !== 'get') return null;
  const { path, key } = keyOf(config);
  if (recorded[key]) return recorded[key];
  if (path.startsWith('/api/user/')) return null;
  const near = Object.keys(recorded).find((captured) => captured.startsWith(`${path}?`));
  return near ? recorded[near] : null;
};

export const installMockApi = () => {
  apiClient.interceptors.request.use((config) => {
    const data = answer(config);
    if (data) {
      config.adapter = async () => ({ data, status: 200, statusText: 'OK', headers: {}, config });
    }
    return config;
  });
};
