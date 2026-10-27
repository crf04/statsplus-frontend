import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import HomeTonight from './HomeTonight';
import HomeTicker from './HomeTicker';

// Target cards read Conditions through the account's roster cache.
jest.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ currentUser: { uid: 'reader-a' }, isAuthenticated: true, loading: false }),
}));

const reason = {
  base: 'play_types',
  sliceKey: 'Transition',
  share: 0.291,
  leagueAverageShare: 0.183,
  opponentRank: 29,
  opponentPercentVsLeague: 18.8,
};

const games = [
  {
    gameId: 'g1',
    away: { tricode: 'MIA' },
    home: { tricode: 'WAS' },
    scheduledAt: '2026-04-10T23:00:00Z',
    effects: [
      {
        canonicalId: 1,
        name: 'Kel’el Ware',
        tricode: 'MIA',
        seasonScoring: 11,
        value: 0.11,
        thin: false,
      },
      {
        canonicalId: 2,
        name: 'Wendell Carter Jr.',
        tricode: 'WAS',
        seasonScoring: 12,
        value: -0.08,
        thin: false,
      },
    ],
    scores: new Map([
      [10, 0.04],
      [11, -0.07],
    ]),
  },
];

const spotlight = {
  best: {
    gameId: 'g1',
    canonicalId: 3,
    name: 'Jaime Jaquez Jr.',
    tricode: 'MIA',
    opponent: 'WAS',
    seasonScoring: 15.4,
    value: 0.0674,
    reason,
  },
  toughest: null,
};

const entry = (id, opponent, fits) => ({
  target: {
    id,
    opponent,
    title: '',
    qualifiers: [
      { base: 'play_types', sliceKey: 'Spotup', comparator: 'at_or_above', threshold: 0.384 },
    ],
  },
  game: {
    gameId: 'g1',
    scheduledAt: '2026-04-10T23:00:00Z',
    away: { tricode: 'MIA' },
    home: { tricode: 'WAS' },
  },
  players: fits.map(([canonicalId, name]) => ({
    canonicalId,
    name,
    tricode: 'MIA',
    shares: [{ share: 0.39, leagueAverageShare: 0.25 }],
  })),
});

const renderTonight = (props = {}) =>
  render(
    <MemoryRouter>
      <HomeTonight
        games={games}
        spotlight={spotlight}
        targets={null}
        onUseQuery={() => {}}
        {...props}
      />
    </MemoryRouter>,
  );

test('the ticker lists each game with its effects by last name and links to its Matchup', () => {
  render(
    <MemoryRouter>
      <HomeTicker slateDate="2026-04-10" games={games} />
    </MemoryRouter>,
  );

  expect(screen.getByRole('link', { name: /^Fri, Apr 10\s+1 game$/ })).toHaveAttribute(
    'href',
    '/matchups',
  );
  const tip = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(
    new Date('2026-04-10T23:00:00Z'),
  );
  const cell = screen.getByRole('link', {
    name: `MIA at WAS Matchup, ${tip}, Ware +11%, Carter −8%`,
  });
  expect(cell).toHaveAttribute('href', '/matchups/g1');
  expect(cell).toHaveTextContent(
    new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(
      new Date('2026-04-10T23:00:00Z'),
    ),
  );
  expect(
    within(cell)
      .getAllByRole('listitem')
      .map((row) => row.textContent),
  ).toEqual(['Ware+11%', 'Carter−8%']);
});

test('Best shows the score, the game and the reason; Try it fills the prompt', () => {
  const onUseQuery = jest.fn();
  renderTonight({ onUseQuery });

  const best = screen.getByRole('article', { name: 'Best: Jaime Jaquez Jr.' });
  expect(best).toHaveTextContent('+6.7%');
  expect(best).toHaveTextContent('vs WAS');
  expect(best).toHaveTextContent('Transition 29% of plays · WAS allow the 2nd most');

  fireEvent.click(within(best).getByRole('button', { name: 'Try it' }));
  expect(onUseQuery).toHaveBeenCalledWith('Jaime Jaquez Jr. this year against bottom 10 defenses');
});

test('a missing pick says so instead of leaving a gap', () => {
  renderTonight();

  expect(screen.getByText('No standout matchup')).toBeInTheDocument();
});

test('Targets show the two with most fits, each fit with its points Matchup score', () => {
  renderTonight({
    targets: {
      total: 3,
      firing: [
        entry(7, 'WAS', [
          [10, 'Tyler Herro'],
          [11, 'Bam Adebayo'],
          [12, 'Andrew Wiggins'],
        ]),
        entry(8, 'MIA', [[13, 'Jordan Poole']]),
        entry(9, 'BOS', [[14, 'Jayson Tatum']]),
      ],
    },
  });

  const cards = screen.getAllByRole('link', { name: /fit$/ });
  expect(cards.map((card) => card.getAttribute('href'))).toEqual(['/targets/7', '/targets/8']);
  const rows = within(cards[0])
    .getAllByRole('listitem')
    .map((row) => row.textContent);
  expect(rows).toEqual(['Tyler Herro MIA39%+4%', 'Bam Adebayo MIA39%−7%']);
  expect(cards[0]).toHaveTextContent('Spot up ≥ 38.4%');
  expect(cards[0]).toHaveTextContent('3 fit');
  // A fit missing from the game's scores reads as unknown, not zero.
  expect(within(cards[1]).getAllByRole('listitem')[0]).toHaveTextContent('Jordan Poole MIA39%–');
  expect(screen.getByRole('link', { name: 'All 3 firing' })).toHaveAttribute('href', '/targets');
});

test('a fit shows his Position beside his name, and a Target with no Diet share shows a dash', () => {
  const positioned = entry(7, 'WAS', [[10, 'Tyler Herro']]);
  positioned.players[0].position = 'Guard';
  const ruleOnly = entry(8, 'MIA', [[13, 'Jordan Poole']]);
  ruleOnly.target.qualifiers = [{ base: 'position', groups: ['Guard'] }];
  ruleOnly.players[0] = { ...ruleOnly.players[0], position: 'Guard', shares: [] };
  renderTonight({ targets: { total: 2, firing: [positioned, ruleOnly] } });

  const cards = screen.getAllByRole('link', { name: /fit$/ });
  expect(within(cards[0]).getAllByRole('listitem')[0].textContent).toBe('Tyler Herro MIAGuard39%+4%');
  expect(cards[1]).toHaveTextContent('Guard');
  expect(within(cards[1]).getAllByRole('listitem')[0].textContent).toBe('Jordan Poole MIAGuard––');
});

test('no firing Target and no Targets at all read differently', () => {
  const { unmount } = renderTonight({ targets: { total: 2, firing: [] } });
  expect(screen.getByText('None of your Targets fire today')).toBeInTheDocument();
  unmount();

  renderTonight({ targets: { total: 0, firing: [] } });
  expect(screen.getByRole('link', { name: 'Set a Target' })).toHaveAttribute('href', '/targets');
});

test('signed out, Your Targets is a sign-up card instead of Targets', () => {
  renderTonight({ signUp: true });

  const column = screen.getByRole('region', { name: 'Your Targets' });
  expect(column).toHaveTextContent(
    'A Target watches one opponent and flags every player who fits, on game day.',
  );
  expect(within(column).getByRole('button', { name: 'Sign up free' })).toBeInTheDocument();
  expect(within(column).queryByRole('link')).not.toBeInTheDocument();
});

test('a failed Targets read leaves Tonight on its own', () => {
  renderTonight({ targets: null });

  expect(screen.getByRole('heading', { name: 'Tonight' })).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'Your Targets' })).not.toBeInTheDocument();
});

test("a Target's saved Conditions show under its criteria", () => {
  const dated = entry(7, 'WAS', [[10, 'Tyler Herro']]);
  dated.target.conditions = { defender: null, from: '2026-01-01', to: null, playerMinutes: null };
  renderTonight({ targets: { total: 1, firing: [dated] } });

  expect(screen.getByRole('link', { name: /fit$/ })).toHaveTextContent('from 2026-01-01');
});

test('a pick without a readable reason shows no reason line', () => {
  renderTonight({ spotlight: { best: { ...spotlight.best, reason: null }, toughest: null } });

  const best = screen.getByRole('article', { name: 'Best: Jaime Jaquez Jr.' });
  expect(best).toHaveTextContent('+6.7%');
  expect(best).not.toHaveTextContent('of plays');
});

test('the most recent game day is labelled and links to its date', () => {
  render(
    <MemoryRouter>
      <HomeTicker slateDate="2026-04-10" games={games} fallback="previous_game_day" />
      <HomeTonight
        games={games}
        spotlight={spotlight}
        targets={null}
        onUseQuery={() => {}}
        slateDate="2026-04-10"
        fallback="previous_game_day"
      />
    </MemoryRouter>,
  );

  expect(screen.getByRole('link', { name: /^Last game day · Fri, Apr 10/ })).toHaveAttribute(
    'href',
    '/matchups?date=2026-04-10',
  );
  expect(screen.getByRole('heading', { name: 'Last game day' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Matchups' })).toHaveAttribute(
    'href',
    '/matchups?date=2026-04-10',
  );
});

test('the next game day is labelled and links to its date', () => {
  render(
    <MemoryRouter>
      <HomeTicker slateDate="2026-10-20" games={games} fallback="next_game_day" />
      <HomeTonight
        games={games}
        spotlight={spotlight}
        targets={null}
        onUseQuery={() => {}}
        slateDate="2026-10-20"
        fallback="next_game_day"
      />
    </MemoryRouter>,
  );

  expect(screen.getByRole('link', { name: /^Next game day · Tue, Oct 20/ })).toHaveAttribute(
    'href',
    '/matchups?date=2026-10-20',
  );
  expect(screen.getByRole('heading', { name: 'Next game day' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Matchups' })).toHaveAttribute(
    'href',
    '/matchups?date=2026-10-20',
  );
});
