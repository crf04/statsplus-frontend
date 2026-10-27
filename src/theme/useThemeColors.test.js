import { act, render } from '@testing-library/react';
import { useThemeColors } from './useThemeColors';

// jsdom computes no CSS custom properties, so this stands in for the
// browser: a token's colour is the one the painted theme gives it.
const PALETTES = {
  dark: { '--ct-gold': 'rgb(232, 163, 61)', '--ct-surface-2': 'rgb(30, 26, 18)' },
  light: { '--ct-gold': 'rgb(154, 91, 6)', '--ct-surface-2': 'rgb(255, 255, 255)' },
};
const computedColor = (element) => {
  const theme = document.documentElement.getAttribute('data-theme') || 'dark';
  return { color: PALETTES[theme][element.style.color.match(/var\((--[\w-]+)\)/)[1]] };
};

const REQUEST = { label: '--ct-gold', ground: '--ct-surface-2' };

const renderHook = () => {
  const seen = [];
  const Probe = () => {
    seen.push(useThemeColors(REQUEST));
    return null;
  };
  const view = render(<Probe />);
  return { seen, rerender: () => view.rerender(<Probe />) };
};

beforeEach(() => {
  jest.spyOn(window, 'getComputedStyle').mockImplementation(computedColor);
});

afterEach(() => {
  document.documentElement.removeAttribute('data-theme');
  jest.restoreAllMocks();
});

test('resolves each token for the painted theme and keeps the object while it stays', () => {
  const { seen, rerender } = renderHook();
  rerender();
  expect(seen[0]).toEqual({ label: 'rgb(232, 163, 61)', ground: 'rgb(30, 26, 18)' });
  expect(seen[1]).toBe(seen[0]);
});

test('a new html[data-theme] gives new colours in a new object', async () => {
  const { seen } = renderHook();
  await act(async () => {
    document.documentElement.setAttribute('data-theme', 'light');
  });
  expect(seen.at(-1)).toEqual({ label: 'rgb(154, 91, 6)', ground: 'rgb(255, 255, 255)' });
  expect(seen.at(-1)).not.toBe(seen[0]);
});
