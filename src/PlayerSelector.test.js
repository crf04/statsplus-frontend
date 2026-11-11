import { render, screen, within } from '@testing-library/react';
import PlayerSelector from './PlayerSelector';
import { decodeGameLogsResponse } from './gameLogsApi';
import { lineTypeOptions } from './filterUtils';

const decodePosted = (postedLine) =>
  decodeGameLogsResponse({ game_logs: [], posted_line: postedLine }).postedLine;

const sourcedLine = decodePosted({
  game_date: '2026-10-21',
  matchup: 'GSW vs LAL',
  lines: { PTS: { value: 26.5, provider: 'dabble' } },
  provider_lines: { dabble: { PTS: 26.5 } },
  line_prices: { dabble: { PTS: { over: -122, under: -122 } } },
  book_lines: {
    PTS: {
      books: [
        { book: 'draftkings', line: 26.5, over: -110, under: -115 },
        { book: 'betrivers', line: 27.5, over: 102, under: null },
      ],
    },
  },
});

const renderSelector = (props) =>
  render(
    <PlayerSelector
      selectedPlayer="Stephen Curry"
      setSelectedPlayer={() => {}}
      lineType="PTS"
      setLineType={() => {}}
      lineValue=""
      onTypeLineValue={() => {}}
      lineSource={null}
      onChooseSource={() => {}}
      playerList={[]}
      postedLine={null}
      {...props}
    />,
  );

const sourceLabels = (options) =>
  within(screen.getByRole('group', { name: 'Posted Lines:' }))
    .getAllByRole('button', options)
    .map((button) => button.getAttribute('aria-label'));

test('without sources for the Line Type there is nothing to pick', () => {
  renderSelector({
    postedLine: decodePosted({ lines: { PTS: { value: 26.5, provider: 'prizepicks' } } }),
  });
  expect(screen.queryByRole('group', { name: 'Posted Lines:' })).not.toBeInTheDocument();
});

test('lists every provider and book with its line, prices and game; the named one pressed', () => {
  renderSelector({ postedLine: sourcedLine, lineSource: 'book:betrivers' });
  expect(screen.getByRole('group', { name: 'Posted Lines:' })).toHaveTextContent(
    'GSW vs LAL · Wed, Oct 21',
  );
  expect(sourceLabels()).toEqual([
    'Dabble 26.5, Over −122, Under −122',
    'DraftKings 26.5, Over −110, Under −115',
    'BetRivers 27.5, Over +102, no Under price',
  ]);
  expect(sourceLabels({ pressed: true })).toEqual(['BetRivers 27.5, Over +102, no Under price']);
});

// A signed-out or waitlisted reader's response carries no prices
// (crf04/statsplus#381): each source is its name and line, with no price cells.
test('sources without prices show their lines and no price cells', () => {
  renderSelector({
    postedLine: decodePosted({
      game_date: '2026-10-21',
      matchup: 'GSW vs LAL',
      lines: { PTS: { value: 26.5, provider: 'dabble' } },
      provider_lines: { dabble: { PTS: 26.5 } },
      book_lines: { PTS: { books: [{ book: 'draftkings', line: 26.5 }] } },
    }),
  });
  expect(sourceLabels()).toEqual(['Dabble 26.5', 'DraftKings 26.5']);
  const buttons = within(screen.getByRole('group', { name: 'Posted Lines:' })).getAllByRole(
    'button',
  );
  expect(buttons.map((button) => button.textContent)).toEqual(['Dabble26.5', 'DraftKings26.5']);
});

// crf04/statsplus#496: a stale sportsbook quote is still offered, marked with its age.
test('a stale book shows its line and prices, marked stale with its age', () => {
  const now = jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-10-22T16:00:00Z'));
  try {
    renderSelector({
      postedLine: decodePosted({
        lines: { PTS: { value: 26.5, provider: 'dabble' } },
        provider_lines: { dabble: { PTS: 26.5 } },
        book_lines: {
          PTS: {
            books: [
              {
                book: 'fanduel',
                line: 26.5,
                over: 105,
                under: -125,
                updated_at: '2026-10-21T21:00:00Z',
                stale: true,
              },
              {
                book: 'draftkings',
                line: 26.5,
                over: -110,
                under: -110,
                updated_at: '2026-10-22T15:55:00Z',
                stale: false,
              },
            ],
          },
        },
      }),
    });
    expect(sourceLabels()).toEqual([
      'Dabble 26.5',
      'FanDuel 26.5, Over +105, Under −125, stale, 19h ago',
      'DraftKings 26.5, Over −110, Under −110',
    ]);
    const buttons = within(screen.getByRole('group', { name: 'Posted Lines:' })).getAllByRole(
      'button',
    );
    expect(buttons.map((button) => button.textContent)).toEqual([
      'Dabble26.5',
      'FanDuel26.5o +105u −125stale, 19h ago',
      'DraftKings26.5o −110u −110',
    ]);
  } finally {
    now.mockRestore();
  }
});

test('a provider or book the app does not know is offered under its own key', () => {
  renderSelector({
    postedLine: decodePosted({
      lines: { PTS: { value: 26.5, provider: 'zebrabet' } },
      provider_lines: { acmepicks: { PTS: 25.5 } },
      book_lines: { PTS: { books: [{ book: 'zebrabet', line: 26.5, over: -105, under: -115 }] } },
    }),
  });
  expect(sourceLabels()).toEqual(['Acmepicks 25.5', 'Zebrabet 26.5, Over −105, Under −115']);
});

test('the Line Type select keeps every value, None first and the rest in the shared groups', () => {
  renderSelector();
  const select = screen.getByLabelText('Line Type:');
  expect(select.firstElementChild).toHaveTextContent('None');
  expect(
    [...select.querySelectorAll('optgroup')].map((group) => [
      group.label,
      [...group.querySelectorAll('option')].map((option) => option.value),
    ]),
  ).toEqual([
    ['Main', ['PTS', 'REB', 'AST', 'FG3M']],
    ['Combos', ['PRA', 'PA', 'PR', 'RA', 'STKS']],
    ['Shooting', ['FGM', 'FGA', 'FG2M', 'FG2A', 'FG3A', 'FTM', 'FTA']],
    ['Other', ['STL', 'BLK', 'TOV', 'FD_PTS']],
  ]);
  expect([...select.querySelectorAll('option')].map((option) => option.value).sort()).toEqual(
    [...lineTypeOptions].sort(),
  );
});
