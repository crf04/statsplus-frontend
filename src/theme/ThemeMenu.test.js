import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// The document's one store reads the device scheme when it loads, so the
// device is in place before the menu's modules are.
const device = { matches: true, listeners: [] };
window.matchMedia = () => ({
  get matches() {
    return device.matches;
  },
  addEventListener: (type, listener) => device.listeners.push(listener),
});
const { default: ThemeMenu } = require('./ThemeMenu');
const { themeStore } = require('./useTheme');

const html = document.documentElement;
const toggle = (name) => screen.getByRole('button', { name });
const choice = (name) => screen.getByRole('menuitemradio', { name });
// The menu places itself in an effect; let it settle.
const settle = () => act(async () => {});
const open = async (name) => {
  userEvent.click(toggle(name));
  await settle();
};
const pick = async (name) => {
  userEvent.click(choice(name));
  await settle();
};
const switchDevice = (light) =>
  act(() => {
    device.matches = light;
    device.listeners.forEach((listener) => listener({ matches: light }));
  });

beforeEach(() => {
  switchDevice(true);
  act(() => themeStore.setPreference('system'));
  localStorage.clear();
});

test('the button names the preference, System with the theme it resolves to', () => {
  render(<ThemeMenu />);
  expect(toggle('Appearance: System (Light)')).toBeInTheDocument();
  switchDevice(false);
  expect(toggle('Appearance: System (Dark)')).toBeInTheDocument();
  expect(html).toHaveAttribute('data-theme', 'dark');
});

test('choosing Dark paints dark, stores it, and checks Dark', async () => {
  render(<ThemeMenu />);
  await open('Appearance: System (Light)');
  expect(choice(/System/)).toHaveAttribute('aria-checked', 'true');
  expect(choice(/System/)).toHaveTextContent('SystemLight');

  await pick('Dark');
  expect(html).toHaveAttribute('data-theme', 'dark');
  expect(localStorage.getItem('courtai:theme')).toBe('dark');

  await open('Appearance: Dark');
  expect(choice('Dark')).toHaveAttribute('aria-checked', 'true');
  expect(choice('System')).toHaveAttribute('aria-checked', 'false');
});

test('the radio items carry aria-checked only; menuitemradio does not take aria-selected', async () => {
  render(<ThemeMenu />);
  await open('Appearance: System (Light)');
  const items = screen.getAllByRole('menuitemradio');
  expect(items.map((item) => item.getAttribute('aria-checked'))).toEqual([
    'true',
    'false',
    'false',
  ]);
  for (const item of items) expect(item).not.toHaveAttribute('aria-selected');
});

test('choosing System again forgets the choice and follows the device', async () => {
  render(<ThemeMenu />);
  await open('Appearance: System (Light)');
  await pick('Dark');
  await open('Appearance: Dark');
  await pick(/System/);
  expect(html).toHaveAttribute('data-theme', 'light');
  expect(localStorage.getItem('courtai:theme')).toBeNull();
  expect(toggle('Appearance: System (Light)')).toBeInTheDocument();
});

test('the keyboard opens it, moves through the choices, selects, and Escape returns focus', async () => {
  render(<ThemeMenu />);
  userEvent.tab();
  expect(toggle('Appearance: System (Light)')).toHaveFocus();
  userEvent.keyboard('{ArrowDown}');
  await settle();
  expect(screen.getByRole('menu', { name: /^Appearance/ })).toBeInTheDocument();
  expect(choice(/System/)).toHaveFocus();
  userEvent.keyboard('{ArrowDown}{ArrowDown}');
  expect(choice('Dark')).toHaveFocus();
  userEvent.keyboard('{Enter}');
  await settle();
  expect(html).toHaveAttribute('data-theme', 'dark');
  expect(localStorage.getItem('courtai:theme')).toBe('dark');
  expect(toggle('Appearance: Dark')).toHaveFocus();

  userEvent.keyboard('{ArrowDown}');
  await settle();
  expect(choice(/System/)).toHaveFocus();
  userEvent.keyboard('{Escape}');
  await settle();
  expect(toggle('Appearance: Dark')).toHaveFocus();
  expect(toggle('Appearance: Dark')).toHaveAttribute('aria-expanded', 'false');
});
