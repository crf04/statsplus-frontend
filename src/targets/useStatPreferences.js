import { useMemo, useSyncExternalStore } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getRequestErrorMessage } from '../gameLogsApi';
import { updateTarget } from './targetsApi';

export const STAT_SAVE_DELAY = 400;
// Keep in-flight choices across route remounts, but release settled channels
// after their last view leaves so a later visit reads fresh account state.
const channels = new Map();

function channelFor(key, target, userId) {
  if (channels.has(key)) return channels.get(key);
  let snapshot = { preferences: target.statPreferences ?? null, status: 'idle', error: null };
  let pending = null;
  let timer;
  let running = false;
  let readPins = 0;
  let releaseTimer;
  const listeners = new Set();
  // A criteria-save reload can remount after its request microtasks. Give that
  // same action one turn to reattach before a later visit seeds a fresh channel.
  const releaseIfUnused = () => {
    clearTimeout(releaseTimer);
    releaseTimer = setTimeout(() => {
      if (!listeners.size && !pending && !running && !readPins && channels.get(key) === channel) {
        channels.delete(key);
      }
    }, 0);
  };
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
    releaseIfUnused();
  };
  const change = (preferences) => {
    pending = preferences;
    publish({ preferences, status: 'pending', error: null });
    clearTimeout(timer);
    timer = setTimeout(flush, STAT_SAVE_DELAY);
  };
  const channel = {
    userId,
    holdForRead: () => {
      readPins += 1;
      return {
        release: () => {
          readPins -= 1;
          releaseIfUnused();
        },
      };
    },
    getSnapshot: () => snapshot,
    subscribe: (notify) => {
      clearTimeout(releaseTimer);
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

// A GET that began before a local write settled may return the older snapshot.
// Keep its channels alive until the destination can subscribe to those choices.
export const beginStatPreferenceRead = (userId) => {
  const held = [...channels.values()]
    .filter((channel) => channel.userId === userId)
    .map((channel) => channel.holdForRead());
  return {
    release: () => held.forEach((read) => read.release()),
  };
};

export default function useStatPreferences(target) {
  const { currentUser } = useAuth();
  const userId = currentUser?.uid;
  const key = `${userId || 'authenticated'}:${target.id}`;
  const channel = useMemo(() => channelFor(key, target, userId), [key, target, userId]);
  const state = useSyncExternalStore(channel.subscribe, channel.getSnapshot);
  return { ...state, onChange: channel.change, retry: channel.retry };
}
