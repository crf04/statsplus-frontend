// Ported from e2e/specs/connect.spec.js, retired 2026-10-16 (see MIGRATION.md).
// Titles are the source titles, in source order.
import { expect } from 'e2e';
import { signedOutTest } from './support/courtai.ts';

const CONNECTOR_URL = 'https://mcp.courtai.app/mcp';

signedOutTest(
  'a signed-out visitor can copy the connector URL by hand or with the button',
  async ({ app, screen, browser, api }) => {
    // Browser clipboard permissions are not exposed by e2e; grant a local clipboard
    // sink so this flow checks the exact write and feedback without OS permissions.
    await browser.addInitScript(() => {
      Object.defineProperty(navigator, 'clipboard', {
        value: {
          writeText: async (text: string) => {
            window.sessionStorage.setItem('connect:clipboard', text);
          },
        },
      });
    });
    // The page is static: no request from the page or the card frame reaches the
    // connector. The route sees sub-frame requests too. The card's own HTML under
    // /mcp-cards/ is a static asset, not the connector.
    const connectorRequests: string[] = [];
    await browser.route(
      /^https?:\/\/[^/]+\/mcp(\/|\?|#|$)|statsplus-mcp-production\.up\.railway\.app/,
      async (route) => {
        connectorRequests.push(route.request.url);
        await route.fulfill({ status: 204, body: '' });
      },
    );
    await app.open('/connect');
    await expect(
      screen.getByRole('heading', 'Ask CourtAI from your chat', { level: 1 }),
    ).toBeVisible();
    await screen.getByText(CONNECTOR_URL).tap();

    expect(await browser.evaluate(() => window.getSelection()?.toString().trim() ?? '')).toBe(
      CONNECTOR_URL,
    );
    await screen.getByRole('button', 'Copy connector URL').tap();
    await expect(screen.getByRole('button', 'Copied')).toBeVisible();
    expect(await browser.evaluate(() => window.sessionStorage.getItem('connect:clipboard'))).toBe(
      CONNECTOR_URL,
    );
    await expect(screen.getByRole('button', 'Copy connector URL')).toBeVisible({ timeout: 5000 });
    expect(api.requests).toEqual([]);
    expect(connectorRequests).toEqual([]);
    await app.screenshot('connect-guide');
  },
);

signedOutTest(
  'setup steps render as numbered lists in both tabs',
  async ({ app, screen, browser }) => {
    await app.open('/connect');
    for (const client of ['Claude', 'ChatGPT']) {
      await screen.getByRole('tab', client).tap();
      await expect(screen.getByRole('tabpanel', client).getByRole('list')).toBeVisible();
      // The visible list, not both: a list styled only while hidden must not pass.
      expect(
        await browser.evaluate(() =>
          Array.from(document.querySelectorAll('.connect-steps'))
            .filter((list) => list.getClientRects().length > 0)
            .map((list) => getComputedStyle(list).listStyleType),
        ),
      ).toEqual(['decimal']);
    }
  },
);

signedOutTest(
  'the connector card renders the captured Matchup and sizes its frame',
  async ({ app, browser }) => {
    // e2e clips an iframe's bounding boxes to the frame, so the card's own height
    // is reported from inside it: the sandboxed card (no allow-same-origin) posts
    // its unclipped document height to the page, which stores it for the test.
    await browser.addInitScript(() => {
      if (window.parent === window) {
        window.addEventListener('message', (event) => {
          const height = event.data?.e2eCardHeight;
          if (typeof height === 'number') {
            window.sessionStorage.setItem('connect:card-height', String(height));
          }
        });
        return;
      }
      const report = () => {
        const root = document.documentElement;
        if (root) {
          window.parent.postMessage(
            { e2eCardHeight: Math.ceil(root.getBoundingClientRect().height) },
            '*',
          );
        }
      };
      const loop = () => {
        report();
        window.setTimeout(loop, 50);
      };
      loop();
    });
    await app.open('/connect');

    const frame = browser.frameLocator('iframe[title^="CourtAI Matchup card"]');
    await expect(frame.getByText('Cade Cunningham').first()).toBeVisible();
    await expect(frame.getByText(/Unscheduled Matchup/).first()).toBeVisible();
    await expect(frame.getByText(/State this once/)).toHaveCount(0);

    // The frame follows the card's own size report; a frame stuck at the
    // initial 560px would clip it or leave a gap.
    await expect
      .poll(() =>
        browser.evaluate(() => {
          const outer = document
            .querySelector('iframe[title^="CourtAI Matchup card"]')
            ?.getBoundingClientRect().height;
          const inner = Number(window.sessionStorage.getItem('connect:card-height'));
          return outer !== undefined && inner > 0 && Math.abs(outer - inner) <= 2 && inner !== 560;
        }),
      )
      .toBe(true);

    // The source ran at 1280px only. The card puts the court beside the Bases above
    // 520px of frame width (public/mcp-cards/matchup.html) and stacks them below it.
    // The layout comes from the target's viewport, not the measured frame, so a frame
    // squeezed on desktop fails. Desktop is 1440px wide and phone 390px.
    const wide = await browser.evaluate(() => window.innerWidth >= 768);
    const court = await frame.locator('.court >> nth=0').boundingBox();
    const bases = await frame.getByText('Play types · PTS', { exact: false }).first().boundingBox();
    expect(court).not.toBeNull();
    expect(bases).not.toBeNull();
    if (wide) {
      expect(bases!.x).toBeGreaterThan(court!.x + court!.width - 1);
    } else {
      expect(bases!.y).toBeGreaterThan(court!.y + court!.height - 1);
    }
  },
);

signedOutTest(
  'the guide links its five lessons, folds its replays and opens all 21 capabilities',
  async ({ app, screen, browser }) => {
    await app.open('/connect');

    const contents = screen.getByRole('navigation', 'In this guide');
    const lessons = [
      ['Connect CourtAI', '#guide-setup'],
      ['Ask one question', '#guide-ask'],
      ['Hand it an outcome', '#guide-outcome'],
      ['Let it run the research', '#guide-research'],
      ['Everything it can do', '#guide-tools'],
    ];
    await expect(contents.getByRole('link')).toHaveCount(lessons.length);
    await expect(screen.getByRole('heading', { level: 2 })).toHaveCount(lessons.length);
    for (const [index, [title, href]] of lessons.entries()) {
      await expect(contents.getByRole('link').nth(index)).toHaveAccessibleName(title);
      await expect(contents.getByRole('link').nth(index)).toHaveAttribute('href', href);
      await expect(screen.getByRole('heading', { level: 2 }).nth(index)).toHaveAccessibleName(
        title,
      );
    }

    const outcome = screen.getByRole('region', 'Hand it an outcome');
    await expect(outcome.getByRole('tab', 'Scan the injury report')).toBeHidden();
    await outcome.getByText('Step through four runs').tap();
    await expect(outcome.getByRole('tab', 'Scan the injury report')).toBeVisible();

    await contents.getByRole('link', 'Everything it can do').tap();
    await expect(browser).toHaveURL(/#guide-tools$/);
    const tools = screen.getByRole('region', 'Everything it can do');
    await expect(tools.getByRole('heading', { level: 4 })).toHaveCount(6);
    await tools.getByRole('button', 'Show all 21 (15 more)').tap();
    await expect(tools.getByRole('heading', { level: 4 })).toHaveCount(21);
    await expect(tools.getByRole('button', 'Show all 21 (15 more)')).toHaveCount(0);
  },
);

signedOutTest('the home page points to the Connect page', async ({ app, screen, browser }) => {
  await app.open('/');

  await screen.getByRole('link', 'New Ask CourtAI in Claude or ChatGPT').tap();
  await expect(browser).toHaveURL(/\/connect$/);
  await expect(
    screen.getByRole('heading', 'Ask CourtAI from your chat', { level: 1 }),
  ).toBeVisible();
});
