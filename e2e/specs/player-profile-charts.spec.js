import { E2E_AUTH_STORAGE_KEY, expect, installApiContract, test } from '../fixtures/courtai';

// A Playtypes profile keys each frequency by `<playtype>%`; the opponent's
// Team Defense multipliers and ranks are keyed by the bare playtype.
const playtypeProfile = {
  'PRBallHandler%': 31.4,
  'Isolation%': 17.8,
  'Transition%': 15.2,
  'Spotup%': 12.6,
  'Cut%': 5.1,
};
const playtypeDefense = {
  PRBallHandler: 1.14,
  PRBallHandler_RANK: 27,
  Isolation: 0.86,
  Isolation_RANK: 4,
  Transition: 1.05,
  Transition_RANK: 20,
  Spotup: 0.97,
  Spotup_RANK: 12,
  Cut: 0.82,
  Cut_RANK: 1,
};
const assistProfile = [
  {
    Arc3Assists: 34.2,
    'Arc3Assists+': 1.12,
    Corner3Assists: 12.5,
    'Corner3Assists+': 0.88,
    AtRimAssists: 29.7,
    'AtRimAssists+': 1.04,
    ShortMidRangeAssists: 14.1,
    'ShortMidRangeAssists+': 0.95,
    LongMidRangeAssists: 9.5,
    'LongMidRangeAssists+': 1.21,
    ThreePtAssists: 46.7,
    'ThreePtAssists+': 1.06,
    TwoPtAssists: 53.3,
    'TwoPtAssists+': 0.97,
  },
];
const assistDefense = {
  Arc3Assists: 1.16,
  Arc3Assists_RANK: 28,
  Corner3Assists: 0.84,
  Corner3Assists_RANK: 3,
  AtRimAssists: 1.02,
  AtRimAssists_RANK: 17,
  ShortMidRangeAssists: 0.93,
  ShortMidRangeAssists_RANK: 9,
  LongMidRangeAssists: 1.1,
  LongMidRangeAssists_RANK: 23,
  ThreePtAssists: 1.08,
  ThreePtAssists_RANK: 22,
  TwoPtAssists: 0.9,
  TwoPtAssists_RANK: 6,
};

const profileOverrides = {
  '/api/players/profile': (request) => ({
    body:
      new URL(request.url()).searchParams.get('category') === 'assists'
        ? assistProfile
        : playtypeProfile,
  }),
  '/api/teams/stats': (request) => ({
    body:
      new URL(request.url()).searchParams.get('category') === 'Assists'
        ? assistDefense
        : playtypeDefense,
  }),
};

// Just inside the plot area's left edge, over the first (most frequent) category.
const firstCategory = { x: 90, y: 150 };

test('player profile charts render and explain the hovered category', async ({ page }) => {
  await page.addInitScript((storageKey) => {
    window.localStorage.setItem(storageKey, 'true');
  }, E2E_AUTH_STORAGE_KEY);
  await installApiContract(page, profileOverrides);
  await page.goto('/?player_name=LeBron+James');

  const profile = page.getByRole('heading', { name: 'Player Profile', exact: true }).locator('..');
  const playtypes = profile.getByRole('img', {
    name: 'Playtype frequency and team defense chart',
  });
  await expect(playtypes).toBeVisible();
  await expect(playtypes.getByText('Total Matchup Rating:')).toBeVisible();
  await expect(playtypes.getByText('Player Frequency (%)')).toBeVisible();
  await expect(playtypes.getByText('Team Defense', { exact: true })).toBeVisible();
  await expect(playtypes.getByText('PRBallHandler', { exact: true })).toBeHidden();

  await playtypes.hover({ position: firstCategory });
  await expect(playtypes.getByText('PRBallHandler', { exact: true })).toBeVisible();
  await expect(playtypes.getByText('Player Frequency: 31.40%')).toBeVisible();
  // The Team Defense line is hue-coded from red (weak) to green (strong).
  await expect(playtypes.getByText('Team Defense: 14.00% (Rank: 27)')).toHaveCSS(
    'color',
    'rgb(61, 204, 0)',
  );
  await page.mouse.move(0, 0);
  await expect(playtypes.getByText('PRBallHandler', { exact: true })).toBeHidden();

  await profile.getByText('Assists', { exact: true }).click();
  const assistCharts = profile.getByRole('img', {
    name: 'Assist frequency and team defense chart',
  });
  await expect(assistCharts).toHaveCount(2);

  const locations = assistCharts.first();
  await locations.hover({ position: firstCategory });
  await expect(locations.getByText('Arc3 Assists')).toBeVisible();
  await expect(locations.getByText('Frequency: 34.20%')).toBeVisible();
  await expect(locations.getByText('Frequency+: 12.00%')).toBeVisible();
  await expect(locations.getByText('Team Defense: 16.00% (Rank: 28)')).toBeVisible();

  const shotValues = assistCharts.last();
  await shotValues.hover({ position: firstCategory });
  await expect(shotValues.getByText('TwoPt Assists')).toBeVisible();
  await expect(shotValues.getByText('Team Defense: -10.00% (Rank: 6)')).toBeVisible();
  await expect(locations.getByText('Arc3 Assists')).toBeHidden();
});
