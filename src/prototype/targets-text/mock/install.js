/*
 * PROTOTYPE — throwaway. Production payloads for the owner's Targets,
 * captured 2026-10-14, served to the real Targets page in the standalone
 * build so it runs with no sign-in. The resolve payload is the 2026-04-10
 * slate (15 games) so cards show players; today is offseason. Writes
 * (create, edit, delete) are not mocked and fail.
 */
import { apiClient } from '../../../config';
import targets from './targets.json';
import backtests from './backtests.json';
import baselines from './baselines.json';
import resolve from './resolve.json';

export const DEMO_URL = '/targets#v=A';

export const installMockApi = () => {
  apiClient.interceptors.request.use((config) => {
    const url = config.url || '';
    const get = (config.method || 'get') === 'get';
    let data = null;
    if (get && url.endsWith('/api/user/targets')) data = targets;
    else if (get && url.endsWith('/api/user/targets/resolve')) data = resolve;
    else if (get && url.endsWith('/api/user/targets/backtests')) data = backtests;
    else if (get && url.endsWith('/api/diet/baselines')) data = baselines;
    if (data) {
      config.adapter = async () => ({ data, status: 200, statusText: 'OK', headers: {}, config });
    }
    return config;
  });
};
