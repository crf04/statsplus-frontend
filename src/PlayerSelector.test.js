import { render, screen, within } from '@testing-library/react';
import PlayerSelector from './PlayerSelector';
import { decodeGameLogsResponse } from './gameLogsApi';

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
