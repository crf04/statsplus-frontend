// The appearance a visitor chose and the theme it paints. One store per
// document: it reads the choice from this browser's storage, follows the
// device under System, and is the only writer of html[data-theme], the
// theme-color meta and the stored choice. index.html runs the same rule
// before first paint (themeStore.test.js keeps the two in step).

export const THEME_STORAGE_KEY = 'courtai:theme';
export const PREFERENCES = ['system', 'light', 'dark'];

// The browser chrome colour of each theme: its --ct-ink.
export const THEME_COLOR = { dark: '#0d0b07', light: '#f3f4f6' };

const SYSTEM_LIGHT = '(prefers-color-scheme: light)';

export const resolveTheme = (preference, systemPrefersLight) =>
  preference === 'system' ? (systemPrefersLight ? 'light' : 'dark') : preference;

// System is the absence of a choice; anything unrecognised reads as System.
const parsePreference = (stored) => (stored === 'light' || stored === 'dark' ? stored : 'system');

export const createThemeStore = (win = window) => {
  const doc = win.document;
  const media = typeof win.matchMedia === 'function' ? win.matchMedia(SYSTEM_LIGHT) : null;
  const listeners = new Set();

  const read = () => {
    try {
      return win.localStorage.getItem(THEME_STORAGE_KEY);
    } catch {
      return null;
    }
  };
  const write = (preference) => {
    try {
      if (preference === 'system') win.localStorage.removeItem(THEME_STORAGE_KEY);
      else win.localStorage.setItem(THEME_STORAGE_KEY, preference);
    } catch {
      // Private browsing or a full quota: the choice lasts for this page.
    }
  };

  let systemPrefersLight = Boolean(media?.matches);
  const snapshotOf = (preference) => ({
    preference,
    resolved: resolveTheme(preference, systemPrefersLight),
  });
  let snapshot = snapshotOf(parsePreference(read()));

  // A user's switch repaints in one frame instead of through every colour
  // transition on the page.
  const paint = ({ resolved }, { instant = false } = {}) => {
    const root = doc.documentElement;
    if (root.getAttribute('data-theme') !== resolved) {
      if (instant) {
        root.setAttribute('data-theme-switching', '');
        win.requestAnimationFrame?.(() =>
          win.requestAnimationFrame(() => root.removeAttribute('data-theme-switching')),
        );
      }
      root.setAttribute('data-theme', resolved);
    }
    const meta = doc.querySelector('meta[name="theme-color"]');
    if (meta && meta.getAttribute('content') !== THEME_COLOR[resolved]) {
      meta.setAttribute('content', THEME_COLOR[resolved]);
    }
  };

  const commit = (next, options) => {
    if (next.preference === snapshot.preference && next.resolved === snapshot.resolved) return;
    snapshot = next;
    paint(snapshot, options);
    listeners.forEach((listener) => listener());
  };

  paint(snapshot);

  media?.addEventListener?.('change', (event) => {
    systemPrefersLight = event.matches;
    commit(snapshotOf(snapshot.preference));
  });
  // Another tab chose: follow it without writing it back.
  win.addEventListener('storage', (event) => {
    if (event.key !== THEME_STORAGE_KEY && event.key !== null) return;
    commit(snapshotOf(parsePreference(read())));
  });

  return {
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    setPreference: (preference) => {
      if (!PREFERENCES.includes(preference) || preference === snapshot.preference) return;
      write(preference);
      commit(snapshotOf(preference), { instant: true });
    },
  };
};
