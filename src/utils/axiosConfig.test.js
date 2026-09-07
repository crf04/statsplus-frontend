jest.unmock('axios');
import apiClient from './axiosConfig';
import { auth } from '../firebase/config';
import { getIdToken } from 'firebase/auth';

jest.mock('../firebase/config', () => ({ auth: { currentUser: null } }));
jest.mock('firebase/auth', () => ({ getIdToken: jest.fn() }));

afterEach(() => {
  auth.currentUser = null;
  jest.clearAllMocks();
});

test('a deferred account write never sends a new account’s bearer', async () => {
  auth.currentUser = { uid: 'second' };
  const adapter = jest.fn();
  await expect(
    apiClient.patch('/account-write', {}, { expectedUserId: 'first', adapter }),
  ).rejects.toMatchObject({ code: 'ERR_CANCELED' });
  expect(adapter).not.toHaveBeenCalled();
  expect(getIdToken).not.toHaveBeenCalled();
});
test('the captured account can send its deferred write', async () => {
  auth.currentUser = { uid: 'first' };
  getIdToken.mockResolvedValue('test-token');
  const adapter = jest.fn(async (config) => ({ status: 200, data: {}, headers: {}, config }));
  await apiClient.patch('/account-write', {}, { expectedUserId: 'first', adapter });
  expect(adapter).toHaveBeenCalledWith(
    expect.objectContaining({
      headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
    }),
  );
});
