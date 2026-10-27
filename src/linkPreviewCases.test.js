import { render, renderHook, screen } from '@testing-library/react';
import ChartComponent from './ChartComponent';
import { decodeGameLogsResponse, postedLineFor } from './gameLogsApi';
import { useLineSelection } from './lineSelection';
import { lineFromSearch } from './filterUtils';
import { linkPreviewFor } from './linkPreview';
import {
  cases,
  filter_cases as filterCases,
  line_cases as lineCases,
} from './linkPreviewCases.json';

jest.mock('react-chartjs-2', () => ({ Bar: () => null }));
jest.mock('./chartSetup', () => ({}));
jest.mock('./AppliedFilters', () => ({ __esModule: true, default: () => null }));

// The backend draws the link preview's line and hit count by these rules, so
// they must stay what the Game Logs page shows for the same link and day.
test.each(cases)('$name', (testCase) => {
  const { line_type, link_line, lines, season_averages, values, expect: expected } = testCase;
  const { gameLogs, averages, postedLine } = decodeGameLogsResponse({
    game_logs: values.map((value) => ({ [line_type]: value })),
    season_averages,
    posted_line: { lines },
  });
  // A link line arrives the way the page reads it, through the URL.
  const link =
    link_line === undefined ? null : lineFromSearch(new URLSearchParams({ line: link_line }));
  const { result } = renderHook(() =>
    useLineSelection({ player: 'Player', lineType: line_type, postedLine, averages, link }),
  );
  const { lineValue, lineSource } = result.current;

  const source = lineSource
    ? 'posted'
    : lineValue === ''
      ? null
      : link !== null
        ? 'link'
        : 'season_average';
  expect(lineValue).toBe(expected.line ?? '');
  expect(source).toBe(expected.source);
  expect(lineSource ? postedLineFor(postedLine, line_type, lineSource).key : null).toBe(
    expected.provider,
  );

  render(
    <ChartComponent
      gameLogs={gameLogs}
      lineType={line_type}
      lineValue={lineValue}
      averages={averages}
      postedLine={postedLine}
      lineSource={lineSource}
    />,
  );
  // The Hit Rate card leads with every matching game, before its L5 and L10.
  const [, hits, games] = screen.getByText(/^\d+\/\d+$/).textContent.match(/(\d+)\/(\d+)/);
  expect(Number(games)).toBe(expected.games);
  // With no line the card makes no claim, while the page counts against zero.
  if (expected.hits !== null) expect(Number(hits)).toBe(expected.hits);
});

// The card's filters line uses the words of the link's description.
test.each(filterCases)('filters for $query', ({ query, filters }) => {
  const { description } = linkPreviewFor(new URLSearchParams(query));
  expect(description).toBe(`${filters}. Explore on CourtAI.`);
});

// Which `line` values a link may carry, and how each is shown.
test.each(lineCases)('line $line', ({ line, valid, shown }) => {
  expect(lineFromSearch(new URLSearchParams({ line }))).toBe(valid ? shown : null);
});
