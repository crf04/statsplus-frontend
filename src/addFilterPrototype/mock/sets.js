/* PROTOTYPE — throwaway. Synthetic Saved Filter Sets for the public standalone link. */
export const STANDALONE_SETS = [
  ['JJ without Trae', 'player_name=Jalen+Johnson&players_off%5B%5D=Trae+Young&game_filter=15'],
  [
    'JJ vs soft boards',
    'player_name=Jalen+Johnson&teams_against%5B%5D=OPP_REB&rank_filter%5B%5D=-8',
  ],
  ['JJ home, 30+ min', 'player_name=Jalen+Johnson&location_filter=Home&minutes_filter=30%2C48'],
  ['JJ last 10', 'player_name=Jalen+Johnson&game_filter=10'],
  [
    'LeBron vs top rebounding D',
    'player_name=LeBron+James&teams_against%5B%5D=OPP_REB&rank_filter%5B%5D=10',
  ],
  [
    'LeBron vs top-5 assists D',
    'player_name=LeBron+James&teams_against%5B%5D=OPP_AST&rank_filter%5B%5D=5',
  ],
  ['Reaves last 10 away', 'player_name=Austin+Reaves&game_filter=10&location_filter=Away'],
  ['Brunson 25+ pts nights', 'player_name=Jalen+Brunson&self_filters%5BPTS%5D=25%2C999'],
].map(([name, query_string], index) => ({ id: `set-${index + 1}`, name, query_string }));
