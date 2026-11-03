import { expect, test } from '../fixtures/courtai';

// Every title, value and corner note sits inside its own card without touching
// another, at desktop widths, around the strip's narrow threshold, and on a phone.
const collisions = (page) =>
  page.locator('.metrics-row').evaluate((row) =>
    [...row.querySelectorAll('.metric-card')].flatMap((card) => {
      const box = card.getBoundingClientRect();
      // The text's own extent: a block keeps the card's width while its
      // unwrapped text runs past it.
      const parts = [...card.querySelectorAll('.metric-title, .metric-value, .metric-corner')].map(
        (part) => {
          const text = document.createRange();
          text.selectNodeContents(part);
          return { name: part.textContent, edge: text.getBoundingClientRect() };
        },
      );
      const outside = parts
        .filter(({ edge }) => edge.left < box.left - 0.5 || edge.right > box.right + 0.5)
        .map(({ name }) => `outside: ${name}`);
      const touching = parts.flatMap((a, i) =>
        parts
          .slice(i + 1)
          .filter(
            (b) =>
              a.edge.left < b.edge.right &&
              b.edge.left < a.edge.right &&
              a.edge.top < b.edge.bottom &&
              b.edge.top < a.edge.bottom,
          )
          .map((b) => `overlap: ${a.name} / ${b.name}`),
      );
      return [...outside, ...touching];
    }),
  );

for (const width of [1920, 1440, 1280, 992, 768, 576, 390]) {
  test(`the stat cards fit their text at ${width}px`, async ({ authenticatedPage: page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/?player_name=Stephen+Curry');
    await expect(page.locator('.metric-card')).toHaveCount(3);
    await expect(page.locator('.metric-card').first()).toContainText('PTS avg');
    expect(await collisions(page)).toEqual([]);
  });
}
