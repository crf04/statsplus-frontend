import { expect } from 'e2e';
import { servingSeasonMatchupPayload } from '../fixtures/courtai.js';
import { overflowsHorizontally, signedInTest } from './support/courtai.ts';

signedInTest(
  'a slate opens team sheets and local controls change their evidence',
  { tags: ['critical'] },
  async ({ app, screen, browser, api }) => {
    await app.open('/matchups?date=2026-01-15');
    await screen.getByRole('link', { name: /Open Team Sheets/ }).tap();
    await expect(browser).toHaveURL('/matchups/0022500584');
    await expect(screen.getByRole('heading', 'What BOS allows')).toBeVisible();
    // The page opens on points: the rail leads with LeBron's posted line.
    const categories = screen.getByRole('group', 'Market');
    await expect(categories.getByRole('button', 'PTS')).toHaveAttribute('aria-pressed', 'true');
    await expect(screen.getByRole('article', 'LeBron James player')).toContainText('27.5');
    await expect(screen.getByRole('article', 'Transition')).toBeVisible();
    await expect(screen.getByRole('article', 'Above-the-break 3s')).toHaveCount(0);
    await screen.getByRole('button', 'FG2A').tap();
    await expect(categories.getByRole('button', 'FG2A')).toHaveAttribute('aria-pressed', 'true');
    await expect(categories.getByRole('button', 'PTS')).toHaveAttribute('aria-pressed', 'false');
    await expect(screen.getByRole('article', 'Restricted area')).toBeVisible();
    await expect(screen.getByRole('article', 'Transition')).toHaveCount(0);
    await screen.getByRole('button', 'FG3A').tap();
    await expect(screen.getByRole('article', 'Catch-and-shoot 3s')).toBeVisible();
    await expect(screen.getByRole('article', 'Restricted area')).toHaveCount(0);
    await expect(screen.getByRole('button', 'BOS defense vs LAL players')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await screen.getByRole('button', 'LAL defense vs BOS players').tap();
    await expect(screen.getByRole('button', 'LAL defense vs BOS players')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(screen.getByRole('button', 'BOS defense vs LAL players')).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    await expect(screen.getByRole('heading', 'What LAL allows')).toBeVisible();
    await expect(screen.getByRole('article', 'Jayson Tatum player')).toBeVisible();
    expect(api.sent('/api/games/matchup')).toHaveLength(1);
    expect(await overflowsHorizontally(browser)).toBe(false);
  },
);

signedInTest(
  'historical sheets distinguish unavailable snapshots from published season evidence',
  async ({ app, screen }) => {
    await app.open('/matchups/0022501082');
    await expect(screen.getByRole('heading', 'What MIL allows')).toBeVisible();
    await expect(screen.getByRole('region', 'Matchup summary')).toContainText(
      'Final. Full-season defense ranks; no Last 15 or injury report.',
    );
    await expect(screen.getByRole('button', 'Last 15')).toBeDisabled();
    await expect(screen.getByRole('article', 'Transition')).toBeVisible();
    const kawhi = screen.getByRole('article', 'Kawhi Leonard player');
    await expect(kawhi).toContainText('+2.6 vs his season average');
    await expect(kawhi).toContainText('24');
    await screen.getByRole('group', 'Stat category').getByRole('button', 'All').tap();
    await expect(screen.getByRole('article', 'Above-the-break 3s')).toBeVisible();
    await screen.getByRole('group', 'Stat category').getByRole('button', 'PTS').tap();
    await expect(screen.getByRole('article', 'Transition')).toBeVisible();
    await expect(screen.getByRole('article', 'Above-the-break 3s')).toHaveCount(0);
  },
);

signedInTest(
  'selection cards preserve history, change the log stat, and close by button or Escape',
  { tags: ['critical'] },
  async ({ app, screen, browser, api }) => {
    await app.open('/matchups/0022500584?context=kept');
    await screen
      .getByRole('article', 'LeBron James player')
      .getByRole('button', 'Open selection card')
      .tap();
    await expect(browser).toHaveURL('/matchups/0022500584?context=kept&player=2544');
    await expect(screen.getByRole('heading', 'LeBron James')).toBeVisible();
    await expect(screen.getByRole('region', 'LeBron James')).toBeFocused();
    const matrix = screen.getByRole('table', 'LeBron James Score Matrix');
    await expect(matrix).toContainText('+12%');
    await expect(matrix.getByRole('button', 'PTS')).toHaveAttribute('aria-pressed', 'true');
    const logStats = screen.getByRole('group', 'Selection log stat');
    await expect(logStats.getByRole('button', 'PTS')).toHaveAttribute('aria-pressed', 'true');
    await logStats.getByRole('button', 'PRA').tap();
    await expect(logStats.getByRole('button', 'PRA')).toHaveAttribute('aria-pressed', 'true');
    await expect(logStats.getByRole('button', 'PTS')).toHaveAttribute('aria-pressed', 'false');
    await expect(matrix.getByRole('button', 'PRA')).toHaveAttribute('aria-pressed', 'true');
    await expect(matrix.getByRole('button', 'PTS')).toHaveAttribute('aria-pressed', 'false');
    await expect(screen.getByRole('columnheader', 'PRA').first()).toBeVisible();
    await expect(screen.getByText('+0.102').first()).toBeVisible();
    expect(api.sent('/api/games/matchup/selection')).toHaveLength(1);
    expect(await overflowsHorizontally(browser)).toBe(false);
    await app.screenshot('selection-card');
    await browser.back();
    await expect(browser).toHaveURL('/matchups/0022500584?context=kept');
    await expect(screen.getByRole('heading', 'LeBron James')).toHaveCount(0);
    await browser.forward();
    await expect(browser).toHaveURL('/matchups/0022500584?context=kept&player=2544');
    await expect(screen.getByRole('region', 'LeBron James')).toBeFocused();
    await screen.getByRole('button', 'Close selection card').tap();
    await expect(browser).toHaveURL('/matchups/0022500584?context=kept');
    await expect(screen.getByRole('heading', 'LeBron James')).toHaveCount(0);
    await screen
      .getByRole('article', 'LeBron James player')
      .getByRole('button', 'Open selection card')
      .tap();
    await expect(screen.getByRole('region', 'LeBron James')).toBeFocused();
    await browser.keyboard.press('Escape');
    await expect(browser).toHaveURL('/matchups/0022500584?context=kept');
    await expect(screen.getByRole('heading', 'LeBron James')).toHaveCount(0);
    await expect(
      screen.getByRole('article', 'LeBron James player').getByRole('button'),
    ).toBeFocused();
    await browser.reload();
    await expect(screen.getByRole('heading', 'What BOS allows')).toBeVisible();
  },
);

signedInTest(
  'an empty selection explains why no opponent logs are shown',
  async ({ app, screen }) => {
    await app.open('/matchups/0022500584?player=1630559');
    await expect(screen.getByRole('heading', 'Austin Reaves')).toBeVisible();
    await expect(screen.getByText('No games vs this opponent data is available.')).toBeVisible();
    await expect(
      screen.getByText('No score components were computable for FG3A in Season.'),
    ).toBeVisible();
  },
);

signedInTest(
  'a failed selection read shows a handled error while the sheet remains usable',
  async ({ app, screen, api }) => {
    await api.override({
      '/api/games/matchup/selection': {
        status: 500,
        body: { error: { code: 'provider_unavailable' } },
      },
    });
    await app.open('/matchups/0022500584?player=2544');
    await expect(screen.getByRole('alert')).toContainText('Unable to load selection logs');
    await expect(screen.getByRole('heading', 'What BOS allows')).toBeVisible();
  },
);

signedInTest(
  'the agent opens a player selection card',
  { tags: ['agent'] },
  async ({ app, agent, screen }) => {
    await app.open('/matchups/0022500584');
    await expect(screen.getByRole('heading', 'What BOS allows')).toBeVisible();
    await agent.act('open the selection card for LeBron James');
    await expect(screen.getByRole('heading', 'LeBron James')).toBeVisible();
    await expect(screen.getByRole('table', 'LeBron James Score Matrix')).toContainText('+12%');
  },
);

signedInTest(
  'a Matchup player opens their Log Workspace',
  { tags: ['critical'] },
  async ({ app, screen, browser, api }) => {
    await app.open('/matchups/0022500584');
    await screen.getByRole('link', 'LeBron James game logs').tap();
    await expect(browser).toHaveURL('/?player_name=LeBron+James');
    await expect(screen.getByRole('heading', 'LeBron James')).toBeVisible();
    await expect(screen.getByRole('heading', 'Game Logs')).toBeVisible();
    await expect(screen.getByRole('cell', '31')).toBeVisible();
    expect(api.sent('/api/games/game_logs')[0].search.get('player_name')).toBe('LeBron James');
  },
);

signedInTest(
  'Back to slate leaves Matchup detail and shows the game list',
  { tags: ['critical'] },
  async ({ app, screen, browser }) => {
    await app.open('/matchups/0022500584');
    await expect(screen.getByRole('heading', 'What BOS allows')).toBeVisible();
    await screen.getByRole('link', '← Back to slate').tap();
    await expect(browser).toHaveURL('/matchups');
    await expect(screen.getByRole('heading', 'LAL @ BOS')).toBeVisible();
    await expect(screen.getByRole('link', { name: /Open Team Sheets/ })).toBeVisible();
    await expect(screen.getByRole('heading', 'What BOS allows')).toHaveCount(0);
  },
);

signedInTest(
  'a trailing section names its season and a short Last 15 names its games',
  async ({ app, screen, browser, api }) => {
    await api.override({ '/api/games/matchup': { body: servingSeasonMatchupPayload } });
    await app.open('/matchups/0022500584');
    await expect(screen.getByRole('heading', 'What BOS allows')).toBeVisible();
    await screen.getByRole('group', 'Market').getByRole('button', 'All').tap();
    await expect(
      screen.getByRole('region', 'Play types').getByText('2025-26 season'),
    ).toBeVisible();
    await expect(screen.getByText('2025-26 season')).toHaveCount(1);
    await expect(screen.getByRole('button', 'Last 15')).toHaveCount(0);
    expect(await overflowsHorizontally(browser)).toBe(false);
    await app.screenshot('matchup-trailing-season');

    await screen.getByRole('button', 'Last 6').tap();
    await expect(screen.getByRole('button', 'Last 6')).toHaveAttribute('aria-pressed', 'true');
    await expect(screen.getByText('2025-26 season')).toHaveCount(0);
    await expect(
      screen.getByText('Play types unavailable for Last 6: provider_unsupported.'),
    ).toBeVisible();
    await expect(screen.getByRole('region', 'Play types').getByText('Last 15')).toHaveCount(0);
    await app.screenshot('matchup-last-n');
  },
);
