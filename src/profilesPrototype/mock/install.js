/*
 * PROTOTYPE — throwaway. Production responses captured 2026-10-26 with
 * `live-shots --record`, replayed so the public link needs no sign-in.
 * Only Kel'el Ware vs the Houston Rockets was captured; any other request to a
 * captured endpoint answers with that capture.
 */
import { apiClient } from '../../config';
import recorded from './recorded.json';

export const DEMO_URL = `/?player_name=Kel%27el+Ware#proto=profiles&v=A`;

const answer = (config) => {
  if ((config.method || 'get').toLowerCase() !== 'get') return null;
  const url = new URL(apiClient.getUri(config), window.location.origin);
  url.searchParams.sort();
  const key = `${url.pathname}?${url.searchParams}`;
  if (recorded[key]) return recorded[key];
  const near = Object.keys(recorded).find((captured) => captured.startsWith(`${url.pathname}?`));
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
