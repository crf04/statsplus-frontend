import { useMemo, useSyncExternalStore } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getRequestErrorMessage } from '../gameLogsApi';
import { updateTarget } from './targetsApi';

export const STAT_SAVE_DELAY = 400;
// A channel survives route remounts: an older list read cannot overwrite the
// choice made while that read was in flight. Keys include the signed-in account.
const channels = new Map();

function channelFor(key, target, userId) {
  if (channels.has(key)) return channels.get(key);
  let snapshot = { preferences: target.statPreferences ?? null, status: 'idle', error: null };
  let pending = null;
  let timer;
  let running = false;
  const listeners = new Set();
  const publish = (patch) => {
    snapshot = { ...snapshot, ...patch };
    listeners.forEach((notify) => notify());
  };
  const flush = async () => {
    clearTimeout(timer);
    if (running) return;
    running = true;
    while (pending) {
      const preferences = pending;
      pending = null;
      publish({ status: 'saving', error: null });
      try {
        await updateTarget({
          id: target.id,
          statPreferences: preferences,
          ...(userId ? { expectedUserId: userId } : {}),
        });
        publish({ status: pending ? 'saving' : 'saved', error: null });
      } catch (error) {
        publish({
          status: 'error',
          error: getRequestErrorMessage(error, 'Unable to save stats. Please retry.'),
        });
      }
    }
    running = false;
  };
  const change = (preferences) => {
    pending = preferences;
    publish({ preferences, status: 'pending', error: null });
    clearTimeout(timer);
    timer = setTimeout(flush, STAT_SAVE_DELAY);
  };
  const channel = {
    getSnapshot: () => snapshot,
    subscribe: (notify) => {
      listeners.add(notify);
      return () => {
        listeners.delete(notify);
        if (listeners.size === 0) flush();
      };
    },
    change,
    retry: () => change(snapshot.preferences),
  };
  channels.set(key, channel);
  return channel;
}

export default function useStatPreferences(target) {
  const { currentUser } = useAuth();
  const userId = currentUser?.uid;
  const key = `${userId || 'authenticated'}:${target.id}`;
  const channel = useMemo(() => channelFor(key, target, userId), [key, target, userId]);
  const state = useSyncExternalStore(channel.subscribe, channel.getSnapshot);
  return { ...state, onChange: channel.change, retry: channel.retry };
}
