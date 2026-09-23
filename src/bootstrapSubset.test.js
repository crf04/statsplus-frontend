/**
 * @jest-environment node
 */
import fs from 'node:fs';
import path from 'node:path';
import postcss from 'postcss';
import * as sass from 'sass';

// Guards src/bootstrap-subset.scss against drift. Every rule in Bootstrap's
// published stylesheet that can match markup the source renders must be
// emitted by the subset, declaration for declaration. A class counts as
// rendered when it appears in a string literal in src, when a template
// literal can build it from a static prefix, or when a react-bootstrap
// component used in src emits it for the props it is given.

const root = process.cwd();
const srcDir = path.join(root, 'src');
const referenceCss = path.join(root, 'node_modules/bootstrap/dist/css/bootstrap.css');
const subsetScss = path.join(srcDir, 'bootstrap-subset.scss');

const THEME_COLORS = [
  'primary',
  'secondary',
  'success',
  'info',
  'warning',
  'danger',
  'light',
  'dark',
];
const BREAKPOINTS = ['xs', 'sm', 'md', 'lg', 'xl', 'xxl'];
const DYNAMIC = Symbol('dynamic');

// Autoprefixer output in the published file; Vite's own PostCSS adds the
// prefixes the app's browser targets need to the subset.
const VENDOR = /^-(webkit|moz|ms|o)-/;
const isVendorSelector = (selector) => /::?-(webkit|moz|ms|o)-/.test(selector);
const isVendorDecl = (decl) =>
  VENDOR.test(decl.prop) || VENDOR.test(decl.value) || decl.prop === 'color-adjust';

const sourceFiles = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.jsx?$/.test(entry.name) && !/\.test\.jsx?$|^setupTests\.js$/.test(entry.name)
      ? [full]
      : [];
  });

const contextOf = (node) => {
  const context = [];
  for (let parent = node.parent; parent && parent.type !== 'root'; parent = parent.parent) {
    if (parent.type === 'atrule') {
      context.unshift(`@${parent.name} ${parent.params.replace(/\s+/g, ' ')}`);
    }
  }
  return context.join(' ');
};

const normalizeSelector = (selector) => selector.replace(/\s+/g, ' ').trim();

// Classes a selector requires, ignoring those it only excludes via :not().
const requiredClasses = (selector) => {
  let stripped = selector;
  for (let previous; previous !== stripped;) {
    previous = stripped;
    stripped = stripped.replace(/:not\([^()]*(\([^()]*\)[^()]*)*\)/g, '');
  }
  return [...stripped.replace(/\[[^\]]*\]/g, '').matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)].map(
    (match) => match[1],
  );
};

// One entry per (at-rule context, single selector, declaration).
const flatten = (css) => {
  const entries = [];
  postcss.parse(css).walkDecls((decl) => {
    if (decl.parent.type !== 'rule' || isVendorDecl(decl)) return;
    const keyframes =
      decl.parent.parent.type === 'atrule' && /keyframes$/.test(decl.parent.parent.name);
    for (const rawSelector of decl.parent.selectors) {
      const selector = normalizeSelector(rawSelector);
      if (isVendorSelector(selector)) continue;
      entries.push({
        key: `${contextOf(decl.parent)} ${selector} { ${decl.prop}: ${decl.value.replace(/\s+/g, ' ')}${decl.important ? ' !important' : ''} }`,
        selector,
        keyframes: keyframes ? decl.parent.parent.params : null,
        value: decl.value,
      });
    }
  });
  return entries;
};

const allClasses = (entries) =>
  new Set(entries.flatMap((entry) => (entry.keyframes ? [] : requiredClasses(entry.selector))));

// Bootstrap rules that apply when exactly `used` classes can be rendered.
const liveEntries = (reference, used) => {
  const live = reference.filter(
    (entry) => !entry.keyframes && requiredClasses(entry.selector).every((name) => used.has(name)),
  );
  const values = live.map((entry) => entry.value).join(' ');
  return live.concat(
    reference.filter(
      (entry) => entry.keyframes && new RegExp(`\\b${entry.keyframes}\\b`).test(values),
    ),
  );
};

const missingFromSubset = (reference, subset, used) => {
  const emitted = new Set(subset.map((entry) => entry.key));
  return [...new Set(liveEntries(reference, used).map((entry) => entry.key))].filter(
    (key) => !emitted.has(key),
  );
};

// Tiny JSX scanner: the attribute text of each `<Name ...>` opening tag.
const openingTags = (source, name) => {
  const tags = [];
  const pattern = new RegExp(`<${name.replace('.', '\\.')}(?![\\w.])`, 'g');
  while (pattern.exec(source)) {
    let depth = 0;
    let quote = null;
    let index = pattern.lastIndex;
    for (; index < source.length; index += 1) {
      const char = source[index];
      if (quote) {
        if (char === '\\') index += 1;
        else if (char === quote) quote = null;
      } else if (char === '"' || char === "'" || char === '`') quote = char;
      else if (char === '{') depth += 1;
      else if (char === '}') depth -= 1;
      else if (char === '>' && depth === 0) break;
    }
    tags.push(source.slice(pattern.lastIndex, index).replace(/\/$/, ''));
  }
  return tags;
};

const parseAttributes = (text) => {
  const attributes = {};
  let index = 0;
  while (index < text.length) {
    const name = /^\s*([A-Za-z_][\w-]*)/.exec(text.slice(index));
    if (!name) {
      index += 1;
      continue;
    }
    index += name[0].length;
    const rest = text.slice(index);
    const literal =
      /^\s*=\s*(?:"([^"]*)"|'([^']*)'|\{\s*(?:'([^']*)'|"([^"]*)"|(-?\d+|true|false))\s*\})/.exec(
        rest,
      );
    if (literal) {
      const value = literal.slice(1).find((part) => part !== undefined);
      attributes[name[1]] = value === 'true' ? true : value === 'false' ? false : value;
      index += literal[0].length;
    } else if (/^\s*=\s*\{/.test(rest)) {
      let depth = 0;
      let cursor = rest.indexOf('{');
      for (; cursor < rest.length; cursor += 1) {
        if (rest[cursor] === '{') depth += 1;
        if (rest[cursor] === '}' && (depth -= 1) === 0) break;
      }
      attributes[name[1]] = DYNAMIC;
      index += cursor + 1;
    } else {
      attributes[name[1]] = true;
    }
  }
  return attributes;
};

const valuesOf = (value, everyValue, fallback) => {
  if (value === undefined || value === false) return fallback === undefined ? [] : [fallback];
  if (value === DYNAMIC) return everyValue;
  return [String(value)];
};

const buttonClasses = (attrs) => [
  'btn',
  'active',
  'disabled',
  ...valuesOf(
    attrs.variant,
    [...THEME_COLORS, ...THEME_COLORS.map((color) => `outline-${color}`), 'link'],
    'primary',
  ).map((variant) => `btn-${variant}`),
  ...valuesOf(attrs.size, ['sm', 'lg']).map((size) => `btn-${size}`),
];

const gridClasses = (prefix, attrs) =>
  BREAKPOINTS.flatMap((breakpoint) => {
    const value = attrs[breakpoint];
    if (value === undefined) return [];
    if (typeof value !== 'string' && value !== true) {
      throw new Error(`Give <${prefix}> a literal ${breakpoint} so its grid class is known.`);
    }
    const infix = breakpoint === 'xs' ? '' : `-${breakpoint}`;
    return [value === true ? `${prefix}${infix}` : `${prefix}${infix}-${value}`];
  });

// Classes each react-bootstrap component can add for the props it is given.
const COMPONENT_CLASSES = {
  Alert: (attrs) => [
    'alert',
    'fade',
    'show',
    ...valuesOf(attrs.variant, THEME_COLORS, 'primary').map((variant) => `alert-${variant}`),
    ...(attrs.dismissible ? ['alert-dismissible', 'btn-close'] : []),
  ],
  Badge: (attrs) => [
    'badge',
    ...valuesOf(attrs.bg, THEME_COLORS, 'primary').map((color) => `bg-${color}`),
    ...valuesOf(attrs.text, THEME_COLORS).map((color) => `text-${color}`),
    ...(attrs.pill ? ['rounded-pill'] : []),
  ],
  Button: buttonClasses,
  Card: (attrs) => [
    'card',
    ...valuesOf(attrs.bg, THEME_COLORS).map((color) => `bg-${color}`),
    ...valuesOf(attrs.text, THEME_COLORS).map((color) => `text-${color}`),
    ...valuesOf(attrs.border, THEME_COLORS).map((color) => `border-${color}`),
  ],
  'Card.Body': () => ['card-body'],
  Col: (attrs) => {
    const sized = gridClasses('col', attrs);
    return sized.length ? sized : ['col'];
  },
  Container: (attrs) => [
    attrs.fluid === true
      ? 'container-fluid'
      : attrs.fluid
        ? `container-${attrs.fluid}`
        : 'container',
  ],
  Dropdown: (attrs) => [
    'dropdown',
    'show',
    ...(attrs.drop ? [`drop${attrs.drop}`] : []),
    ...(attrs.align === 'end' ? ['dropdown-menu-end'] : []),
    ...(attrs.align && attrs.align !== 'end' && attrs.align !== 'start'
      ? [`dropdown-menu-${attrs.align}`]
      : []),
  ],
  'Dropdown.Item': () => ['dropdown-item', 'active', 'disabled'],
  'Dropdown.Menu': (attrs) => [
    'dropdown-menu',
    'show',
    ...(attrs.align === 'end' ? ['dropdown-menu-end'] : []),
    ...valuesOf(attrs.variant, ['dark']).map((variant) => `dropdown-menu-${variant}`),
  ],
  'Dropdown.Toggle': (attrs) => [
    'dropdown-toggle',
    'show',
    ...(attrs.split ? ['dropdown-toggle-split'] : []),
    ...buttonClasses(attrs),
  ],
  Form: (attrs) => (attrs.validated ? ['was-validated'] : []),
  'Form.Control': (attrs) => COMPONENT_CLASSES.FormControl(attrs),
  'Form.Group': () => [],
  'Form.Label': (attrs) => [
    attrs.column ? 'col-form-label' : 'form-label',
    ...(attrs.visuallyHidden ? ['visually-hidden'] : []),
  ],
  'Form.Select': (attrs) => [
    'form-select',
    ...valuesOf(attrs.size, ['sm', 'lg']).map((size) => `form-select-${size}`),
    ...(attrs.isValid ? ['is-valid'] : []),
    ...(attrs.isInvalid ? ['is-invalid'] : []),
  ],
  FormControl: (attrs) => [
    attrs.plaintext ? 'form-control-plaintext' : 'form-control',
    ...valuesOf(attrs.size, ['sm', 'lg']).map((size) => `form-control-${size}`),
    ...(attrs.type === 'color' || attrs.type === DYNAMIC ? ['form-control-color'] : []),
    ...(attrs.isValid ? ['is-valid'] : []),
    ...(attrs.isInvalid ? ['is-invalid'] : []),
  ],
  InputGroup: (attrs) => [
    'input-group',
    ...valuesOf(attrs.size, ['sm', 'lg']).map((size) => `input-group-${size}`),
    ...(attrs.hasValidation ? ['has-validation'] : []),
  ],
  ListGroup: (attrs) => [
    'list-group',
    ...valuesOf(attrs.variant, ['flush']).map((variant) => `list-group-${variant}`),
    ...(attrs.numbered ? ['list-group-numbered'] : []),
    ...(attrs.horizontal ? ['list-group-horizontal'] : []),
  ],
  'ListGroup.Item': (attrs) => [
    'list-group-item',
    'active',
    'disabled',
    ...(attrs.action ? ['list-group-item-action'] : []),
    ...valuesOf(attrs.variant, THEME_COLORS).map((variant) => `list-group-item-${variant}`),
  ],
  Modal: (attrs) => [
    'modal',
    'fade',
    'show',
    'modal-backdrop',
    'modal-dialog',
    'modal-content',
    ...(attrs.backdrop === 'static' || attrs.backdrop === DYNAMIC ? ['modal-static'] : []),
    ...(attrs.centered ? ['modal-dialog-centered'] : []),
    ...(attrs.scrollable ? ['modal-dialog-scrollable'] : []),
    ...valuesOf(attrs.size, ['sm', 'lg', 'xl']).map((size) => `modal-${size}`),
    ...(attrs.fullscreen === true ? ['modal-fullscreen'] : []),
    ...(typeof attrs.fullscreen === 'string' ? [`modal-fullscreen-${attrs.fullscreen}`] : []),
  ],
  'Modal.Body': () => ['modal-body'],
  'Modal.Footer': () => ['modal-footer'],
  'Modal.Header': (attrs) => [
    'modal-header',
    ...(attrs.closeButton ? ['btn-close'] : []),
    ...valuesOf(attrs.closeVariant, ['white']).map((variant) => `btn-close-${variant}`),
  ],
  'Modal.Title': () => ['modal-title'],
  OverlayTrigger: () => [],
  Row: (attrs) => ['row', ...gridClasses('row-cols', attrs)],
  Spinner: (attrs) => {
    const animations = valuesOf(attrs.animation, ['border', 'grow'], 'border');
    return animations.flatMap((animation) => [
      `spinner-${animation}`,
      ...valuesOf(attrs.size, ['sm']).map((size) => `spinner-${animation}-${size}`),
      ...valuesOf(attrs.variant, THEME_COLORS).map((color) => `text-${color}`),
    ]);
  },
  Table: (attrs) => [
    'table',
    ...(attrs.striped
      ? [attrs.striped === 'columns' ? 'table-striped-columns' : 'table-striped']
      : []),
    ...(attrs.bordered ? ['table-bordered'] : []),
    ...(attrs.borderless ? ['table-borderless'] : []),
    ...(attrs.hover ? ['table-hover'] : []),
    ...valuesOf(attrs.size, ['sm']).map((size) => `table-${size}`),
    ...valuesOf(attrs.variant, THEME_COLORS).map((variant) => `table-${variant}`),
    ...(attrs.responsive === true ? ['table-responsive'] : []),
    ...(typeof attrs.responsive === 'string' ? [`table-responsive-${attrs.responsive}`] : []),
  ],
  ToggleButton: (attrs) => ['btn-check', ...buttonClasses(attrs)],
  ToggleButtonGroup: (attrs) => [
    'btn-group',
    ...(attrs.vertical ? ['btn-group-vertical'] : []),
    ...valuesOf(attrs.size, ['sm', 'lg']).map((size) => `btn-group-${size}`),
  ],
  Tooltip: () => [
    'tooltip',
    'tooltip-arrow',
    'tooltip-inner',
    'fade',
    'show',
    ...['top', 'bottom', 'start', 'end', 'auto'].map((direction) => `bs-tooltip-${direction}`),
  ],
};

// Inline `style={{ ... }}` objects hold CSS values ('visible', 'row'), never
// class names, so they are blanked before literals are read as classes.
const withoutInlineStyles = (source) => {
  let result = source;
  for (let start = result.indexOf('style={{'); start !== -1; start = result.indexOf('style={{')) {
    let depth = 0;
    let end = start + 'style='.length;
    for (; end < result.length; end += 1) {
      if (result[end] === '{') depth += 1;
      if (result[end] === '}' && (depth -= 1) === 0) break;
    }
    result = `${result.slice(0, start)}${' '.repeat(end + 1 - start)}${result.slice(end + 1)}`;
  }
  return result;
};

const usedBootstrapClasses = (files, bootstrapClasses) => {
  const used = new Set();
  const problems = [];
  const addIfBootstrap = (name) => bootstrapClasses.has(name) && used.add(name);

  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');
    const relative = path.relative(root, file);
    const literals = [
      ...withoutInlineStyles(source).matchAll(
        /'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g,
      ),
    ].map((match) => match[1] ?? match[2] ?? match[3]);
    for (const literal of literals) {
      literal.split(/[^\w-]+/).forEach(addIfBootstrap);
      // `is-${tone}` can build any Bootstrap class starting with `is-`.
      for (const [, prefix] of literal.matchAll(/(?:^|[^\w-])([a-z][\w-]*-)\$\{/g)) {
        bootstrapClasses.forEach((name) => name.startsWith(prefix) && used.add(name));
      }
    }

    if (/from 'react-bootstrap\//.test(source)) {
      problems.push(`${relative}: import react-bootstrap components from 'react-bootstrap'.`);
    }
    for (const [, specifiers] of source.matchAll(
      /import\s*\{([^}]*)\}\s*from\s*'react-bootstrap'/g,
    )) {
      for (const specifier of specifiers
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean)) {
        const [imported, local = imported] = specifier.split(/\s+as\s+/);
        const members = Object.keys(COMPONENT_CLASSES)
          .filter((name) => name.startsWith(`${imported}.`))
          .map((name) => name.slice(imported.length));
        for (const member of ['', ...members]) {
          const classesFor = COMPONENT_CLASSES[`${imported}${member}`];
          const tags = openingTags(source, `${local}${member}`);
          if (!tags.length) continue;
          if (!classesFor) {
            problems.push(`${relative}: add <${imported}${member}> to COMPONENT_CLASSES.`);
            continue;
          }
          for (const tag of tags) {
            classesFor(parseAttributes(tag)).forEach((name) => used.add(name));
          }
        }
        const unknownMembers = [...source.matchAll(new RegExp(`<${local}\\.(\\w+)`, 'g'))].filter(
          ([, member]) => !COMPONENT_CLASSES[`${imported}.${member}`],
        );
        unknownMembers.forEach(([, member]) =>
          problems.push(`${relative}: add <${imported}.${member}> to COMPONENT_CLASSES.`),
        );
      }
    }
  }
  return { used, problems };
};

describe('Bootstrap subset stylesheet', () => {
  let reference;
  let subset;
  let bootstrapClasses;

  beforeAll(() => {
    reference = flatten(fs.readFileSync(referenceCss, 'utf8'));
    bootstrapClasses = allClasses(reference);
    const { css } = sass.compile(subsetScss, {
      loadPaths: [path.join(root, 'node_modules')],
      quietDeps: true,
      logger: sass.Logger.silent,
    });
    subset = flatten(css);
  }, 30000);

  it('emits every Bootstrap rule that can match markup the source renders', () => {
    const { used, problems } = usedBootstrapClasses(sourceFiles(srcDir), bootstrapClasses);

    expect(problems).toEqual([]);
    expect(used.size).toBeGreaterThan(50);
    expect(missingFromSubset(reference, subset, used)).toEqual([]);
  });

  it('emits only declarations identical to the published Bootstrap stylesheet', () => {
    const published = new Set(reference.map((entry) => entry.key));

    expect(subset.map((entry) => entry.key).filter((key) => !published.has(key))).toEqual([]);
  });

  it('reports a Bootstrap class the subset does not emit', () => {
    const used = new Set(['btn', 'nav-link', 'd-md-none']);

    expect(missingFromSubset(reference, subset, used)).toEqual(
      expect.arrayContaining([
        expect.stringContaining('.nav-link { display: block }'),
        expect.stringContaining(
          '@media (min-width: 768px) .d-md-none { display: none !important }',
        ),
      ]),
    );
  });

  it('reads react-bootstrap props into the classes they add', () => {
    const [tag] = openingTags(
      '<Button onClick={() => a > b} variant="outline-light" size={size}>x</Button>',
      'Button',
    );

    expect(buttonClasses(parseAttributes(tag))).toEqual(
      expect.arrayContaining(['btn', 'btn-outline-light', 'btn-sm', 'btn-lg']),
    );
    expect(COMPONENT_CLASSES.Col(parseAttributes(' md={6} className="x"'))).toEqual(['col-md-6']);
    const stripped = withoutInlineStyles(
      `<div style={{ a: { b: 'visible' } }} className="d-flex" />`,
    );
    expect(stripped).not.toContain('visible');
    expect(stripped).toMatch(/^<div\s+className="d-flex" \/>$/);
  });
});
