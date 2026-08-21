import {
  BROWSE_PARAM,
  isWorkspaceSearch,
  filterSetFromSearchParams,
  filterSetToSearchParams,
  mergeFilterSet,
  cleanFilterParams,
  convertNLToFilters,
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

  test('accepts a minute range beyond the panel slider', () => {
    // The API caps nothing; overtime games really do log 50+ minutes, so
    // refusing them here would refuse a link the API would honour.
    const { filters, invalid } = decode('minutes_filter=0%2C53');

    expect(invalid).toEqual([]);
    expect(filters.minutes_filter).toBe('0,53');
  });

  test.each([
    ['minutes_filter=20.5%2C40', 'minutes_filter'],
    ['season_filter=2023-25', 'season_filter'],
    ['season_filter=2023-23', 'season_filter'],
  ])('names %s, which the API would reject without naming it', (query, expected) => {
    expect(decode(query).invalid).toContain(expected);
  });

  test('accepts a fractional self-filter range, which the API allows', () => {
    const { filters, invalid } = decode('self_filters%5BFG_PCT%5D=0.4%2C0.6');

    expect(invalid).toEqual([]);
    expect(filters['self_filters[FG_PCT]']).toBe('0.4,0.6');
  });

  test('rejects the same player named present and absent under either spelling', () => {
    // The API resolves names by fuzzy match, so casing and spacing collapse to
    // the same player and the table comes back silently empty.
    const { invalid } = decode(
      'player_name=X&players_on%5B%5D=LeBron+James&players_off%5B%5D=lebron++james',
    );

    expect(invalid).toEqual(['players_off[]']);
  });

  test('never partially applies a Filter Set containing an invalid value', () => {
    const { filters, invalid } = decode('player_name=LeBron+James&game_filter=-3');

    expect(invalid).toEqual(['game_filter']);
    expect(filters).toEqual({});
  });
});

describe('filterSetToSearchParams', () => {
  const roundTrip = (filters) =>
    filterSetFromSearchParams(filterSetToSearchParams(filters)).filters;

  test('round-trips every recognised parameter through the decode direction', () => {
    const filters = {
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
      'teams_against[]': ['Isolation', 'Transition'],
      'rank_filter[]': [5, -8],
      'self_filters[PTS]': '20,60',
    };

    expect(roundTrip(filters)).toEqual(filters);
  });

  test('writes repeated parameters under the names the API reads', () => {
    const search = filterSetToSearchParams({
      'players_on[]': ['A', 'B'],
      'teams_against[]': ['Isolation'],
      'rank_filter[]': [5],
    });

    expect(search.getAll('players_on[]')).toEqual(['A', 'B']);
    expect(search.getAll('teams_against[]')).toEqual(['Isolation']);
    expect(search.getAll('rank_filter[]')).toEqual(['5']);
  });

  test('omits blank values rather than writing parameters nobody chose', () => {
    const search = filterSetToSearchParams({
      player_name: 'LeBron James',
      date_filter: null,
      game_filter: '',
      'players_on[]': [],
    });

    expect(search.toString()).toBe('player_name=LeBron+James');
  });

  test('writes nothing for a key outside the API vocabulary', () => {
    // Prose is scaffolding, not part of the Filter Set, and the frontend-only
    // player key never reaches the wire either.
    const search = filterSetToSearchParams({
      player_name: 'LeBron James',
      selectedPlayer: 'LeBron James',
      query: 'LeBron last 10 games',
    });

    expect(search.toString()).toBe('player_name=LeBron+James');
  });

  test('an empty Filter Set writes an empty query string', () => {
    expect(filterSetToSearchParams({}).toString()).toBe('');
  });
});

describe('mergeFilterSet', () => {
  test('patches only the parameters the panel named', () => {
    // A season arrives from a Parsed Query and no panel control can express it,
    // so adjusting an unrelated filter must not drop it.
    expect(
      mergeFilterSet(
        { player_name: 'LeBron James', season_filter: '2023-24', game_filter: 10 },
        { player_name: 'LeBron James', game_filter: 5 },
      ),
    ).toEqual({ player_name: 'LeBron James', season_filter: '2023-24', game_filter: 5 });
  });

  test('a blank patch value clears its parameter', () => {
    expect(
      mergeFilterSet({ game_filter: 10, date_filter: '2026-01-09' }, { date_filter: null }),
    ).toEqual({ game_filter: 10 });
  });

  test('an untouched control leaves its parameter exactly as it was', () => {
    const current = { player_name: 'LeBron James', minutes_filter: '20,40' };

    expect(mergeFilterSet(current, { player_name: 'LeBron James' })).toEqual(current);
  });
});

describe('isWorkspaceSearch', () => {
  const gate = (query) => isWorkspaceSearch(new URLSearchParams(query));

  test('a bare route is the Query Prompt', () => {
    expect(gate('')).toBe(false);
  });

  test('the sentinel alone opens an empty Log Workspace', () => {
    // Manual entry lands with no filters, and an empty Filter Set is otherwise
    // indistinguishable from a fresh visit.
    expect(gate(`${BROWSE_PARAM}=1`)).toBe(true);
  });

  test('any Filter Set opens the Log Workspace', () => {
    expect(gate('player_name=LeBron+James')).toBe(true);
    expect(gate('game_filter=10')).toBe(true);
  });

  test('a link we must refuse still opens the Workspace, to say so', () => {
    expect(gate('game_filter=0')).toBe(true);
  });

  test('a stray tracking parameter is not an entry', () => {
    expect(gate('utm_source=newsletter')).toBe(false);
  });

  test('the sentinel is not a filter and never reaches a request', () => {
    const { filters, invalid } = filterSetFromSearchParams(
      new URLSearchParams(`player_name=LeBron+James&${BROWSE_PARAM}=1`),
    );

    expect(invalid).toEqual([]);
    expect(filters).toEqual({ player_name: 'LeBron James' });
    expect(filterSetToSearchParams(filters).has(BROWSE_PARAM)).toBe(false);
  });
});
