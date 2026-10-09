// Flow: Query reference. /help is a route, survives reload, hands an example
// back to the Query Prompt, and never discards a half-typed draft.
import { expect } from 'e2e';
import { overflowsHorizontally, signedInTest } from './support/courtai.ts';

const PROMPT = 'LeBron James this year';
const EXAMPLE = 'Giannis games at home with 10+ FGA playing 30+ minutes';

signedInTest(
  'the reference is linkable and hands an example back to search',
  { tags: ['critical'] },
  async ({ app, screen, browser }) => {
    await app.open('/');
    await screen.getByRole('link', 'Every filter we understand').tap();

    await expect(browser).toHaveURL('/help');
    await expect(screen.getByRole('heading', 'Query reference')).toBeVisible();
    const clauses = screen.getByRole('region', 'Clauses');
    await expect(clauses.getByRole('rowheader', 'last')).toBeVisible();
    await expect(clauses.getByRole('cell', 'Only the most recent N games.')).toBeVisible();
    await expect(screen.getByRole('rowheader', 'Less Than 10 ft')).toBeVisible();
    await expect(screen.getByRole('rowheader', 'PRRollMan')).toBeVisible();
    expect(await overflowsHorizontally(browser)).toBe(false);

    await browser.reload();
    await expect(screen.getByRole('heading', 'Query reference')).toBeVisible();

    await screen.getByRole('link', EXAMPLE).tap();
    await expect(screen.getByRole('heading', 'Ask the box score')).toBeVisible();
    await expect(screen.getByRole('textbox', PROMPT)).toHaveValue(EXAMPLE);
  },
);

signedInTest(
  'consulting the reference keeps a half-typed query through the link and browser Back',
  async ({ app, screen, browser }) => {
    const draft = 'Luka last 10 games';
    await app.open('/');
    await screen.getByRole('textbox', PROMPT).fill(draft);
    await screen.getByRole('link', 'Every filter we understand').tap();
    await expect(screen.getByRole('heading', 'Query reference')).toBeFocused();
    // Browser Back lands on the entry the link stamped, not one a click pushed.
    await browser.back();
    await expect(screen.getByRole('textbox', PROMPT)).toHaveValue(draft);
    await screen.getByRole('link', 'Every filter we understand').tap();

    await screen.getByRole('link', { name: 'Back to search', exact: false }).tap();
    await expect(screen.getByRole('textbox', PROMPT)).toHaveValue(draft);

    await screen.getByRole('link', 'Every filter we understand').tap();
    await expect(screen.getByRole('heading', 'Query reference')).toBeVisible();
    await browser.back();
    await expect(screen.getByRole('textbox', PROMPT)).toHaveValue(draft);
  },
);

signedInTest(
  'the three-step landing guide loads each example into the prompt',
  async ({ app, screen, browser }) => {
    await app.open('/');
    for (const [rung, query] of [
      ['Start with a player', 'Jalen Johnson this year'],
      ['Narrow it down', 'Jalen Johnson this year without Trae Young'],
      [
        'Stack the filters',
        'Jalen Johnson this year without Trae Young against bottom 10 defenses playing 25+ minutes',
      ],
    ]) {
      await screen.getByRole('button', { name: rung, exact: false }).tap();
      await expect(screen.getByRole('textbox', PROMPT)).toHaveValue(query);
    }
    expect(await overflowsHorizontally(browser)).toBe(false);
  },
);

signedInTest(
  'the agent finds a filter in the reference and runs its example',
  { tags: ['agent'] },
  async ({ app, agent, screen, browser }) => {
    await app.open('/');
    await agent.act('open the list of every filter the search understands');
    await expect(browser).toHaveURL('/help');
    await expect(screen.getByRole('heading', 'Query reference')).toBeVisible();

    await agent.act('use the example query {example}', { params: { example: EXAMPLE } });
    await expect(screen.getByRole('textbox', PROMPT)).toHaveValue(EXAMPLE);
  },
);
