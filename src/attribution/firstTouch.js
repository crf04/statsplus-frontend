import { useEffect } from 'react';
import { apiClient, getApiUrl } from '../config';

const STORAGE_KEY = 'courtai.firstTouch';
const UTM_FIELDS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];

const read = (storage) => {
  try {
    const entry = JSON.parse(storage.getItem(STORAGE_KEY));
    return entry && typeof entry === 'object' && entry.payload && typeof entry.payload === 'object'
      ? entry
      : null;
  } catch {
    return null;
  }
};

const write = (storage, entry) => {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(entry));
  } catch {
    // Storage can be unavailable (private mode, quota); attribution is best effort.
  }
};

const externalReferrer = (referrer, origin) => {
  if (!referrer) return null;
  try {
    return new URL(referrer).origin === origin ? null : referrer;
  } catch {
    return null;
  }
};

/** Records where the visitor first landed. The first entry is never overwritten. */
export const captureFirstTouch = (env = window) => {
  let storage;
  try {
    storage = env.localStorage;
    if (read(storage)) return;
  } catch {
    return;
  }
  const params = new URLSearchParams(env.location.search);
  const payload = Object.fromEntries([...UTM_FIELDS, 'ref'].map((k) => [k, params.get(k)]));
  payload.referrer = externalReferrer(env.document.referrer, env.location.origin);
  payload.landing_path = env.location.pathname;
  payload.landed_at = new Date().toISOString();
  write(storage, { payload, sentFor: null });
};

const inFlight = new Set();

/** Posts the stored first touch once per account. Failures are silent and retried on a later load. */
export const sendFirstTouch = async (uid, client = apiClient) => {
  if (!uid || inFlight.has(uid)) return;
  let storage;
  let entry;
  try {
    storage = window.localStorage;
    entry = read(storage);
  } catch {
    return;
  }
  if (!entry || entry.sentFor === uid) return;

  inFlight.add(uid);
  try {
    const response = await client.post(getApiUrl('USER_ATTRIBUTION'), entry.payload, {
      expectedUserId: uid,
    });
    if (response.status === 200 || response.status === 201) {
      write(storage, { ...(read(storage) || entry), sentFor: uid });
    }
  } catch {
    // Silent by design: the next load retries.
  } finally {
    inFlight.delete(uid);
  }
};

export const useFirstTouchSender = (uid, client) => {
  useEffect(() => {
    sendFirstTouch(uid, client);
  }, [uid, client]);
};
