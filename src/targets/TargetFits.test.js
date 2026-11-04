import { render, screen, within } from '@testing-library/react';
import { SlateGameTargets, TargetFitTable, TargetTitle } from './TargetFits';

const fit = (overrides) => ({
  canonicalId: 1,
  name: 'Big Fit',
  tricode: 'MEM',
  position: 'Big',
  seasonScoring: 12.5,
  thin: false,
  shares: [{ share: 0.44, leagueAverageShare: 0.2 }],
  ...overrides,
});

// A backend deployed before crf04/statsplus#423: no lines, no last five.
const entry = {
  target: {
    id: 7,
    title: 'MEM vs Big, Corner 3 ≥ 40%, 3PA avg ≥ 0.3',
    note: '',
    qualifiers: [
      { base: 'position', groups: ['Big'] },
      { base: 'shot_zones', sliceKey: 'Corner 3', comparator: 'at_or_above', threshold: 0.4 },
      { base: 'season_average', stat: '3PA', comparator: 'at_or_above', threshold: 0.3 },
    ],
  },
  game: { opposingTeam: { tricode: 'MEM' } },
  availability: { status: 'available', source: 'player_pool', unavailableReason: null },
  players: [
    fit(),
    fit({ canonicalId: 2, name: 'No Label', position: null, seasonScoring: 9, shares: [] }),
  ],
};

// Decoded last games, newest first, as the resolve decoder returns them.
const games = (...values) =>
  values.map((value, index) => ({
    gameId: `00225000${10 - index}`,
    gameDate: `2026-01-${String(20 - index).padStart(2, '0')}`,
    value,
  }));

const headers = () => screen.getAllByRole('columnheader').map((cell) => cell.textContent);
const rows = () =>
  screen
    .getAllByRole('row')
    .slice(1)
    .map((row) => row.textContent);

test('a backend without lines or last five renders the card as before, without share columns', () => {
  render(<TargetFitTable entry={entry} />);
  expect(screen.getByRole('table', { name: `Fits for ${entry.target.title}` })).toBeVisible();
  expect(headers()).toEqual(['Player', 'Avg PTS']);
  expect(rows()).toEqual(['Big Fit Big12.5', 'No Label9.0']);
  expect(screen.queryByText('44%')).not.toBeInTheDocument();
});

test('a Target stored as [Diet, Position] reads with the Position first', () => {
  const { container } = render(
    <TargetTitle
      target={{
        opponent: 'MEM',
        qualifiers: [
          { base: 'shot_zones', sliceKey: 'Corner 3', comparator: 'at_or_above', threshold: 0.4 },
          { base: 'position', groups: ['Big'] },
          { base: 'season_average', stat: '3PA', comparator: 'at_or_above', threshold: 0.3 },
        ],
      }}
    />,
  );
  expect(container.textContent).toBe('MEMvsBig & Corner 3 ≥ 40% & 3PA avg ≥ 0.3');
});

const graded = (statPreferences) => ({
  ...entry,
  target: { ...entry.target, statPreferences },
  statColumns: ['PTS', '3PA'],
  players: [
    { ...entry.players[0], seasonAverages: { PTS: 12.5, '3PA': 1.25 } },
    { ...entry.players[1], seasonAverages: { PTS: 9, '3PA': null } },
  ],
});

test('a fit shows the stat its Target is graded by, not points', () => {
  render(<TargetFitTable entry={graded({ columns: ['PTS', '3PA'], gradedBy: '3PA' })} />);
  expect(headers()).toEqual(['Player', 'Avg 3PA']);
  expect(rows()).toEqual(['Big Fit Big1.3', 'No Label—']);
});

test('a Target with no saved stat choice shows its first default stat', () => {
  render(<TargetFitTable entry={graded(null)} />);
  expect(headers().at(-1)).toBe('Avg PTS');
});

// A rebounding Target, as captured for MIN @ HOU on 2026-11-04.
const rebounds = (players) => ({
  ...entry,
  target: {
    ...entry.target,
    title: 'HOU vs Wing',
    statPreferences: { columns: ['REB'], gradedBy: 'REB' },
  },
  statColumns: ['REB'],
  players,
});

test('each fit shows his last five against the majority line and the best Over price at it', () => {
  render(
    <TargetFitTable
      entry={rebounds([
        fit({
          name: 'Jaden McDaniels',
          position: 'Wing',
          seasonAverages: { REB: 6 },
          lastFiveGames: games(6, 7, 6, 3, 5.5),
          // Four providers post 5.5 and Novig 3.5: the line is 5.5, and of the
          // providers pricing it Polymarket's +127 is the best Over.
          lines: {
            prizepicks: { REB: 5.5 },
            underdog: { REB: 5.5 },
            polymarket: { REB: 5.5 },
            dabble: { REB: 5.5 },
            novig: { REB: 3.5 },
          },
          linePrices: {
            underdog: { REB: { over: 124, under: -152 } },
            polymarket: { REB: { over: 127, under: -186 } },
            dabble: { REB: { over: 120, under: -120 } },
            novig: { REB: { over: -400, under: 250 } },
          },
        }),
        fit({
          canonicalId: 2,
          name: 'Joan Beringer',
          position: 'Wing',
          seasonAverages: { REB: 6.9 },
          lastFiveGames: games(7, 10, 4),
          // PrizePicks posts 6.5 and Underdog 5.5: a tie goes to PrizePicks,
          // which prices no pick, so the row shows its line alone.
          lines: { prizepicks: { REB: 6.5 }, underdog: { REB: 5.5 } },
          linePrices: { underdog: { REB: { over: -110, under: -110 } } },
        }),
        fit({
          canonicalId: 3,
          name: 'No Line',
          position: 'Wing',
          seasonAverages: { REB: 2.1 },
          lastFiveGames: games(3, 1),
          lines: { prizepicks: { PTS: 8.5 } },
          linePrices: {},
        }),
      ])}
    />,
  );
  expect(headers()).toEqual(['Player', 'Last 5 REB', 'Avg REB', 'Line']);
  expect(rows()).toEqual([
    'Jaden McDaniels Wing67635.56.05.5Polymarket o+127 u−186',
    'Joan Beringer Wing71046.96.5PrizePicks',
    'No Line Wing312.1no line',
  ]);
  // The group says how many went over, so the colour is not the only signal.
  expect(
    screen.getAllByRole('group', { name: /newest first/ }).map((group) => group.ariaLabel),
  ).toEqual([
    'Last 5 REB, newest first, 3 over 5.5',
    'Last 3 REB, newest first, 2 over 6.5',
    'Last 2 REB, newest first',
  ]);
  const chips = (name) =>
    within(screen.getByRole('row', { name: new RegExp(name) }))
      .getByRole('group', { name: /newest first/ })
      .querySelectorAll('span');
  // Green only when strictly over the line; a game on the line is not over it.
  expect([...chips('McDaniels')].map((chip) => chip.className)).toEqual([
    'is-over',
    'is-over',
    'is-over',
    '',
    '',
  ]);
  expect([...chips('Beringer')].map((chip) => chip.className)).toEqual(['is-over', 'is-over', '']);
  // No line is nothing to beat, so every chip stays neutral.
  expect([...chips('No Line')].map((chip) => chip.className)).toEqual(['', '']);
});

test('a 3PA Target reads the line posted under the FG3A market', () => {
  render(
    <TargetFitTable
      entry={{
        ...entry,
        target: { ...entry.target, statPreferences: { columns: ['3PA'], gradedBy: '3PA' } },
        statColumns: ['3PA'],
        players: [
          fit({
            seasonAverages: { '3PA': 6.2 },
            lastFiveGames: games(7, 5),
            lines: { prizepicks: { FG3A: 5.5 }, underdog: { FG3A: 6.5 } },
            linePrices: { underdog: { FG3A: { over: 105, under: -135 } } },
          }),
        ],
      }}
    />,
  );
  // One provider each: the tie goes to PrizePicks' 5.5, which prices no pick.
  expect(headers()).toEqual(['Player', 'Last 5 3PA', 'Avg 3PA', 'Line']);
  expect(rows()).toEqual(['Big Fit Big756.25.5PrizePicks']);
});

test('a completed game sends no last games, and the Last 5 column goes', () => {
  render(
    <TargetFitTable
      entry={rebounds([fit({ seasonAverages: { REB: 4 }, lastFiveGames: [], lines: {} })])}
    />,
  );
  expect(headers()).toEqual(['Player', 'Avg REB', 'Line']);
  expect(rows()).toEqual(['Big Fit Big4.0no line']);
});

// Season average 5; the games run 4, 4, 6 (fade) or 6, 6, 4 (boost) against it.
const backtest = (values) => ({
  season: '2025-26',
  statColumns: ['REB'],
  players: [
    {
      canonicalId: 9,
      seasonAverages: { REB: 5 },
      games: values.map((REB, index) => ({ gameDate: `2026-01-0${index + 1}`, stats: { REB } })),
    },
  ],
});

const slate = (note, backtests) => {
  const resolved = rebounds([fit({ seasonAverages: { REB: 6 } })]);
  render(
    <SlateGameTargets
      entries={[{ ...resolved, target: { ...resolved.target, note } }]}
      backtests={backtests}
    />,
  );
  return within(screen.getByRole('article'));
};

test('a negative backtest is a fade, and with no note its sentence is the reason', () => {
  const card = slate('', { 7: backtest([4, 4, 6]) });
  expect(card.getByText('fade REB')).toHaveClass('target-lean', 'is-fade');
  expect(
    card.getByText('2025-26 backtest: REB -6.7% vs own average, 33% of games over it.'),
  ).toBeVisible();
});

test('a positive backtest is a boost, and the note is the reason when there is one', () => {
  const card = slate('Wings rebound more vs HOU.', { 7: backtest([6, 6, 4]) });
  expect(card.getByText('boost REB')).toHaveClass('is-boost');
  expect(card.getByText('Wings rebound more vs HOU.')).toBeVisible();
  expect(card.queryByText(/backtest:/)).not.toBeInTheDocument();
});

test.each([
  // 5, 5, 4.994 against 5: −0.04%, which displays as 0% but is still a fade.
  ['a small negative', [5, 5, 4.994], 'fade REB'],
  // Exactly on the average is not a fade.
  ['an exact zero', [5, 5, 5], 'boost REB'],
])('%s backtest leans by its unrounded sign', (_, values, lean) => {
  const card = slate('', { 7: backtest(values) });
  expect(card.getByText(/^(fade|boost) REB$/)).toHaveTextContent(lean);
  expect(
    card.getByText('2025-26 backtest: REB 0% vs own average, 0% of games over it.'),
  ).toBeVisible();
});

test('a line its provider prices on neither side reads as the line alone', () => {
  render(
    <TargetFitTable
      entry={rebounds([
        fit({
          seasonAverages: { REB: 6 },
          lastFiveGames: games(7),
          lines: { underdog: { REB: 5.5 } },
          linePrices: { underdog: { REB: { over: null, under: null } } },
        }),
      ])}
    />,
  );
  expect(rows()).toEqual(['Big Fit Big76.05.5Underdog']);
});

test('with no backtest the note stands alone, with no lean', () => {
  const card = slate('Wings rebound more vs HOU.', {});
  expect(card.getByText('Wings rebound more vs HOU.')).toBeVisible();
  expect(card.queryByText(/^(fade|boost) /)).not.toBeInTheDocument();
});

test('with neither a note nor a backtest the header stands alone above the rows', () => {
  slate('', {});
  const article = screen.getByRole('article');
  expect(article.querySelector('.target-fit-why')).toBeNull();
  expect(article.querySelector('.target-under-count').textContent).toBe('1 fit');
  expect(rows()).toEqual(['Big Fit Big6.0']);
});
