// The API client learns that the signed-in account is waitlisted; the auth
// context decides what that means for the signed-in UI. This keeps the two
// from importing each other.
const listeners = new Set();

export const subscribeWaitlisted = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const reportWaitlisted = (message) => {
  listeners.forEach((listener) => listener(message));
};
