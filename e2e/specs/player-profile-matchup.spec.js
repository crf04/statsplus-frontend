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

const DESKTOP = { width: 1440, height: 1000 };
const PHONE = { width: 390, height: 844 };

// Each stat group as shown: how many Bases it has, how many show, and its "+N more" button.
const groupStates = (card) =>
  card.locator('[data-fit-group]').evaluateAll((sections) =>
    sections.map((section) => ({
      stat: section.getAttribute('aria-label'),
      bases: Number(section.dataset.bases),
      shown: section.querySelectorAll('.pmc-w3-toggle').length,
      more: section.querySelector('.pmc-w3-more')?.textContent ?? null,
    })),
  );

// Beside the Opposing Team Profile the sheet's room is that card's natural height. The room
// left is how far the neighbour's content reaches below this card's content; a group still
// compact must need more than that to open (its hidden rows less its "+N more" button).
const desktopFit = (card) =>
  card.evaluate((element) => {
    const row = element.closest('.row');
    const neighbour = [...row.querySelectorAll('.dark-card')].find((c) => c !== element);
    const contentBottom = (c) => {
      const body = c.querySelector('.card-body');
      return body.lastElementChild.getBoundingClientRect().bottom - c.getBoundingClientRect().top;
    };
    const left = contentBottom(neighbour) - contentBottom(element);
    const rowHeight = element.querySelector('.pmc-w3-base').getBoundingClientRect().height;
    const compact = [...element.querySelectorAll('[data-fit-group]')]
      .filter((section) => section.querySelector('.pmc-w3-more'))
      .map((section) => ({
        stat: section.getAttribute('aria-label'),
        needs:
          (Number(section.dataset.bases) - 1) * rowHeight -
          section.querySelector('.pmc-w3-more').getBoundingClientRect().height,
      }));
    return { left, compact };
  });

const expectDesktopFit = async (card) => {
  const { left, compact } = await desktopFit(card);
  expect(left).toBeGreaterThan(-1);
  for (const { stat, needs } of compact) expect([stat, needs > left]).toEqual([stat, true]);
};

test('on a phone the PRA sheet has room for every group, so all open with no "+N more"', async ({
  authenticatedPage: page,
}) => {
  await page.setViewportSize(PHONE);
  await page.goto('/?player_name=LeBron+James&line_type=PRA');
  const card = profileCard(page);
  await expect(card.getByText('PRA score', { exact: true })).toBeVisible();
  await expect
    .poll(() => groupStates(card))
    .toEqual([
      { stat: 'Points', bases: 4, shown: 4, more: null },
      { stat: 'Rebounds', bases: 2, shown: 2, more: null },
      { stat: 'Assists', bases: 2, shown: 2, more: null },
    ]);
});

test('on desktop the sheet opens groups while they fit the row, and fits again on resize and a new market', async ({
  authenticatedPage: page,
}) => {
  await page.setViewportSize(DESKTOP);
  await page.goto('/?player_name=LeBron+James&line_type=PRA');
  const card = profileCard(page);
  await expect(card.getByText('PRA score', { exact: true })).toBeVisible();
  await expect(opponentCard(page).getByText('Rebounds', { exact: true })).toBeVisible();
  await expectDesktopFit(card);
  const desktop = await groupStates(card);
  // At least one group opens here, so the fit is not leaving everything compact.
  expect(desktop.some(({ bases, shown }) => bases > 1 && shown === bases)).toBe(true);

  await page.setViewportSize(PHONE);
  await expect
    .poll(async () => (await groupStates(card)).map(({ shown, more }) => [shown, more]))
    .toEqual([
      [4, null],
      [2, null],
      [2, null],
    ]);
  await page.setViewportSize(DESKTOP);
  await expect.poll(() => groupStates(card)).toEqual(desktop);

  await card.getByRole('combobox', { name: 'Market' }).selectOption('PA');
  await expect(card.getByText('PA score', { exact: true })).toBeVisible();
  await expectDesktopFit(card);
});

for (const viewport of [DESKTOP, PHONE]) {
  test(`a Base the reader opened stays open across a resize at ${viewport.width}px`, async ({
    authenticatedPage: page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto('/?player_name=LeBron+James&line_type=PRA');
    const card = profileCard(page);
    await expect(card.getByText('PRA score', { exact: true })).toBeVisible();
    expect(await overflow(card)).toBe(0);

    // The reader opens Traditional under Rebounds; a resize keeps it open.
    const rebounds = card.getByRole('region', { name: 'Rebounds' });
    await rebounds.getByRole('button', { name: /^Traditional/ }).click();
    const row = rebounds.getByRole('listitem').first();
    const [metric, ...reading] = await rowCells(row);
    expect(metric).toMatch(/^[A-Z]{3}: rebounds allowed per 48$/);
    expect(reading).toEqual(['', '8th', '−3%']);
    await page.setViewportSize(viewport === DESKTOP ? PHONE : DESKTOP);
    await page.setViewportSize(viewport);
    await expect(rebounds.getByRole('button', { name: /^Traditional/ })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    await expect(row).toBeVisible();
  });
}

// A backend serving 2026-27 before its cutover offers it (crf04/statsplus#330), so the
// Workspace's Season select names it.
const offerUnpublishedSeason = (page) =>
  page.route('**/api/games/seasons', (route) =>
    route.fulfill({
      json: {
        seasons: ['2025-26'],
        default_season: '2025-26',
        choices: [
          {
            season: '2026-27',
            mode: 'unpublished',
            families: { game_logs: { served_season: '2026-27', state: 'serving' } },
            team_games: { min: 2, max: 4 },
          },
          {
            season: '2025-26',
            mode: 'published',
            families: { game_logs: { served_season: '2025-26', state: 'serving' } },
          },
        ],
      },
    }),
  );

test('the card reads the Workspace Evidence season, and reads again when it changes', async ({
  authenticatedPage: page,
}) => {
  await offerUnpublishedSeason(page);
  const asked = (season) =>
    page.waitForRequest(
      (request) =>
        request.url().includes('/api/matchups/unscheduled') &&
        new URL(request.url()).searchParams.get('season') === season,
    );
  const first = asked('2026-27');
  await page.goto('/?player_name=LeBron+James&season_filter=2026-27');
  await first;
  const card = profileCard(page);
  const spotUp = () =>
    rowCells(card.getByRole('list', { name: 'Play types' }).getByRole('listitem').first());
  await expect(card.getByText(/· 2026-27 · data as of Nov 6/)).toBeVisible();
  await expect.poll(spotUp).toEqual(['Spot up', '56%', '28th', '+22%']);
  await expect(card.locator('.pmc-score').getByText('low confidence')).toHaveAttribute(
    'title',
    'Low confidence: thin evidence in Play types',
  );

  await page.getByTestId('filter-panel').getByLabel('Season').selectOption('2025-26');
  await expect(card.getByText(/· 2025-26 · data as of Aug 24/)).toBeVisible();
  await expect.poll(spotUp).toEqual(['Spot up', '41%', '27th', '+10%']);
  await expect(card.getByText('low confidence')).toHaveCount(0);
});
