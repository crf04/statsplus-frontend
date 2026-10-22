import { render, renderHook, screen } from '@testing-library/react';
import ChartComponent from './ChartComponent';
import { decodeGameLogsResponse, postedLineFor } from './gameLogsApi';
import { useLineSelection } from './lineSelection';
import { cases } from './linkPreviewCases.json';

jest.mock('react-chartjs-2', () => ({ Bar: () => null }));
jest.mock('./chartSetup', () => ({}));
jest.mock('./AppliedFilters', () => ({ __esModule: true, default: () => null }));

// The backend draws the link preview's line and hit count by these rules, so
// they must stay what the Game Logs page shows for the same link and day.
test.each(cases)('$name', ({ line_type, lines, season_averages, values, expect: expected }) => {
  const { gameLogs, averages, postedLine } = decodeGameLogsResponse({
    game_logs: values.map((value) => ({ [line_type]: value })),
    season_averages,
    posted_line: { lines },
  });
  const { result } = renderHook(() =>
    useLineSelection({ player: 'Player', lineType: line_type, postedLine, averages }),
  );
  const { lineValue, lineSource } = result.current;

  const source = lineSource ? 'posted' : lineValue === '' ? null : 'season_average';
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
  // The Hit Rate card reads "L<last 5>" then "L<last 10>".
  const [, last10] = screen.getAllByText(/^\s*L\d+\/\d+\s*$/);
  const [, hits, games] = last10.textContent.match(/L(\d+)\/(\d+)/);
  expect(Number(games)).toBe(expected.games);
  // With no line the card makes no claim, while the page counts against zero.
  if (expected.hits !== null) expect(Number(hits)).toBe(expected.hits);
});
