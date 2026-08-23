import { apiClient, getApiUrl } from './config';

const createInvalidResponseError = () =>
  new Error('The saved filter sets API returned an invalid response.');

/*
 * A Saved Filter Set is a name and the bare query string of a Log Workspace
 * URL. Timestamps order the list on the backend, which is why nothing here
 * carries them: the list arrives newest-first and is shown in that order.
 */
const decodeSavedFilterSet = (item) => {
  if (!item || typeof item !== 'object') throw createInvalidResponseError();
  const { id, name, query_string: queryString } = item;
  const hasId = typeof id === 'string' || typeof id === 'number';
  if (!hasId || typeof name !== 'string' || typeof queryString !== 'string') {
    throw createInvalidResponseError();
  }
  return { id, name, queryString };
};

export const decodeSavedFilterSets = (payload = {}) => {
  if (!payload || !Array.isArray(payload.saved_filter_sets)) throw createInvalidResponseError();
  return payload.saved_filter_sets.map(decodeSavedFilterSet);
};

const savedFilterSetsUrl = (path = '') => `${getApiUrl('SAVED_FILTER_SETS')}${path}`;

export const fetchSavedFilterSets = async ({ signal } = {}) => {
  const response = await apiClient.get(savedFilterSetsUrl(), { signal });
  return decodeSavedFilterSets(response.data);
};

/*
 * The mutations report success or throw; the caller reloads the list rather
 * than patching one in place, so the order shown is always the backend's.
 */
export const createSavedFilterSet = async ({ name, queryString }) => {
  await apiClient.post(savedFilterSetsUrl(), { name, query_string: queryString });
};

export const renameSavedFilterSet = async ({ id, name }) => {
  await apiClient.patch(savedFilterSetsUrl(`/${encodeURIComponent(id)}`), { name });
};

export const deleteSavedFilterSet = async ({ id }) => {
  await apiClient.delete(savedFilterSetsUrl(`/${encodeURIComponent(id)}`));
};
