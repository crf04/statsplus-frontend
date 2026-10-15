jest.unmock('axios');
import apiClient from './axiosConfig';
import { auth } from '../firebase/config';
import { getIdToken } from 'firebase/auth';
import axios from 'axios';
import { subscribeWaitlisted } from './waitlistSignal';

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

const rejectWith = (status, data) => async (config) => {
  throw new axios.AxiosError('failed', 'ERR_BAD_REQUEST', config, null, {
    status,
    data,
    headers: {},
    config,
  });
};

test('a waitlisted 403 reports the backend message and still rejects the request', async () => {
  auth.currentUser = { uid: 'u1' };
  getIdToken.mockResolvedValue('test-token');
  const heard = jest.fn();
  const unsubscribe = subscribeWaitlisted(heard);
  const message = "The beta is full right now. You're on the waitlist and we'll let you in soon.";
  await expect(
    apiClient.get('/api/players', {
      adapter: rejectWith(403, { error: { code: 'waitlisted', message } }),
    }),
  ).rejects.toMatchObject({ response: { status: 403 } });
  unsubscribe();
  // The account is the one the refused request was sent as.
  expect(heard.mock.calls).toEqual([[message, 'u1']]);
});

test.each([
  ['an admin refusal', 403, { error: { code: 'forbidden', message: 'Admin only.' } }],
  ['a legacy string error', 403, { error: 'Forbidden' }],
  ['a waitlisted code on another status', 429, { error: { code: 'waitlisted', message: 'x' } }],
])('%s does not raise the waitlist and still rejects', async (_name, status, data) => {
  const heard = jest.fn();
  const unsubscribe = subscribeWaitlisted(heard);
  await expect(
    apiClient.get('/api/players', { adapter: rejectWith(status, data) }),
  ).rejects.toMatchObject({ response: { status } });
  unsubscribe();
  expect(heard).not.toHaveBeenCalled();
});
