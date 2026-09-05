import { apiClient } from '../config';
import {
  createTarget,
  decodeTargets,
  deleteTarget,
  fetchTargets,
  updateTarget,
} from './targetsApi';

jest.mock('../config', () => ({
  apiClient: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() },
  getApiUrl: (name) => `/api/user/${name.toLowerCase()}`,
}));

const wireTarget = {
  id: 7,
  opponent: 'OKC',
  title: 'OKC vs Corner 3 ≥ 40%',
  note: 'Leaks the corner late.',
  created_at: '2026-04-08T15:12:00Z',
  qualifiers: [
    { base: 'shot_zones', slice_key: 'Corner 3', comparator: 'at_or_above', threshold: 0.4 },
  ],
};

beforeEach(() => {
  jest.clearAllMocks();
});

test('decodes the list to what the UI needs, keeping the backend order', () => {
  expect(
    decodeTargets({
      success: true,
      targets: [wireTarget, { ...wireTarget, id: 8, opponent: 'BOS', note: null }],
    }),
  ).toEqual([
    {
      id: 7,
      opponent: 'OKC',
      title: 'OKC vs Corner 3 ≥ 40%',
      note: 'Leaks the corner late.',
      createdAt: '2026-04-08T15:12:00Z',
      qualifiers: [
        { base: 'shot_zones', sliceKey: 'Corner 3', comparator: 'at_or_above', threshold: 0.4 },
      ],
    },
    {
      id: 8,
      opponent: 'BOS',
      title: 'OKC vs Corner 3 ≥ 40%',
      note: '',
      createdAt: '2026-04-08T15:12:00Z',
      qualifiers: [
        { base: 'shot_zones', sliceKey: 'Corner 3', comparator: 'at_or_above', threshold: 0.4 },
      ],
    },
  ]);
});

test('refuses a response that is not the documented list', () => {
  expect(() => decodeTargets({ success: true })).toThrow(/invalid response/i);
  // Every Target is opened by id, so a record without one cannot be reached.
  expect(() => decodeTargets({ targets: [{ ...wireTarget, id: undefined }] })).toThrow(
    /invalid response/i,
  );
  // The title is the backend's to derive, so a record without one is unusable.
  expect(() => decodeTargets({ targets: [{ ...wireTarget, title: undefined }] })).toThrow(
    /invalid response/i,
  );
  // A player fits by meeting every Qualifier, so no Qualifiers means no filter.
  expect(() => decodeTargets({ targets: [{ ...wireTarget, qualifiers: [] }] })).toThrow(
    /invalid response/i,
  );
  expect(() =>
    decodeTargets({
      targets: [{ ...wireTarget, qualifiers: [{ ...wireTarget.qualifiers[0], threshold: 40 }] }],
    }),
  ).toThrow(/invalid response/i);
  expect(() =>
    decodeTargets({
      targets: [
        { ...wireTarget, qualifiers: [{ ...wireTarget.qualifiers[0], comparator: 'gte' }] },
      ],
    }),
  ).toThrow(/invalid response/i);
});

test('fetches the list from the documented path', async () => {
  apiClient.get.mockResolvedValue({ data: { success: true, targets: [] } });
  const controller = new AbortController();

  await expect(fetchTargets({ signal: controller.signal })).resolves.toEqual([]);
  expect(apiClient.get).toHaveBeenCalledWith('/api/user/targets', {
    signal: controller.signal,
  });
});

test('creates a Target with the wire shape of its Qualifiers', async () => {
  apiClient.post.mockResolvedValue({ data: { success: true } });

  await createTarget({
    opponent: 'OKC',
    note: 'Leaks the corner late.',
    qualifiers: [
      { base: 'shot_zones', sliceKey: 'Corner 3', comparator: 'at_or_above', threshold: 0.4 },
    ],
  });

  expect(apiClient.post).toHaveBeenCalledWith('/api/user/targets', {
    opponent: 'OKC',
    note: 'Leaks the corner late.',
    qualifiers: [
      { base: 'shot_zones', slice_key: 'Corner 3', comparator: 'at_or_above', threshold: 0.4 },
    ],
  });
});

test('edits only the Qualifiers and the note of one Target', async () => {
  apiClient.patch.mockResolvedValue({ data: { success: true } });

  await updateTarget({
    id: 7,
    note: '',
    qualifiers: [
      { base: 'play_types', sliceKey: 'Transition', comparator: 'at_or_below', threshold: 0.15 },
    ],
  });

  expect(apiClient.patch).toHaveBeenCalledWith('/api/user/targets/7', {
    note: '',
    qualifiers: [
      { base: 'play_types', slice_key: 'Transition', comparator: 'at_or_below', threshold: 0.15 },
    ],
  });
});

test('deletes one Target by id', async () => {
  apiClient.delete.mockResolvedValue({ data: { success: true } });

  await deleteTarget({ id: 7 });

  expect(apiClient.delete).toHaveBeenCalledWith('/api/user/targets/7');
});
