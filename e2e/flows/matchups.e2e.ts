import { expect } from 'e2e';
import { overflowsHorizontally, signedInTest } from './support/courtai.ts';

signedInTest(
  'a slate opens team sheets and local controls change their evidence',
  { tags: ['critical'] },
  async ({ app, screen, browser, api }) => {
    await app.open('/matchups?date=2026-01-15');
    await screen.getByRole('link', { name: /Open Team Sheets/ }).tap();
    await expect(browser).toHaveURL('/matchups/0022500584');
    await expect(screen.getByRole('heading', 'BOS Defense Sheet')).toBeVisible();
    await expect(screen.getByText('Transition PTS')).toBeVisible();
    await expect(screen.getByText('Above the Break 3 FGA')).toBeVisible();
    const categories = screen.getByRole('group', 'Market');
    await expect(categories.getByRole('button', 'All')).toHaveAttribute('aria-pressed', 'true');
    await screen.getByRole('button', 'FG2A').tap();
    await expect(categories.getByRole('button', 'FG2A')).toHaveAttribute('aria-pressed', 'true');
    await expect(categories.getByRole('button', 'All')).toHaveAttribute('aria-pressed', 'false');
    await expect(screen.getByText('Restricted Area FGA')).toBeVisible();
    await expect(screen.getByText('Above the Break 3 FGA')).toHaveCount(0);
    await screen.getByRole('button', 'FG3A').tap();
    await expect(screen.getByText('Catch and Shoot FG3A')).toBeVisible();
    await expect(screen.getByText('Restricted Area FGA')).toHaveCount(0);
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
    await expect(screen.getByRole('heading', 'LAL Defense Sheet')).toBeVisible();
    await expect(screen.getByRole('article', 'Jayson Tatum player')).toBeVisible();
    expect(api.sent('/api/games/matchup')).toHaveLength(1);
    expect(await overflowsHorizontally(browser)).toBe(false);
  },
);

signedInTest(
  'historical sheets distinguish unavailable snapshots from published season evidence',
  async ({ app, screen }) => {
    await app.open('/matchups/0022501082');
    await expect(screen.getByRole('heading', 'MIL Defense Sheet')).toBeVisible();
    await expect(screen.getByRole('region', 'Historical matchup evidence')).toContainText(
      'Participants: Completed-Season Context · From Game Logs',
    );
    await expect(screen.getByRole('button', 'Last 15')).toBeDisabled();
    await expect(screen.getByText('Transition PTS')).toBeVisible();
    await expect(screen.getByRole('article', 'Kawhi Leonard player')).toContainText(
      'Focal game LAC @ MIL · 34.5 MIN · 24.0 PTS · 5.0 REB · 7.0 AST',
    );
    await screen.getByRole('group', 'Stat category').getByRole('button', 'PTS').tap();
    await expect(screen.getByText('Transition PTS')).toBeVisible();
    await expect(screen.getByText('Above the Break 3 FGA')).toHaveCount(0);
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
    await expect(screen.getByRole('table', 'LeBron James Score Matrix')).toContainText('+12%');
    const logStats = screen.getByRole('group', 'Selection log stat');
    await expect(logStats.getByRole('button', 'PTS')).toHaveAttribute('aria-pressed', 'true');
    await logStats.getByRole('button', 'PRA').tap();
    await expect(logStats.getByRole('button', 'PRA')).toHaveAttribute('aria-pressed', 'true');
    await expect(logStats.getByRole('button', 'PTS')).toHaveAttribute('aria-pressed', 'false');
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
    await expect(screen.getByRole('heading', 'BOS Defense Sheet')).toBeVisible();
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
    await expect(screen.getByRole('heading', 'BOS Defense Sheet')).toBeVisible();
  },
);

signedInTest(
  'the agent opens a player selection card',
  { tags: ['agent'] },
  async ({ app, agent, screen }) => {
    await app.open('/matchups/0022500584');
    await expect(screen.getByRole('heading', 'BOS Defense Sheet')).toBeVisible();
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
    await expect(screen.getByRole('heading', 'BOS Defense Sheet')).toBeVisible();
    await screen.getByRole('link', '← Back to slate').tap();
    await expect(browser).toHaveURL('/matchups');
    await expect(screen.getByRole('heading', 'LAL @ BOS')).toBeVisible();
    await expect(screen.getByRole('link', { name: /Open Team Sheets/ })).toBeVisible();
    await expect(screen.getByRole('heading', 'BOS Defense Sheet')).toHaveCount(0);
  },
);
