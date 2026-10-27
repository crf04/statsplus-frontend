// Every element's computed colour, base checkout vs this one, on the main
// routes at desktop and phone width. Dark is unchanged when no entry differs.
// Canvas charts compare by their pixels. Each test logs its count and writes
// its differences beside its output.
import fs from 'node:fs';
import { expect, test } from '@playwright/test';
import {
  E2E_AUTH_STORAGE_KEY,
  HISTORICAL_GAME_ID,
  installApiContract,
} from '../../../e2e/fixtures/courtai-contract.mjs';
import { installParityApi, PARITY_PATH } from '../../../e2e/filterPanelParity/fixture.js';

const ORIGINS = {
  base: `http://127.0.0.1:${process.env.PARITY_BASE_PORT || '4401'}`,
  head: `http://127.0.0.1:${process.env.PARITY_HEAD_PORT || '4402'}`,
};
const VIEWPORTS = { desktop: { width: 1440, height: 1000 }, phone: { width: 390, height: 844 } };

const PROPERTIES = [
  'color',
  'background-color',
  'background-image',
  'border-top-color',
  'border-right-color',
  'border-bottom-color',
  'border-left-color',
  'outline-color',
  'box-shadow',
  'text-shadow',
  'text-decoration-color',
  'caret-color',
  'column-rule-color',
  'fill',
  'stroke',
  'stop-color',
  'flood-color',
  'accent-color',
  'scrollbar-color',
  '-webkit-text-fill-color',
  '-webkit-text-stroke-color',
  'mask-image',
  '-webkit-mask-image',
  'color-scheme',
  'opacity',
];

// A two-category Playtypes profile, so the Player Profile draws its chart.
const PROFILE = {
  '/api/players/profile': () => ({ body: { 'PRBallHandler%': 31.4, 'Isolation%': 17.8 } }),
  '/api/teams/stats': () => ({
    body: { PRBallHandler: 1.14, PRBallHandler_RANK: 27, Isolation: 0.86, Isolation_RANK: 4 },
  }),
};

const open = async (page, url) => {
  await page.goto(url);
  await page.waitForLoadState('networkidle');
};

const ROUTES = {
  'public home': {
    signedIn: false,
    visit: async (page, origin) => {
      await installApiContract(page);
      await open(page, `${origin}/`);
    },
  },
  'signed-in home': {
    visit: async (page, origin) => {
      await installApiContract(page);
      await open(page, `${origin}/`);
    },
  },
  'Log Workspace, filter panel and an editor open': {
    visit: async (page, origin) => {
      await installParityApi(page);
      await open(page, `${origin}${PARITY_PATH}`);
      const panel = page.getByTestId('filter-panel');
      await expect(panel.getByText(/of 72 games match/i)).toBeVisible();
      await panel.getByRole('button', { name: '+ Opp. defense' }).click();
    },
  },
  'Log Workspace with charts': {
    visit: async (page, origin) => {
      await installApiContract(page, PROFILE);
      await open(page, `${origin}/?player_name=LeBron+James`);
      await expect(page.locator('.chart-container canvas')).toBeVisible();
      await expect(
        page
          .getByRole('img', { name: 'Playtype frequency and team defense chart' })
          .locator('canvas'),
      ).toBeVisible();
    },
  },
  Slate: {
    visit: async (page, origin) => {
      await installApiContract(page);
      await open(page, `${origin}/matchups?date=2026-01-15`);
    },
  },
  'Matchup detail with a player open': {
    visit: async (page, origin) => {
      await installApiContract(page);
      await open(page, `${origin}/matchups/0022500584`);
      const rail = page.getByRole('complementary', { name: 'Targetable players' });
      await rail.getByRole('article', { name: 'LeBron James player' }).click();
      await page.waitForLoadState('networkidle');
    },
  },
  'Historical Matchup': {
    visit: async (page, origin) => {
      await installApiContract(page);
      await open(page, `${origin}/matchups/${HISTORICAL_GAME_ID}`);
    },
  },
  Targets: {
    visit: async (page, origin) => {
      await installApiContract(page);
      await open(page, `${origin}/targets`);
    },
  },
  Connect: {
    visit: async (page, origin) => {
      await installApiContract(page);
      await open(page, `${origin}/connect`);
    },
  },
  'Query reference': {
    visit: async (page, origin) => {
      await installApiContract(page);
      await open(page, `${origin}/help`);
    },
  },
};

// Runs in the page: computed colours keyed by DOM path, pseudo-elements
// included, and a fingerprint of each canvas's pixels once it stops changing.
const capture = async (page) => {
  await page.mouse.move(0, 0);
  await page.evaluate(() => document.fonts.ready);
  return page.evaluate(async (properties) => {
    const fingerprint = (text) => {
      let hash = 5381;
      for (let i = 0; i < text.length; i += 1) hash = (hash * 33) ^ text.charCodeAt(i);
      return `${text.length}:${hash >>> 0}`;
    };
    const canvases = () =>
      [...document.querySelectorAll('canvas')].map((c) => fingerprint(c.toDataURL()));
    let previous = canvases();
    for (let i = 0; i < 40; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      const next = canvases();
      if (JSON.stringify(next) === JSON.stringify(previous)) break;
      previous = next;
    }
    const pathOf = (element) => {
      const parts = [];
      for (let node = element; node && node.nodeType === 1; node = node.parentElement) {
        const index = node.parentElement ? [...node.parentElement.children].indexOf(node) : 0;
        parts.unshift(`${node.localName}[${index}]`);
      }
      return parts.join('/');
    };
    const styles = {};
    for (const element of document.querySelectorAll('*')) {
      const key = pathOf(element);
      for (const pseudo of ['', '::before', '::after']) {
        const style = getComputedStyle(element, pseudo || null);
        if (pseudo && (style.content === 'none' || style.content === 'normal')) continue;
        for (const property of properties) {
          styles[`${key}${pseudo} ${property}`] = style.getPropertyValue(property);
        }
      }
    }
    previous.forEach((print, i) => {
      styles[`canvas#${i} pixels`] = print;
    });
    return styles;
  }, PROPERTIES);
};

for (const [route, { signedIn = true, visit }] of Object.entries(ROUTES)) {
  for (const [viewportName, viewport] of Object.entries(VIEWPORTS)) {
    test(`${route} at ${viewportName} width computes the same colours as the base`, async ({
      browser,
    }, testInfo) => {
      const results = {};
      for (const [side, origin] of Object.entries(ORIGINS)) {
        const context = await browser.newContext({ viewport, reducedMotion: 'reduce' });
        const page = await context.newPage();
        if (signedIn) {
          await page.addInitScript(
            (key) => window.localStorage.setItem(key, 'true'),
            E2E_AUTH_STORAGE_KEY,
          );
        }
        // Freeze transitions so both sides are read at their resting colours.
        await page.addInitScript(() => {
          document.addEventListener('DOMContentLoaded', () => {
            const style = document.createElement('style');
            style.textContent =
              '*, *::before, *::after { transition: none !important; animation: none !important; }';
            document.head.appendChild(style);
          });
        });
        await visit(page, origin);
        results[side] = await capture(page);
        await context.close();
      }
      const keys = new Set([...Object.keys(results.base), ...Object.keys(results.head)]);
      const differences = [...keys]
        .filter((key) => results.base[key] !== results.head[key])
        .map((key) => ({ key, base: results.base[key], head: results.head[key] }));
      const entries = Object.keys(results.head).length;
      fs.writeFileSync(
        testInfo.outputPath('differences.json'),
        `${JSON.stringify({ route, viewport: viewportName, entries, differences }, null, 2)}\n`,
      );
      console.log(
        `PARITY ${route} | ${viewportName} | ${entries} entries | ${differences.length} differ`,
      );
      expect(Object.keys(results.base).length).toBeGreaterThan(1000);
      expect(differences.slice(0, 20)).toEqual([]);
    });
  }
}
