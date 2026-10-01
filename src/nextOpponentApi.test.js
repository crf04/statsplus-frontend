import { decodeNextOpponent } from './nextOpponentApi';

const response = {
  next_game: {
    game_id: '0022600001',
    date: '2026-10-22',
    opponent: 'CHA',
    opponent_name: 'Charlotte Hornets',
    home: false,
  },
  opponent_ranks: [
    {
      group: 'Play type',
      label: 'Transition',
      value: 1.17,
      vs_league_pct: 17,
      most_rank: 19,
      ranked_teams: 20,
      team_filter: 'Transition',
      unit: 'league_ratio',
    },
  ],
};

test('decodes a scheduled opponent and preserves the direct reduced-population rank', () => {
  expect(decodeNextOpponent(response)).toEqual({
    next_game: {
      game_id: '0022600001',
      date: '2026-10-22',
      opponent: 'CHA',
      opponent_name: 'Charlotte Hornets',
      home: false,
    },
    opponent_ranks: [
      {
        group: 'Play type',
        label: 'Transition',
        value: 1.17,
        vs_league_pct: 17,
        most_rank: 19,
        ranked_teams: 20,
        team_filter: 'Transition',
        unit: 'league_ratio',
      },
    ],
  });
  expect(decodeNextOpponent({ next_game: null, opponent_ranks: [] })).toEqual({
    next_game: null,
    opponent_ranks: [],
  });
});

test.each([
  { ...response, next_game: {} },
  { ...response, opponent_ranks: null },
  { ...response, opponent_ranks: [{ ...response.opponent_ranks[0], most_rank: 21 }] },
  { ...response, opponent_ranks: [{ ...response.opponent_ranks[0], value: '1.17' }] },
  { ...response, opponent_ranks: [{ ...response.opponent_ranks[0], unit: 'points' }] },
])('rejects unusable contract values', (payload) => {
  expect(() => decodeNextOpponent(payload)).toThrow(/invalid/);
});
