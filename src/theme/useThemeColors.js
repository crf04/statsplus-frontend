import { useMemo, useSyncExternalStore } from 'react';

// Canvas cannot read CSS variables, so charts take concrete colours: each
// --ct-* token as the browser computes it for the painted theme. A hidden
// probe inherits the root tokens and reports `color`, which resolves nested
// var() and calc() alpha the way CSS paints them.

const paintedTheme = () => document.documentElement.getAttribute('data-theme') || 'dark';

const subscribe = (onChange) => {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  return () => observer.disconnect();
};

// { key: [role, '--ct-token'] } → { key: 'rgb(…)' } for the theme painted
// now. The role (fg, line, fill) is for the colour lint, which checks the
// token plays it.
export const resolveThemeColors = (request) => {
  const probe = document.createElement('span');
  probe.style.display = 'none';
  document.body.appendChild(probe);
  const colors = {};
  for (const [key, [, token]] of Object.entries(request)) {
    probe.style.color = `var(${token})`;
    colors[key] = getComputedStyle(probe).color;
  }
  probe.remove();
  return Object.freeze(colors);
};

// The same, as a value that changes exactly when the painted theme does, so a
// chart whose data and options memoise on it redraws in place. Pass a
// module-level request object: a new object each render re-resolves.
export const useThemeColors = (request) => {
  const theme = useSyncExternalStore(subscribe, paintedTheme, () => 'dark');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => resolveThemeColors(request), [request, theme]);
};
