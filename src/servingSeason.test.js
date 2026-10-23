import { trailingNote } from './servingSeason';

const TEN_GAMES = 'every team has played 10 games';

test('names families that share a season and a rule in one clause', () => {
  expect(
    trailingNote([
      { family: 'team_defense', servingSeason: '2025-26', rule: TEN_GAMES },
      { family: 'player_diets', servingSeason: '2025-26', rule: TEN_GAMES },
      { family: 'synergy', servingSeason: '2025-26', rule: TEN_GAMES },
    ]),
  ).toBe(
    'Scores use 2025-26 team defense, Diets and play types until every team has played 10 games.',
  );
});

test('gives a family with its own rule its own clause', () => {
  expect(
    trailingNote([
      { family: 'player_diets', servingSeason: '2025-26', rule: TEN_GAMES },
      { family: 'synergy', servingSeason: '2025-26', rule: 'NBA publishes 2026-27 play types' },
    ]),
  ).toBe(
    'Scores use 2025-26 Diets until every team has played 10 games, and 2025-26 play types until NBA publishes 2026-27 play types.',
  );
});

test('says nothing when no family trails or the backend predates the list', () => {
  expect(trailingNote([])).toBeNull();
  expect(trailingNote(undefined)).toBeNull();
});
