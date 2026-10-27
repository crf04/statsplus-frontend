import fs from 'fs';
import path from 'path';
import { THEME_COLOR, THEME_STORAGE_KEY, createThemeStore } from './themeStore';

const html = document.documentElement;

// The device's colour scheme, switchable the way the OS switches it.
const installSystem = (prefersLight) => {
  const listeners = new Set();
  const media = {
    matches: prefersLight,
    addEventListener: (type, listener) => listeners.add(listener),
  };
  window.matchMedia = jest.fn(() => media);
  return (nextLight) => {
    media.matches = nextLight;
    listeners.forEach((listener) => listener({ matches: nextLight }));
  };
};

const painted = () => ({
  theme: html.getAttribute('data-theme'),
  chrome: document.querySelector('meta[name="theme-color"]').getAttribute('content'),
});

beforeEach(() => {
  localStorage.clear();
  html.removeAttribute('data-theme');
  html.removeAttribute('data-theme-switching');
  document.head.innerHTML = '<meta name="theme-color" content="#0d0b07">';
});

afterEach(() => {
  jest.restoreAllMocks();
  delete window.matchMedia;
});

test('with no choice stored it follows the device, and paints the page and browser chrome', () => {
  installSystem(true);
  const store = createThemeStore();
  expect(store.getSnapshot()).toEqual({ preference: 'system', resolved: 'light' });
  expect(painted()).toEqual({ theme: 'light', chrome: '#f3f4f6' });

  html.removeAttribute('data-theme');
  installSystem(false);
  expect(createThemeStore().getSnapshot()).toEqual({ preference: 'system', resolved: 'dark' });
  expect(painted()).toEqual({ theme: 'dark', chrome: '#0d0b07' });
});

test('a choice is stored in this browser, read on the next visit, and System removes it', () => {
  installSystem(true);
  createThemeStore().setPreference('dark');
  expect(localStorage.getItem('courtai:theme')).toBe('dark');
  expect(painted()).toEqual({ theme: 'dark', chrome: '#0d0b07' });

  const nextVisit = createThemeStore();
  expect(nextVisit.getSnapshot()).toEqual({ preference: 'dark', resolved: 'dark' });
  nextVisit.setPreference('system');
  expect(localStorage.getItem('courtai:theme')).toBeNull();
  expect(nextVisit.getSnapshot()).toEqual({ preference: 'system', resolved: 'light' });
  expect(painted().theme).toBe('light');
});

test('an unrecognised stored value reads as System', () => {
  installSystem(false);
  localStorage.setItem('courtai:theme', 'sepia');
  expect(createThemeStore().getSnapshot()).toEqual({ preference: 'system', resolved: 'dark' });
});

test('under System a device switch repaints; an explicit choice ignores it until System again', () => {
  const switchDevice = installSystem(false);
  const store = createThemeStore();
  const seen = [];
  store.subscribe(() => seen.push(store.getSnapshot()));

  switchDevice(true);
  expect(painted()).toEqual({ theme: 'light', chrome: '#f3f4f6' });

  store.setPreference('dark');
  switchDevice(false);
  switchDevice(true);
  expect(painted().theme).toBe('dark');

  store.setPreference('system');
  expect(painted().theme).toBe('light');
  expect(seen).toEqual([
    { preference: 'system', resolved: 'light' },
    { preference: 'dark', resolved: 'dark' },
    { preference: 'system', resolved: 'light' },
  ]);
});

test('when storage refuses, the choice still applies for this page', () => {
  installSystem(false);
  jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('SecurityError');
  });
  jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('QuotaExceededError');
  });
  const store = createThemeStore();
  expect(store.getSnapshot()).toEqual({ preference: 'system', resolved: 'dark' });
  store.setPreference('light');
  expect(store.getSnapshot()).toEqual({ preference: 'light', resolved: 'light' });
  expect(painted()).toEqual({ theme: 'light', chrome: '#f3f4f6' });
});

test("another tab's choice applies here without being written back", () => {
  installSystem(false);
  const store = createThemeStore();
  const writes = jest.spyOn(Storage.prototype, 'setItem');

  localStorage.setItem(THEME_STORAGE_KEY, 'light');
  writes.mockClear();
  window.dispatchEvent(new StorageEvent('storage', { key: THEME_STORAGE_KEY, newValue: 'light' }));
  expect(store.getSnapshot()).toEqual({ preference: 'light', resolved: 'light' });
  expect(painted().theme).toBe('light');

  localStorage.removeItem(THEME_STORAGE_KEY);
  window.dispatchEvent(new StorageEvent('storage', { key: THEME_STORAGE_KEY, newValue: null }));
  expect(store.getSnapshot()).toEqual({ preference: 'system', resolved: 'dark' });
  expect(writes).not.toHaveBeenCalled();

  // The same store does write a choice made here.
  store.setPreference('dark');
  expect(writes).toHaveBeenCalledWith(THEME_STORAGE_KEY, 'dark');
});

test('another tab clearing storage returns this one to System without writing back', () => {
  installSystem(false);
  localStorage.setItem(THEME_STORAGE_KEY, 'light');
  const store = createThemeStore();
  expect(painted()).toEqual({ theme: 'light', chrome: '#f3f4f6' });
  const setItem = jest.spyOn(Storage.prototype, 'setItem');
  const removeItem = jest.spyOn(Storage.prototype, 'removeItem');

  localStorage.clear();
  window.dispatchEvent(new StorageEvent('storage', { key: null }));
  expect(store.getSnapshot()).toEqual({ preference: 'system', resolved: 'dark' });
  expect(painted()).toEqual({ theme: 'dark', chrome: '#0d0b07' });
  expect(setItem).not.toHaveBeenCalled();
  expect(removeItem).not.toHaveBeenCalled();
  expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
});

test('choosing the current preference again changes and notifies nothing', () => {
  installSystem(false);
  const store = createThemeStore();
  store.setPreference('light');
  const before = store.getSnapshot();
  const listener = jest.fn();
  store.subscribe(listener);
  store.setPreference('light');
  expect(store.getSnapshot()).toBe(before);
  expect(listener).not.toHaveBeenCalled();
});

test('a switch the user makes repaints without transitions for one frame', () => {
  installSystem(false);
  const frames = [];
  jest
    .spyOn(window, 'requestAnimationFrame')
    .mockImplementation((callback) => frames.push(callback));
  const store = createThemeStore();
  store.setPreference('light');
  expect(html.hasAttribute('data-theme-switching')).toBe(true);
  frames.shift()();
  frames.shift()();
  expect(html.hasAttribute('data-theme-switching')).toBe(false);
});

// index.html's first-paint script, run as the browser runs it, against the
// store's rule for every stored choice and device scheme.
const BOOT_SCRIPT = fs
  .readFileSync(path.join(__dirname, '../../index.html'), 'utf8')
  .match(/<script>([\s\S]*?)<\/script>/)[1];

const runBootScript = () => window.eval(BOOT_SCRIPT);

test.each([
  [null, true, 'light'],
  [null, false, 'dark'],
  ['light', true, 'light'],
  ['light', false, 'light'],
  ['dark', true, 'dark'],
  ['dark', false, 'dark'],
  // Values no current build writes read as System in both.
  ['system', true, 'light'],
  ['system', false, 'dark'],
  ['sepia', true, 'light'],
  ['sepia', false, 'dark'],
])(
  'first paint with %p stored and a light device %p is %p, as the store resolves it',
  (stored, light, expected) => {
    installSystem(light);
    if (stored) localStorage.setItem('courtai:theme', stored);
    runBootScript();
    expect(painted()).toEqual({ theme: expected, chrome: THEME_COLOR[expected] });
    expect(createThemeStore().getSnapshot().resolved).toBe(expected);
  },
);

test('first paint follows the device when storage refuses', () => {
  installSystem(true);
  jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('SecurityError');
  });
  runBootScript();
  expect(painted()).toEqual({ theme: 'light', chrome: '#f3f4f6' });
});

test("the browser chrome colour of each theme is that theme's --ct-ink", () => {
  const css = fs.readFileSync(path.join(__dirname, '../theme.css'), 'utf8');
  const inkOf = (selector) =>
    css.slice(css.indexOf(selector)).match(/--ct-ink: (#[0-9a-f]{6});/)[1];
  expect(THEME_COLOR).toEqual({
    dark: inkOf(":root,\n[data-theme='dark'] {"),
    light: inkOf("[data-theme='light'] {"),
  });
});
