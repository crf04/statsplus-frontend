/*
 * PROTOTYPE (throwaway). Production responses captured 2026-11-03 with
 * `live-shots --record`, replayed so the public link needs no sign-in. Each
 * sample player's next opponent is pinned to the opponent the prototype reads.
 */
import { apiClient } from '../../config';
import { sampleFor, SAMPLES } from '../mode';
import recorded from './recorded.json';

export const DEMO_URL = `/?player_name=Toumani+Camara#proto=profile&v=A`;

const keyOf = (config) => {
  const url = new URL(apiClient.getUri(config), window.location.origin);
  url.searchParams.sort();
  return {
    path: url.pathname,
    params: url.searchParams,
    key: `${url.pathname}?${url.searchParams}`,
  };
};

const answer = (config) => {
  if ((config.method || 'get').toLowerCase() !== 'get') return [200, {}];
  const { path, params, key } = keyOf(config);
  if (path === '/api/players/next-opponent') {
    const sample = sampleFor(params.get('player_name')) || SAMPLES[0];
    return [
      200,
      {
        next_game: { opponent: sample.opponent, date: '2026-11-05', home: true },
        opponent_ranks: [],
      },
    ];
  }
  if (path.startsWith('/api/user/saved-filter-sets')) return [200, { saved_filter_sets: [] }];
  if (recorded[key]) return [200, recorded[key]];
  const near = Object.keys(recorded).find((captured) => captured.startsWith(`${path}?`));
  return near ? [200, recorded[near]] : [200, {}];
};

export const installMockApi = () => {
  apiClient.interceptors.request.use((config) => {
    const [status, data] = answer(config);
    config.adapter = async () => ({
      data,
      status,
      statusText: String(status),
      headers: {},
      config,
    });
    return config;
  });
};
