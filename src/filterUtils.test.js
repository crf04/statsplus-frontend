import {
  filterSetFromSearchParams,
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

describe('filterSetFromSearchParams', () => {
  const decode = (query) => filterSetFromSearchParams(new URLSearchParams(query));

  test('decodes every recognised parameter into a request-ready Filter Set', () => {
    const { filters, invalid } = decode(
      'player_name=LeBron+James&season_filter=2023-24&minutes_filter=20%2C40' +
        '&date_filter=2026-01-09&location_filter=Home&game_filter=10' +
        '&playstyle_RTG_min=80&playstyle_RTG_max=120' +
        '&players_on%5B%5D=Anthony+Davis&players_off%5B%5D=Austin+Reaves' +
        '&teams_against%5B%5D=Isolation&rank_filter%5B%5D=5' +
        '&self_filters%5BPTS%5D=20%2C60',
    );

    expect(invalid).toEqual([]);
    expect(filters).toEqual({
      player_name: 'LeBron James',
      season_filter: '2023-24',
      minutes_filter: '20,40',
      date_filter: '2026-01-09',
      location_filter: 'Home',
      game_filter: 10,
      playstyle_RTG_min: 80,
      playstyle_RTG_max: 120,
      'players_on[]': ['Anthony Davis'],
      'players_off[]': ['Austin Reaves'],
      'teams_against[]': ['Isolation'],
      'rank_filter[]': [5],
      'self_filters[PTS]': '20,60',
    });
  });

  test('keeps repeated parameters in order', () => {
    const { filters } = decode(
      'players_on%5B%5D=A&players_on%5B%5D=B&teams_against%5B%5D=Isolation' +
        '&teams_against%5B%5D=Transition&rank_filter%5B%5D=5&rank_filter%5B%5D=-8',
    );

    expect(filters['players_on[]']).toEqual(['A', 'B']);
    expect(filters['teams_against[]']).toEqual(['Isolation', 'Transition']);
    expect(filters['rank_filter[]']).toEqual([5, -8]);
  });

  test('decodes a Filter Set carrying no player', () => {
    const { filters, invalid } = decode('game_filter=10&location_filter=Away');

    expect(invalid).toEqual([]);
    expect(filters).toEqual({ game_filter: 10, location_filter: 'Away' });
  });

  test('ignores unrecognised parameters instead of failing', () => {
    const { filters, invalid } = decode('player_name=LeBron+James&utm_source=twitter&ref=abc');

    expect(invalid).toEqual([]);
    expect(filters).toEqual({ player_name: 'LeBron James' });
  });

  test('empty search parameters decode to an empty Filter Set', () => {
    expect(decode('')).toEqual({ filters: {}, invalid: [] });
  });

  test.each([
    ['minutes_filter=oops', 'minutes_filter'],
    ['minutes_filter=40%2C20', 'minutes_filter'],
    ['minutes_filter=0%2C60', 'minutes_filter'],
    ['location_filter=Somewhere', 'location_filter'],
    ['game_filter=-3', 'game_filter'],
    ['game_filter=1.5', 'game_filter'],
    ['date_filter=2026-13-45', 'date_filter'],
    ['playstyle_RTG_min=abc', 'playstyle_RTG_min'],
    ['playstyle_RTG_min=120&playstyle_RTG_max=80', 'playstyle_RTG_max'],
    ['player_name=+', 'player_name'],
    ['self_filters%5BPTS%5D=20', 'self_filters[PTS]'],
    ['teams_against%5B%5D=Isolation&rank_filter%5B%5D=0', 'rank_filter[]'],
    ['teams_against%5B%5D=Isolation', 'rank_filter[]'],
  ])('names %s as invalid rather than guessing', (query, expected) => {
    const { invalid } = decode(query);
    expect(invalid).toContain(expected);
  });

  test('normalises a numerically valid range to plain decimals', () => {
    // The backend parses "low,high" as plain numbers; exponent and hex spellings
    // satisfy Number() but are not what it reads, so canonicalise them here.
    const { filters, invalid } = decode(
      'minutes_filter=1e1%2C2e1&self_filters%5BPTS%5D=0x10%2C0x20',
    );

    expect(invalid).toEqual([]);
    expect(filters.minutes_filter).toBe('10,20');
    expect(filters['self_filters[PTS]']).toBe('16,32');
  });

  test('rejects a repeated scalar rather than honouring only the first', () => {
    const { filters, invalid } = decode('player_name=X&game_filter=5&game_filter=-3');

    expect(invalid).toEqual(['game_filter']);
    expect(filters).toEqual({});
  });

  test.each([
    ['season_filter=banana', 'season_filter'],
    ['season_filter=2025', 'season_filter'],
    ['game_filter=0', 'game_filter'],
  ])('names %s as invalid rather than letting the API reject it', (query, expected) => {
    expect(decode(query).invalid).toContain(expected);
  });

  test('accepts opponent filters the panel does not offer', () => {
    // The API's rankable vocabulary is wider than the panel dropdown; a link
    // written from the API documentation must not be refused here.
    const { filters, invalid } = decode('teams_against%5B%5D=Arc3Assists&rank_filter%5B%5D=8');

    expect(invalid).toEqual([]);
    expect(filters['teams_against[]']).toEqual(['Arc3Assists']);
  });

  test('rejects a player named both present and absent', () => {
    // The API intersects on-games then subtracts off-games, so naming one
    // player in both returns an empty table with no error.
    const { filters, invalid } = decode(
      'player_name=X&players_on%5B%5D=LeBron+James&players_off%5B%5D=LeBron+James',
    );

    expect(invalid).toEqual(['players_off[]']);
    expect(filters).toEqual({});
  });

  test('never partially applies a Filter Set containing an invalid value', () => {
    const { filters, invalid } = decode('player_name=LeBron+James&game_filter=-3');

    expect(invalid).toEqual(['game_filter']);
    expect(filters).toEqual({});
  });
});
