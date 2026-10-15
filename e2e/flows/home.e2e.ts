// Flow: Home. A signed-in reader sees today's games, the slate's best and
// toughest points Matchup, their Targets, and what each ladder rung returns,
// above and around the Query Prompt (crf04/statsplus#204).
import { expect } from 'e2e';
import { slatePayload } from '../fixtures/courtai.js';
import { signedInTest, signedOutTest } from './support/courtai.ts';

signedInTest(
  'the home page previews today and answers the ladder',
  { tags: ['critical'] },
  async ({ app, screen, api, browser }) => {
    await app.open('/');

    // The ticker: one cell per game with its biggest points effects.
    const ticker = screen.getByRole('navigation', "Today's games");
    const cell = ticker.getByRole('link', 'LAL at BOS Matchup');
    await expect(cell).toHaveAttribute('href', '/matchups/0022500584');
    await expect(cell).toContainText('James +9%');
    await expect(cell).toContainText('Tatum −6%');
    expect(api.sent('/api/games/slate/edges', 'GET')).toHaveLength(1);

    // Tonight: Best and Toughest with their reasons; Try it fills the prompt.
    const best = screen.getByRole('article', 'Best: LeBron James');
    await expect(best).toContainText('+9.1%');
    await expect(best).toContainText('Transition 24% of plays · BOS allow the 3rd most');
    await expect(screen.getByRole('article', 'Toughest: Jayson Tatum')).toContainText(
      'Isolation 19% of plays · LAL allow the 3rd fewest',
    );
    await best.getByRole('button', 'Try it').tap();
    // The prompt's placeholder rotates, so it is found by role alone.
    await expect(screen.getByRole('textbox')).toHaveValue(
      'LeBron James this year against bottom 10 defenses',
    );
    await expect(browser).toHaveURL('/');

    // The ladder answers come from the rungs' own Game Logs requests.
    await expect(screen.getByRole('heading', 'Get more specific')).toBeVisible();
    const firstRung = screen.getByRole('button', { name: 'Start with a player', exact: false });
    await expect(firstRung).toContainText('PTS');
    await expect(firstRung).toContainText('2 games');
    expect(api.sent('/api/games/game_logs', 'GET').length).toBeGreaterThanOrEqual(3);

    await expect(screen.getByRole('heading', 'Your Targets')).toBeVisible();
    await app.screenshot('home-today');
  },
);

signedInTest('no games today leaves the Query Prompt on its own', async ({ app, screen, api }) => {
  await api.override({
    '/api/games/slate': { body: slatePayload('2026-10-15', []) },
    '/api/games/slate/edges': {
      body: { slate_date: '2026-10-15', games: [], spotlight: { best: null, toughest: null } },
    },
  });
  await app.open('/');

  await expect(screen.getByRole('heading', 'Get more specific')).toBeVisible();
  await expect(screen.getByRole('navigation', "Today's games")).toHaveCount(0);
  await expect(screen.getByRole('heading', 'Tonight')).toHaveCount(0);
});

signedOutTest('signed out shows no previews and no answers', async ({ app, screen, api }) => {
  await app.open('/');

  await expect(screen.getByRole('heading', 'Ask the box score')).toBeVisible();
  await expect(screen.getByRole('heading', 'Get more specific')).toBeVisible();
  await expect(screen.getByRole('navigation', "Today's games")).toHaveCount(0);
  expect(api.sent('/api/games/slate/edges')).toHaveLength(0);
});
