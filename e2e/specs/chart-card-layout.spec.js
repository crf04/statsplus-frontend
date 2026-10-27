import { expect, test } from '../fixtures/courtai';

// Every value, comparison and corner note sits inside its own card, at the
// widths where the chart column is widest, two thirds of a tablet, and a phone.
const overflows = (page) =>
  page.locator('.metrics-row').evaluate((row) =>
    [...row.querySelectorAll('.metric-card')].flatMap((card) => {
      const box = card.getBoundingClientRect();
      return [...card.querySelectorAll('.metric-title, .metric-value, .metric-corner')]
        .map((part) => {
          // The text's own extent: a block keeps the card's width while its
          // unwrapped text runs past it.
          const text = document.createRange();
          text.selectNodeContents(part);
          return { part, edge: text.getBoundingClientRect() };
        })
        .filter(({ edge }) => edge.left < box.left - 0.5 || edge.right > box.right + 0.5)
        .map(({ part }) => part.textContent);
    }),
  );

for (const [label, size] of [
  ['desktop', { width: 1440, height: 900 }],
  ['tablet', { width: 768, height: 1024 }],
  ['phone', { width: 390, height: 844 }],
]) {
  test(`the stat cards fit their content on a ${label}`, async ({ authenticatedPage: page }) => {
    await page.setViewportSize(size);
    await page.goto('/?player_name=Stephen+Curry');
    await expect(page.locator('.metric-card')).toHaveCount(3);
    await expect(page.locator('.metric-card').first()).toContainText('PTS avg');
    expect(await overflows(page)).toEqual([]);
  });
}
