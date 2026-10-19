/*
 * PROTOTYPE — throwaway. Production payloads captured 2026-10-19 by
 * capture.sh for opening night 2026-10-20 (sportsbook quotes as of ~01:41 UTC).
 */
import { apiClient } from '../../../config';

const files = import.meta.glob('./*.json', { eager: true, import: 'default' });
const payload = (name) => files[`./${name}.json`] ?? null;

export const DEMO_GAMES = [
  ['0022600001', 'BOS @ DET · Oct 20'],
  ['0022600003', 'OKC @ SAS · Oct 20'],
];
export const DEMO_URL = `/matchups/${DEMO_GAMES[0][0]}?odds=A`;

export const installMockApi = () => {
  apiClient.interceptors.request.use((config) => {
    const url = config.url || '';
    const { game_id: game, player_id: player } = config.params || {};
    let data = null;
    if (url.endsWith('/api/games/matchup')) data = payload(`matchup-${game}`);
    else if (url.endsWith('/api/games/matchup/selection'))
      data = payload(`selection-${game}-${player}`);
    if (data)
      config.adapter = async () => ({ data, status: 200, statusText: 'OK', headers: {}, config });
    return config;
  });
};
