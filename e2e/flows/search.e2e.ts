// Flow: Search. A prose query resolves to a Log Workspace whose Filter Set
// lives in the URL; a rejected query stays retryable; signed-out visitors keep
// the link they followed.
import { expect } from 'e2e';
import { signedInTest, signedOutTest } from './support/courtai.ts';

const QUERY = 'LeBron James last 10 games';
// The Query Prompt is named by its placeholder.
const PROMPT = 'LeBron James this year';

signedOutTest(
  'signing in through the landing unlocks the Query Prompt',
  { tags: ['critical'] },
  async ({ app, screen }) => {
    await app.open('/');
    await expect(screen.getByRole('heading', 'Ask the box score')).toBeVisible();
    // Signed out, the prompt says why it is disabled.
    await expect(screen.getByRole('textbox', 'Sign in to enter a query...')).toBeDisabled();

    await screen.getByRole('button', 'Sign in with Google').tap();

    await expect(screen.getByRole('textbox', PROMPT)).toBeEnabled();
    await expect(screen.getByText('CourtAI Test User').first()).toBeVisible();
  },
);

signedInTest(
  'a prose query opens the Log Workspace and Back to search clears it',
  { tags: ['critical'] },
  async ({ app, screen, browser, api }) => {
    await app.open('/');
    await screen.getByRole('textbox', PROMPT).fill(QUERY);
    await screen.getByRole('textbox', PROMPT).press('Enter');

    await expect(screen.getByRole('heading', 'LeBron James')).toBeVisible();
    await expect(screen.getByText(`"${QUERY}"`)).toBeVisible();
    await expect(screen.getByRole('heading', 'Game Logs')).toBeVisible();
    await expect(screen.getByRole('cell', '31')).toBeVisible();
    // The Filter Set, not the prose, is what the address bar keeps.
    await expect(browser).toHaveURL('/?player_name=LeBron+James&game_filter=10');
    const [parse] = api.sent('/api/nl-query', 'POST');
    expect(parse.body).toEqual({ query: QUERY });

    await screen.getByRole('button', 'Back to search').tap();
    await expect(browser).toHaveURL('/');
    await expect(screen.getByRole('textbox', PROMPT)).toHaveValue('');
  },
);

signedInTest(
  'a shared Log Workspace link reproduces the query without the parser',
  async ({ app, screen, api }) => {
    await app.open('/?player_name=LeBron+James&game_filter=10');

    await expect(screen.getByRole('heading', 'LeBron James')).toBeVisible();
    await expect(screen.getByRole('cell', '31')).toBeVisible();
    expect(api.sent('/api/nl-query')).toHaveLength(0);
    const filtered = api
      .sent('/api/games/game_logs', 'GET')
      .find((request) => request.search.has('game_filter'));
    expect(filtered?.search.get('player_name')).toBe('LeBron James');
    expect(filtered?.search.get('game_filter')).toBe('10');
  },
);

signedInTest(
  'a rejected query shows the reason and stays retryable',
  async ({ app, screen, api }) => {
    await api.override({
      '/api/nl-query': { status: 422, body: { message: 'Query could not be parsed.' } },
    });
    await app.open('/');
    await screen.getByRole('textbox', PROMPT).fill('not a valid basketball query');
    await screen.getByRole('textbox', PROMPT).press('Enter');

    await expect(screen.getByText('Query could not be parsed.')).toBeVisible();
    await expect(screen.getByRole('textbox', PROMPT)).toBeEnabled();
    await expect(screen.getByRole('textbox', PROMPT)).toHaveValue('not a valid basketball query');
    await api.override({});
    await screen.getByRole('textbox', PROMPT).fill(QUERY);
    await screen.getByRole('textbox', PROMPT).press('Enter');
    await expect(screen.getByRole('heading', 'Game Logs')).toBeVisible();
    await expect(screen.getByRole('cell', '31')).toBeVisible();
  },
);

signedOutTest(
  'a signed-out visitor keeps the link and loads it once after signing in',
  { tags: ['critical'] },
  async ({ app, screen, browser, api }) => {
    await app.open('/?player_name=LeBron+James&game_filter=10');

    await expect(
      screen.getByRole('status').filter({ hasText: 'Sign in to load these game logs' }),
    ).toBeVisible();
    await expect(browser).toHaveURL('/?player_name=LeBron+James&game_filter=10');
    expect(api.sent('/api/games/game_logs')).toHaveLength(0);

    await screen.getByRole('button', 'Sign in with Google').first().tap();
    await expect(screen.getByRole('heading', 'Game Logs')).toBeVisible();
    await expect(screen.getByRole('cell', '31')).toBeVisible();
  },
);

signedInTest(
  'the agent asks a question and lands on its game logs',
  { tags: ['agent'] },
  async ({ app, agent, screen, browser }) => {
    await app.open('/');
    await agent.act('ask the box score for {query}', { params: { query: QUERY } });

    await expect(screen.getByRole('heading', 'Game Logs')).toBeVisible();
    await expect(screen.getByRole('cell', '31')).toBeVisible();
    await expect(browser).toHaveURL('/?player_name=LeBron+James&game_filter=10');
  },
);

signedInTest('signing out removes access to the Query Prompt', async ({ app, screen }) => {
  await app.open('/');
  await expect(screen.getByRole('textbox', PROMPT)).toBeEnabled();
  await screen.getByRole('banner').getByRole('button', 'CT CourtAI Test User').tap();
  await screen.getByRole('button', 'Sign out').tap();
  await expect(screen.getByRole('textbox', 'Sign in to enter a query...')).toBeDisabled();
  await expect(screen.getByRole('button', 'Sign in with Google')).toBeVisible();
});

signedOutTest(
  'an unknown route returns to the public search landing',
  async ({ app, screen, browser }) => {
    await app.open('/not-a-courtai-route');
    await expect(browser).toHaveURL('/');
    await expect(screen.getByRole('heading', 'Ask the box score')).toBeVisible();
  },
);
