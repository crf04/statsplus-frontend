import {
  cleanFilterParams,
  convertNLToFilters,
  filtersForDisplay,
  toGameLogParams,
} from './filterUtils';

describe('filterUtils', () => {
  test('cleans blank values without dropping meaningful zeroes', () => {
    expect(
      cleanFilterParams({
        game_filter: 0,
        minutes_filter: '0,48',
        empty: '',
        missing: null,
        emptyList: [],
        players: ['Stephen Curry', ''],
      }),
    ).toEqual({
      game_filter: 0,
      minutes_filter: '0,48',
      players: ['Stephen Curry'],
    });
  });

  test('translates natural-language ranges through one canonical shape', () => {
    expect(
      convertNLToFilters({
        player_name: 'Stephen Curry',
        minutes_filter: { min: 30, max: 48 },
        self_filters: [{ stat_column: 'FGA', operator: 'gt', value: '15' }],
        players_on: ['Jimmy Butler'],
      }),
    ).toEqual({
      selectedPlayer: 'Stephen Curry',
      minutes_filter: '30,48',
      'self_filters[FGA]': '16,999',
      'players_on[]': ['Jimmy Butler'],
    });
  });

  test('moves the frontend player key at the request seam', () => {
    expect(toGameLogParams({ selectedPlayer: 'A player', game_filter: 0 })).toEqual({
      player_name: 'A player',
      game_filter: 0,
    });
  });

  test('hides incomplete NL playstyle defaults from display filters', () => {
    expect(filtersForDisplay({ playstyle_RTG_min: 75 }, { naturalLanguage: true })).toEqual({});
    expect(
      filtersForDisplay(
        { playstyle_RTG_min: 80, playstyle_RTG_max: 120 },
        { naturalLanguage: true },
      ),
    ).toEqual({ playstyle_RTG_min: 80, playstyle_RTG_max: 120 });
  });
});
