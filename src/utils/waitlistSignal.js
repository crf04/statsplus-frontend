// The API client learns that the signed-in account is waitlisted; the auth
// context decides what that means for the signed-in UI. This keeps the two
// from importing each other.
const listeners = new Set();

export const subscribeWaitlisted = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

// `account` is the uid the refused request was sent as, so a slow answer for
// one account cannot waitlist the account that replaced it.
export const reportWaitlisted = (message, account) => {
  listeners.forEach((listener) => listener(message, account));
};
