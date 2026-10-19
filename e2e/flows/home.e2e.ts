// Flow: Home. A signed-in reader sees today's games, the slate's best and
// toughest points Matchup, their Targets, and what each ladder rung returns,
// above and around the Query Prompt (crf04/statsplus#204). The games, Tonight
// and the ladder are public, so a signed-out visitor sees them too, with a
// sign-up card where Targets would be (crf04/statsplus#211).
import { expect } from 'e2e';
import { slateEdgesPayload, slateGame, slatePayload } from '../fixtures/courtai.js';
import { signedInTest, signedOutTest } from './support/courtai.ts';

signedInTest(
  'the home page previews today and answers the ladder',
  { tags: ['critical'] },
  async ({ app, screen, api, browser }) => {
    await app.open('/');

    // The ticker: one cell per game with its biggest points effects.
    const ticker = screen.getByRole('navigation', "Today's games");
    const cell = ticker.getByRole('link', { name: 'LAL at BOS Matchup', exact: false });
    await expect(cell).toHaveAttribute('href', '/matchups/0022500584');
    // Derived from the game's Matchup fixture: the same scores the Matchup shows.
    await expect(cell).toContainText('Reaves +24%');
    await expect(cell).toContainText('Tatum +15%');
    await expect(cell).toContainText('James +12%');
    expect(api.sent('/api/games/slate/edges', 'GET')).toHaveLength(1);
    await expect(screen.getByRole('heading', 'Your Targets')).toBeVisible();
    // Each home read asks for the next game day itself and names no date.
    for (const path of [
      '/api/games/slate',
      '/api/games/slate/edges',
      '/api/user/targets/resolve',
    ]) {
      const [request] = api.sent(path, 'GET');
      expect([path, request.search.get('fallback'), request.search.has('date')]).toEqual([
        path,
        'next_game_day',
        false,
      ]);
    }
    await app.screenshot('home-top');

    // Tonight: Best with its reason; no unfavourable Matchup, so no Toughest.
    const best = screen.getByRole('article', 'Best: Austin Reaves');
    await expect(best).toContainText('+24.0%');
    await expect(best).toContainText('Transition 18% of plays · BOS allow the 4th most');
    await expect(screen.getByText('No standout matchup')).toBeVisible();
    await best.getByRole('button', 'Try it').tap();
    // The prompt's placeholder rotates, so it is found by role alone.
    await expect(screen.getByRole('textbox')).toHaveValue(
      'Austin Reaves this year against bottom 10 defenses',
    );
    await expect(browser).toHaveURL('/');

    // The ladder answers come from one anonymous ladder read.
    await expect(screen.getByRole('heading', 'Get more specific')).toBeVisible();
    const firstRung = screen.getByRole('button', { name: 'Start with a player', exact: false });
    await expect(firstRung).toContainText('PTS');
    await expect(firstRung).toContainText('2 games');
    expect(api.sent('/api/games/ladder', 'GET')).toHaveLength(1);
    expect(api.sent('/api/games/game_logs')).toHaveLength(0);

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

signedOutTest(
  'signed out sees the same public sections and a sign-up card for Targets',
  { tags: ['critical'] },
  async ({ app, screen, api }) => {
    await app.open('/');

    await expect(screen.getByRole('heading', 'Ask the box score')).toBeVisible();
    const ticker = screen.getByRole('navigation', "Today's games");
    await expect(
      ticker.getByRole('link', { name: 'LAL at BOS Matchup', exact: false }),
    ).toBeVisible();
    const firstRung = screen.getByRole('button', { name: 'Start with a player', exact: false });
    await expect(firstRung).toContainText('2 games');
    await expect(screen.getByRole('article', 'Best: Austin Reaves')).toContainText('+24.0%');
    const targets = screen.getByRole('region', 'Your Targets');
    await expect(targets.getByRole('button', 'Sign up free')).toBeVisible();
    await expect(screen.getByText('Free account. Sign up with Google to run it.')).toBeVisible();
    expect(api.sent('/api/user/targets/resolve')).toHaveLength(0);
    expect(api.sent('/api/games/game_logs')).toHaveLength(0);
    // Every read behind these sections is sent with no credentials.
    expect(api.requests.filter((r) => r.authorization !== undefined)).toEqual([]);
    await app.screenshot('home-signed-out');
  },
);

signedInTest(
  'no game day ahead shows the last game day, labelled',
  async ({ app, screen, api }) => {
    // One fallback read answers each of the three: the Slate says so, and
    // Edges and Targets name the same day.
    await api.override({
      '/api/games/slate': (request) => {
        expect(new URL(request.url()).searchParams.get('fallback')).toBe('next_game_day');
        expect(new URL(request.url()).searchParams.has('date')).toBe(false);
        return {
          body: slatePayload('2026-01-15', [slateGame], {
            previousGameDate: '2026-01-14',
            fallback: 'previous_game_day',
          }),
        };
      },
      '/api/games/slate/edges': { body: slateEdgesPayload('2026-01-15', [slateGame]) },
    });
    await app.open('/');

    await expect(screen.getByRole('heading', 'Last game day')).toBeVisible();
    await expect(
      screen.getByRole('link', { name: 'Last game day · ', exact: false }).first(),
    ).toHaveAttribute('href', '/matchups?date=2026-01-15');
    await expect(screen.getByRole('article', 'Best: Austin Reaves')).toBeVisible();
  },
);

signedInTest(
  'no games today previews the next game day, labelled, linking to its date',
  async ({ app, screen, api }) => {
    await api.override({
      '/api/games/slate': (request) => {
        expect(new URL(request.url()).searchParams.get('fallback')).toBe('next_game_day');
        expect(new URL(request.url()).searchParams.has('date')).toBe(false);
        return {
          body: slatePayload('2026-10-20', [slateGame], {
            previousGameDate: '2026-04-12',
            fallback: 'next_game_day',
          }),
        };
      },
      '/api/games/slate/edges': { body: slateEdgesPayload('2026-10-20', [slateGame]) },
    });
    await app.open('/');

    await expect(screen.getByRole('heading', 'Next game day')).toBeVisible();
    await expect(screen.getByText('Last game day')).toHaveCount(0);
    await expect(screen.getByText('Tonight')).toHaveCount(0);
    const label = screen.getByRole('link', { name: 'Next game day · ', exact: false }).first();
    await expect(label).toContainText(/tue, oct 20/i);
    await expect(label).toHaveAttribute('href', '/matchups?date=2026-10-20');
    await expect(screen.getByRole('article', 'Best: Austin Reaves')).toBeVisible();
  },
);
