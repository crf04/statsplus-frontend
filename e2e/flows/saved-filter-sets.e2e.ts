// Flow: Saved Filter Sets. Save the Log Workspace under a name, reopen it from
// the landing list, rename and delete it from the account menu.
import { expect } from 'e2e';
import { signedInTest, signedOutTest } from './support/courtai.ts';

signedInTest(
  'a saved Filter Set reopens the same workspace, then is renamed and deleted',
  { tags: ['critical'] },
  async ({ app, screen, browser, api }) => {
    await app.open('/?player_name=LeBron+James&game_filter=10');
    await expect(screen.getByRole('heading', 'Game Logs')).toBeVisible();

    await screen.getByRole('button', 'Save Filter Set').tap();
    await screen.getByLabel('Name').fill('LeBron last 10');
    await screen.getByRole('button', 'Save').tap();
    await expect(screen.getByRole('heading', 'Save this Filter Set')).toBeHidden();
    const [saved] = api.sent('/api/user/saved-filter-sets', 'POST');
    expect(saved.body).toMatchObject({ name: 'LeBron last 10' });
    expect(String((saved.body as { query_string: string }).query_string)).toContain(
      'game_filter=10',
    );

    // The same name twice is the backend's refusal, shown rather than swallowed.
    await screen.getByRole('button', 'Save Filter Set').tap();
    await screen.getByLabel('Name').fill('LeBron last 10');
    await screen.getByRole('button', 'Save').tap();
    await expect(screen.getByRole('alert')).toContainText('already have a saved Filter Set');
    await screen.getByRole('button', 'Cancel').tap();
    await screen.getByRole('button', 'Save Filter Set').tap();
    await expect(screen.getByLabel('Name')).toHaveValue('');
    await expect(screen.getByRole('dialog').getByRole('alert')).toHaveCount(0);
    await screen.getByRole('button', 'Cancel').tap();

    await screen.getByRole('button', 'Back to search').tap();
    await expect(browser).toHaveURL('/');
    await screen.getByRole('button', 'Saved Filter Sets').tap();
    await expect(screen.getByRole('dialog').getByText('last 10')).toBeVisible();
    await screen.getByRole('button', 'Open saved Filter Set LeBron last 10').tap();

    await expect(browser).toHaveURL('/?player_name=LeBron+James&game_filter=10');
    await expect(screen.getByText('GAMES <= 10').first()).toBeVisible();
    await expect(screen.getByRole('cell', '31')).toBeVisible();
    await expect(screen.getByRole('dialog')).toHaveCount(0);
    await browser.reload();
    await expect(screen.getByRole('cell', '31')).toBeVisible();

    const banner = screen.getByRole('banner');
    await banner.getByRole('button', 'CT CourtAI Test User').tap();
    await banner.getByRole('button', 'Saved Filter Sets').tap();
    await screen.getByRole('button', 'Rename LeBron last 10').tap();
    await screen.getByLabel('New name for LeBron last 10').fill('LeBron recent form');
    await screen.getByRole('button', 'Save name').tap();
    await expect(
      screen.getByRole('button', 'Open saved Filter Set LeBron recent form'),
    ).toBeVisible();

    await screen.getByRole('button', 'Delete LeBron recent form').tap();
    await screen.getByRole('button', 'Confirm deleting LeBron recent form').tap();
    await expect(
      screen.getByText('You have not saved any Filter Sets yet', { exact: false }),
    ).toBeVisible();
    expect(api.sent('/api/user/saved-filter-sets/1', 'DELETE').length).toBe(1);
  },
);

signedInTest('an account with no saved Filter Sets is told so', async ({ app, screen }) => {
  await app.open('/');
  await screen.getByRole('button', 'Saved Filter Sets').tap();
  await expect(
    screen.getByText('You have not saved any Filter Sets yet', { exact: false }),
  ).toBeVisible();
});

signedOutTest(
  'signed-out readers are offered no saved Filter Sets',
  async ({ app, screen, api }) => {
    await app.open('/?player_name=LeBron+James&game_filter=10');
    await expect(
      screen.getByText('Sign in to load these game logs', { exact: false }),
    ).toBeVisible();
    await expect(screen.getByRole('button', 'Save Filter Set')).toHaveCount(0);
    await expect(screen.getByRole('button', 'Saved Filter Sets')).toHaveCount(0);
    expect(api.sent('/api/user/saved-filter-sets')).toHaveLength(0);

    await app.open('/');
    await expect(screen.getByRole('heading', 'Ask the box score')).toBeVisible();
    await expect(screen.getByRole('button', 'Browse without a query')).toBeDisabled();
    await expect(screen.getByRole('button', 'Saved Filter Sets')).toHaveCount(0);
  },
);

signedInTest(
  'the agent saves the workspace under a name',
  { tags: ['agent'] },
  async ({ app, agent, screen, api }) => {
    await app.open('/?player_name=LeBron+James&game_filter=10');
    await expect(screen.getByRole('heading', 'Game Logs')).toBeVisible();

    await agent.act('save these filters as {name}', { params: { name: 'LeBron last 10' } });
    await expect(screen.getByRole('heading', 'Save this Filter Set')).toBeHidden();
    await screen.getByRole('button', 'Back to search').tap();
    await screen.getByRole('button', 'Saved Filter Sets').tap();
    await expect(screen.getByRole('button', 'Open saved Filter Set LeBron last 10')).toBeVisible();
    expect(api.sent('/api/user/saved-filter-sets', 'POST').at(-1)?.body).toMatchObject({
      name: 'LeBron last 10',
    });
  },
);
