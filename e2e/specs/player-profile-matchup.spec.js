import { expect, test } from '../fixtures/courtai';

// The fixture's Unscheduled Matchup is Toumani Camara vs DEN as production served it on
// 2026-11-06, answered under the asked player's name against the page's opponent.

const profileCard = (page) =>
  page.locator('.dark-card', {
    has: page.getByRole('heading', { name: 'Player Profile', exact: true }),
  });
const opponentCard = (page) =>
  page.locator('.dark-card', {
    has: page.getByRole('heading', { name: 'Opposing Team Profile' }),
  });

// Nothing inside the card reaches past its right edge.
const overflow = (card) =>
  card.evaluate((element) => {
    const edge = element.getBoundingClientRect().right + 1;
    return [...element.querySelectorAll('*')].filter(
      (node) => node.getBoundingClientRect().right > edge,
    ).length;
  });

// The card ends where its content does (less its own padding), rather than at the row's height.
const emptySpaceBelow = (card) =>
  card.evaluate((element) => {
    const body = element.querySelector('.card-body');
    const last = body.lastElementChild.getBoundingClientRect().bottom;
    return (
      element.getBoundingClientRect().bottom -
      last -
      parseFloat(getComputedStyle(body).paddingBottom)
    );
  });

const rowCells = (row) =>
  row.locator('.pmc-row-name, .pmc-row-share, .pmc-rank, .pmc-row-vs').allTextContents();

for (const viewport of [
  { width: 1440, height: 1000 },
  { width: 390, height: 844 },
]) {
  test(`PTS reads the MCP card with its court, no tabs and no sideways scroll at ${viewport.width}px`, async ({
    authenticatedPage: page,
  }) => {
    await page.setViewportSize(viewport);
    const matchup = page.waitForResponse('**/api/matchups/unscheduled**');
    await page.goto('/?player_name=LeBron+James');
    const card = profileCard(page);
    await expect((await matchup).status()).toBe(200);

    await expect(card.getByText('Where his PTS come from')).toBeVisible();
    await expect(card.getByTitle('PTS Season Matchup Score')).toHaveText('+2.0%');
    await expect(card.getByRole('radio')).toHaveCount(0);
    const playTypes = card.getByRole('list', { name: 'Play types' });
    expect(await rowCells(playTypes.getByRole('listitem').first())).toEqual([
      'Spot up',
      '41%',
      '27th',
      '+10%',
    ]);
    await expect(card.getByRole('img', { name: /^Shot zones half court against / })).toBeVisible();
    await expect(card).not.toContainText(/\blg\b/);
    expect(await overflow(card)).toBe(0);
    expect(await emptySpaceBelow(card)).toBeLessThan(2);
  });
}

test('the card picker and the Line Type select are one market selection', async ({
  authenticatedPage: page,
}) => {
  await page.goto('/?player_name=LeBron+James');
  const card = profileCard(page);
  const picker = card.getByRole('combobox', { name: 'Market' });
  const lineType = page.getByLabel('Line Type:');
  await expect(picker).toHaveValue('PTS');

  // Both selects show the same groups.
  for (const select of [picker, lineType]) {
    await expect(select.locator('optgroup')).toHaveCount(4);
    expect(
      await select.locator('optgroup').evaluateAll((groups) => groups.map((g) => g.label)),
    ).toEqual(['Main', 'Combos', 'Shooting', 'Other']);
  }

  await picker.selectOption('PRA');
  await expect(lineType).toHaveValue('PRA');
  await expect(page).toHaveURL(/line_type=PRA/);
  await expect(page.getByText('PRA avg', { exact: true })).toBeVisible();
  await expect(card.getByText('PRA vs ', { exact: false })).toBeVisible();
  await expect(card.getByRole('img')).toHaveCount(0);
  await expect(card.getByText('PRA score', { exact: true })).toBeVisible();

  await lineType.selectOption('AST');
  await expect(picker).toHaveValue('AST');
  await expect(card.getByText('Where his AST come from')).toBeVisible();
  await expect(card.getByRole('img', { name: /^Assist locations half court/ })).toBeVisible();
  await expect(card.getByRole('list', { name: 'Assist locations' })).toHaveCount(0);

  await lineType.selectOption('FD_PTS');
  await expect(card.getByText('PTS shown; FD_PTS has no Matchup Score')).toBeVisible();
  await expect(picker).toHaveValue('PTS');
  await picker.selectOption('RA');
  await expect(lineType).toHaveValue('RA');
  await expect(page).toHaveURL(/line_type=RA/);
  await expect(card.getByText('RA score', { exact: true })).toBeVisible();
});

for (const viewport of [
  { width: 1440, height: 1000 },
  { width: 390, height: 844 },
]) {
  test(`the PRA sheet opens whole groups while it fits, and keeps what the reader opened at ${viewport.width}px`, async ({
    authenticatedPage: page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto('/?player_name=LeBron+James&line_type=PRA');
    const card = profileCard(page);
    await expect(card.getByText('PRA score', { exact: true })).toBeVisible();
    await expect(opponentCard(page).getByRole('combobox').first()).toBeVisible();

    // A fitted group shows every Base and no button; one that does not fit shows its lead
    // Base and "+N more".
    const groups = card.locator('[data-fit-group]');
    await expect(groups).toHaveCount(3);
    const states = await groups.evaluateAll((sections) =>
      sections.map((section) => ({
        bases: Number(section.dataset.bases),
        shown: section.querySelectorAll('.pmc-w3-toggle').length,
        more: section.querySelector('.pmc-w3-more')?.textContent ?? null,
      })),
    );
    for (const { bases, shown, more } of states) {
      if (shown === bases) expect(more).toBeNull();
      else expect([shown, more]).toEqual([1, `+${bases - 1} more`]);
    }
    expect(await overflow(card)).toBe(0);

    // The reader opens Traditional under Rebounds; a resize keeps it open.
    const rebounds = card.getByRole('region', { name: 'Rebounds' });
    await rebounds.getByRole('button', { name: /^Traditional/ }).click();
    const row = rebounds.getByRole('listitem').first();
    const [metric, ...reading] = await rowCells(row);
    expect(metric).toMatch(/^[A-Z]{3}: rebounds allowed per 48$/);
    expect(reading).toEqual(['', '8th', '−3%']);
    await page.setViewportSize(
      viewport.width > 600 ? { width: 390, height: 844 } : { width: 1440, height: 1000 },
    );
    await page.setViewportSize(viewport);
    await expect(rebounds.getByRole('button', { name: /^Traditional/ })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    await expect(row).toBeVisible();
  });
}
