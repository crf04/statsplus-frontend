import { apiClient } from './config';
import {
  createSavedFilterSet,
  decodeSavedFilterSets,
  deleteSavedFilterSet,
  fetchSavedFilterSets,
  renameSavedFilterSet,
} from './savedFilterSetsApi';

jest.mock('./config', () => ({
  apiClient: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() },
  getApiUrl: (name) => `/api/${name.toLowerCase()}`,
}));

describe('savedFilterSetsApi', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('decodes the list to what the UI needs, keeping the backend order', () => {
    expect(
      decodeSavedFilterSets({
        success: true,
        saved_filter_sets: [
          {
            id: 2,
            name: 'Newest',
            query_string: 'player_name=LeBron+James',
            created_at: '2026-01-02T00:00:00Z',
            updated_at: '2026-01-02T00:00:00Z',
          },
          {
            id: 1,
            name: 'Oldest',
            query_string: 'player_name=Stephen+Curry',
            created_at: '2026-01-01T00:00:00Z',
            updated_at: '2026-01-01T00:00:00Z',
          },
        ],
      }),
    ).toEqual([
      { id: 2, name: 'Newest', queryString: 'player_name=LeBron+James' },
      { id: 1, name: 'Oldest', queryString: 'player_name=Stephen+Curry' },
    ]);
  });

  test('refuses a response that is not the documented list', () => {
    expect(() => decodeSavedFilterSets({ success: true })).toThrow(/invalid response/i);
    expect(() =>
      decodeSavedFilterSets({ saved_filter_sets: [{ id: 1, name: 'No query' }] }),
    ).toThrow(/invalid response/i);
  });

  test('fetches the list from the documented path', async () => {
    apiClient.get.mockResolvedValue({ data: { success: true, saved_filter_sets: [] } });
    const controller = new AbortController();

    await expect(fetchSavedFilterSets({ signal: controller.signal })).resolves.toEqual([]);
    expect(apiClient.get).toHaveBeenCalledWith('/api/saved_filter_sets', {
      signal: controller.signal,
    });
  });

  test('creates with the bare query string under the documented field names', async () => {
    apiClient.post.mockResolvedValue({ data: {} });

    await createSavedFilterSet({ name: 'Curry threes', queryString: 'player_name=Stephen+Curry' });

    expect(apiClient.post).toHaveBeenCalledWith('/api/saved_filter_sets', {
      name: 'Curry threes',
      query_string: 'player_name=Stephen+Curry',
    });
  });

  test('renames and deletes by id', async () => {
    apiClient.patch.mockResolvedValue({ data: {} });
    apiClient.delete.mockResolvedValue({ data: {} });

    await renameSavedFilterSet({ id: 7, name: 'Renamed' });
    await deleteSavedFilterSet({ id: 7 });

    expect(apiClient.patch).toHaveBeenCalledWith('/api/saved_filter_sets/7', { name: 'Renamed' });
    expect(apiClient.delete).toHaveBeenCalledWith('/api/saved_filter_sets/7');
  });
});
