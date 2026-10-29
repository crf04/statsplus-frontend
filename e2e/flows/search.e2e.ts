// Flow: Search. A prose query resolves to a Log Workspace whose Filter Set
// lives in the URL; a rejected query stays retryable. Signed-out visitors
// reading a shared link are shared-links.e2e.ts.
import { expect } from 'e2e';
import { signedInTest, signedOutTest } from './support/courtai.ts';

const QUERY = 'LeBron James last 10 games';
// The Query Prompt is named by its placeholder.
const PROMPT = 'LeBron James this year';

signedOutTest(
  'signing in through the header unlocks the Query Prompt',
  { tags: ['critical'] },
  async ({ app, screen }) => {
    await app.open('/');
    await expect(screen.getByRole('heading', 'Ask the box score')).toBeVisible();
    // Signed out, the prompt is open and says what running it costs.
    await expect(screen.getByRole('textbox', PROMPT)).toBeEnabled();
    await expect(screen.getByText('Free account. Sign up with Google to run it.')).toBeVisible();

    // A rung only fills the box; nothing is run or signed in.
    await screen.getByRole('button', { name: 'Start with a player', exact: false }).tap();
    await expect(screen.getByRole('textbox', PROMPT)).toHaveValue('Jalen Johnson this year');

    await screen.getByRole('button', 'Sign in with Google').tap();

    await expect(screen.getByText('CourtAI Test User').first()).toBeVisible();
    await expect(screen.getByRole('textbox', PROMPT)).toBeEnabled();
  },
);

signedOutTest(
  'running a query signed out signs up and then runs exactly what was typed',
  { tags: ['critical'] },
  async ({ app, screen, browser, api }) => {
    await app.open('/');
    await screen.getByRole('textbox', PROMPT).fill(QUERY);
    await screen.getByRole('textbox', PROMPT).press('Enter');

    await expect(screen.getByRole('heading', 'LeBron James')).toBeVisible();
    await expect(screen.getByText(`"${QUERY}"`)).toBeVisible();
    await expect(browser).toHaveURL(/player_name=LeBron\+James/);
    expect(api.sent('/api/nl-query', 'POST').map((request) => request.body)).toEqual([
      { query: QUERY },
    ]);
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

signedInTest('signing out returns the Query Prompt to sign-up', async ({ app, screen }) => {
  await app.open('/');
  await expect(screen.getByRole('textbox', PROMPT)).toBeEnabled();
  await screen.getByRole('banner').getByRole('button', 'CT CourtAI Test User').tap();
  await screen.getByRole('button', 'Sign out').tap();
  await expect(screen.getByText('Free account. Sign up with Google to run it.')).toBeVisible();
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

signedInTest(
  'an ambiguous player asks for a player before applying filters',
  async ({ app, screen, browser, api }) => {
    // The parser resolved the time clause but could not resolve which Jalen.
    await api.override({ '/api/nl-query': { body: { game_count: 10, confidence: 0.9 } } });
    await app.open('/');
    await screen.getByRole('textbox', PROMPT).fill('Jalen last 10 games');
    await screen.getByRole('textbox', PROMPT).press('Enter');
    await expect(screen.getByText('Choose a player before applying these filters.')).toBeVisible();
    await expect(browser).toHaveURL('/');
    expect(api.sent('/api/nl-query', 'POST').map((request) => request.body)).toEqual([
      { query: 'Jalen last 10 games' },
    ]);
    // The landing ladder reads its own rungs (Jalen Johnson); the query reads none.
    const queryReads = api
      .sent('/api/games/game_logs')
      .filter((request) => request.search.get('player_name') !== 'Jalen Johnson');
    expect(queryReads).toHaveLength(0);
  },
);

signedInTest(
  'an ambiguous name asks which player and applies the one chosen',
  async ({ app, screen, browser, api }) => {
    await app.open('/');
    await screen.getByRole('textbox', PROMPT).fill('Ball last 10 games');
    await screen.getByRole('textbox', PROMPT).press('Enter');

    await expect(screen.getByText('Which player did you mean?')).toBeVisible();
    await expect(screen.getByRole('button', 'LaMelo Ball CHA')).toBeVisible();
    await expect(screen.getByRole('button', 'Lonzo Ball CLE')).toBeVisible();
    // Nothing is applied before the choice.
    await expect(browser).toHaveURL('/');

    await screen.getByRole('button', 'Lonzo Ball CLE').tap();

    await expect(screen.getByRole('heading', 'Game Logs')).toBeVisible();
    await expect(browser).toHaveURL('/?player_name=Lonzo+Ball&game_filter=10');
    expect(api.sent('/api/nl-query', 'POST').map((request) => request.body)).toEqual([
      { query: 'Ball last 10 games' },
    ]);
  },
);

signedInTest(
  'a long list of candidates scrolls inside the panel so the last one can be chosen on a phone',
  async ({ app, screen, browser }) => {
    await browser.setViewport({ width: 375, height: 667 });
    await app.open('/?player_name=LeBron+James&game_filter=10');
    await expect(screen.getByRole('heading', 'Game Logs')).toBeVisible();
    await screen.getByRole('button', 'Open search').tap();
    await screen
      .getByRole('textbox', 'Ask about your favorite player')
      .fill('Williams with Ball without Davis');
    await screen.getByRole('textbox', 'Ask about your favorite player').press('Enter');
    await expect(screen.getByText('Which player did you mean?')).toBeVisible();

    // The panel fits the viewport; its own scroll reaches the rest.
    const fits = await browser.evaluate(() => {
      const panel = document.querySelector('.player-choices');
      return panel !== null && panel.getBoundingClientRect().bottom <= window.innerHeight;
    });
    expect(fits).toBe(true);

    await screen.getByRole('button', 'Player 14 Williams CLE').tap();
    await screen.getByRole('button', 'Lonzo Ball CLE').tap();
    await screen.getByRole('button', 'Terence Davis CLE').tap();

    await expect(browser).toHaveURL(/player_name=Player\+14\+Williams/);
  },
);

signedInTest(
  'browsing without a query abandons a pending question',
  async ({ app, screen, browser, api }) => {
    await app.open('/');
    await screen.getByRole('textbox', PROMPT).fill('Ball last 10 games');
    await screen.getByRole('textbox', PROMPT).press('Enter');
    await expect(screen.getByText('Which player did you mean?')).toBeVisible();

    await screen.getByRole('button', 'Browse without a query').tap();

    await expect(browser).toHaveURL(/browse=1/);
    await expect(screen.getByText('Which player did you mean?')).toBeHidden();
    expect(api.sent('/api/nl-query', 'POST')).toHaveLength(1);
  },
);
