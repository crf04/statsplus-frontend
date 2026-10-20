import { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import PlayerSelector from './PlayerSelector';
import ChartComponent from './ChartComponent';
import { decodeGameLogsResponse } from './gameLogsApi';

let chartLine;
jest.mock('react-chartjs-2', () => ({
  Bar: ({ options }) => {
    chartLine = options.plugins.annotation.annotations.line1;
    return null;
  },
}));
jest.mock('./chartSetup', () => ({}));
jest.mock('./AppliedFilters', () => ({ __esModule: true, default: () => null }));

const filtered = { PTS: 31.3, REB: 9.2 };
const season = { PTS: 24.7, REB: 5.1 };

const decodePosted = (postedLine) =>
  decodeGameLogsResponse({ game_logs: [], posted_line: postedLine }).postedLine;

const postedLine = decodePosted({
  game_date: '2026-10-21',
  matchup: 'GSW vs LAL',
  lines: {
    PTS: { value: 26.5, provider: 'prizepicks' },
    '3PM': { value: 4.5, provider: 'underdog' },
  },
});

const sourcedLine = decodePosted({
  game_date: '2026-10-21',
  matchup: 'GSW vs LAL',
  lines: {
    PTS: { value: 26.5, provider: 'dabble' },
    '3PM': { value: 4.5, provider: 'underdog' },
  },
  provider_lines: { dabble: { PTS: 26.5 }, underdog: { '3PM': 4.5 } },
  line_prices: { dabble: { PTS: { over: -122, under: -122 } } },
  book_lines: {
    PTS: {
      as_of: '2026-10-21T15:00:00Z',
      closing: false,
      books: [
        { book: 'draftkings', line: 26.5, over: -110, under: -115 },
        { book: 'betrivers', line: 27.5, over: 102, under: null },
      ],
    },
    '3PM': {
      as_of: '2026-10-21T15:00:00Z',
      closing: false,
      books: [{ book: 'hardrockbet', line: 3.5, over: -150, under: 120 }],
    },
  },
});

const Harness = ({ averages, posted = null, player = '', gameLogs = [] }) => {
  const [lineType, setLineType] = useState('PTS');
  const [lineValue, setLineValue] = useState('');
  const [lineSource, setLineSource] = useState(null);
  return (
    <>
      <PlayerSelector
        selectedPlayer={player}
        setSelectedPlayer={() => {}}
        lineType={lineType}
        setLineType={setLineType}
        lineValue={lineValue}
        setLineValue={setLineValue}
        lineSource={lineSource}
        setLineSource={setLineSource}
        playerList={[]}
        averages={averages}
        postedLine={posted}
      />
      <output data-testid="line-source">{lineSource ? 'posted' : 'not posted'}</output>
      <ChartComponent
        gameLogs={gameLogs}
        lineType={lineType}
        lineValue={lineValue}
        averages={averages}
        postedLine={posted}
        lineSource={lineSource}
      />
    </>
  );
};

test('auto-fills the line with the season average, not the filtered average', () => {
  render(<Harness averages={[filtered, season]} />);
  expect(screen.getByLabelText('Line Value:')).toHaveValue('24.7');
});

test('changing the line type fills the new stat season average', () => {
  render(<Harness averages={[filtered, season]} />);
  fireEvent.change(screen.getByLabelText('Line Type:'), { target: { value: 'REB' } });
  expect(screen.getByLabelText('Line Value:')).toHaveValue('5.1');
});

test('defaults the line to his next game posted line for the stat', () => {
  render(<Harness averages={[filtered, season]} posted={postedLine} />);
  expect(screen.getByLabelText('Line Value:')).toHaveValue('26.5');
  expect(screen.getByTestId('line-source')).toHaveTextContent('posted');
});

test('typing the posted value makes it a typed line, not the posted one', () => {
  render(<Harness averages={[filtered, season]} posted={postedLine} />);
  const line = screen.getByLabelText('Line Value:');
  fireEvent.change(line, { target: { value: '30' } });
  fireEvent.change(line, { target: { value: '26.5' } });
  expect(screen.getByTestId('line-source')).toHaveTextContent('not posted');
});

test('FG3M takes the 3PM posted line, and a stat without one the season average', () => {
  render(<Harness averages={[filtered, { ...season, FG3M: 3.9 }]} posted={postedLine} />);
  fireEvent.change(screen.getByLabelText('Line Type:'), { target: { value: 'FG3M' } });
  expect(screen.getByLabelText('Line Value:')).toHaveValue('4.5');
  fireEvent.change(screen.getByLabelText('Line Type:'), { target: { value: 'REB' } });
  expect(screen.getByLabelText('Line Value:')).toHaveValue('5.1');
  expect(screen.getByTestId('line-source')).toHaveTextContent('not posted');
});

test('a typed line survives a refetch until the stat or player changes', () => {
  const { rerender } = render(
    <Harness averages={[filtered, season]} posted={postedLine} player="Stephen Curry" />,
  );
  const line = screen.getByLabelText('Line Value:');
  fireEvent.change(line, { target: { value: '30' } });

  // A filter change refetches: new averages and posted-line objects, same values.
  rerender(
    <Harness
      averages={[{ ...filtered }, { ...season }]}
      posted={{ ...postedLine }}
      player="Stephen Curry"
    />,
  );
  expect(line).toHaveValue('30');

  rerender(
    <Harness
      averages={[filtered, { ...season }]}
      posted={{ ...postedLine }}
      player="LeBron James"
    />,
  );
  expect(line).toHaveValue('26.5');

  fireEvent.change(line, { target: { value: '30' } });
  fireEvent.change(screen.getByLabelText('Line Type:'), { target: { value: 'REB' } });
  expect(line).toHaveValue('5.1');
  fireEvent.change(screen.getByLabelText('Line Type:'), { target: { value: 'PTS' } });
  expect(line).toHaveValue('26.5');
});

const pressedSources = () =>
  screen
    .getAllByRole('button', { pressed: true })
    .map((button) => button.getAttribute('aria-label'));

test('without sources for the Line Type there is nothing to pick', () => {
  render(<Harness averages={[filtered, season]} posted={postedLine} />);
  expect(screen.queryByRole('group', { name: 'Posted Lines:' })).not.toBeInTheDocument();
});

test('lists every provider and book with its line and prices, the default chosen', () => {
  render(<Harness averages={[filtered, season]} posted={sourcedLine} />);
  const picker = screen.getByRole('group', { name: 'Posted Lines:' });
  expect(picker).toHaveTextContent('GSW vs LAL · Wed, Oct 21');
  expect(
    screen.getAllByRole('button', { pressed: false }).map((b) => b.getAttribute('aria-label')),
  ).toEqual([
    'DraftKings 26.5, Over −110, Under −115',
    'BetRivers 27.5, Over +102, no Under price',
  ]);
  expect(pressedSources()).toEqual(['Dabble 26.5, Over −122, Under −122']);
  expect(screen.getByLabelText('Line Value:')).toHaveValue('26.5');
});

test('choosing a source draws its line, labelled with it, and recounts the overs', () => {
  const gameLogs = [
    { GAME_DATE: '2026-04-10', PTS: 27, FG3M: 4 },
    { GAME_DATE: '2026-04-12', PTS: 31, FG3M: 3 },
  ];
  render(
    <Harness
      averages={[filtered, { ...season, FG3M: 3.9 }]}
      posted={sourcedLine}
      gameLogs={gameLogs}
    />,
  );
  expect(chartLine.label.content).toEqual(['Dabble 26.5', 'GSW vs LAL · Wed, Oct 21']);
  expect(screen.getByText('2/2')).toBeVisible();

  fireEvent.click(screen.getByRole('button', { name: /^BetRivers 27\.5/ }));
  expect(screen.getByLabelText('Line Value:')).toHaveValue('27.5');
  expect(pressedSources()).toEqual(['BetRivers 27.5, Over +102, no Under price']);
  expect(chartLine.yMin).toBe(27.5);
  expect(chartLine.label.content).toEqual(['BetRivers 27.5', 'GSW vs LAL · Wed, Oct 21']);
  expect(screen.getByText('1/2')).toBeVisible();

  fireEvent.change(screen.getByLabelText('Line Type:'), { target: { value: 'FG3M' } });
  expect(pressedSources()).toEqual(['Underdog 4.5']);
  expect(screen.getByText('0/2')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: /^Hardrockbet 3\.5/ }));
  expect(screen.getByLabelText('Line Value:')).toHaveValue('3.5');
  expect(chartLine.label.content).toEqual(['Hardrockbet 3.5', 'GSW vs LAL · Wed, Oct 21']);
  expect(screen.getByText('1/2')).toBeVisible();
});

test('a chosen source holds through a refetch until the Line Type changes', () => {
  const { rerender } = render(
    <Harness averages={[filtered, season]} posted={sourcedLine} player="Stephen Curry" />,
  );
  fireEvent.click(screen.getByRole('button', { name: /^DraftKings/ }));
  rerender(
    <Harness
      averages={[{ ...filtered }, { ...season }]}
      posted={{ ...sourcedLine }}
      player="Stephen Curry"
    />,
  );
  expect(pressedSources()).toEqual(['DraftKings 26.5, Over −110, Under −115']);

  fireEvent.change(screen.getByLabelText('Line Type:'), { target: { value: 'REB' } });
  fireEvent.change(screen.getByLabelText('Line Type:'), { target: { value: 'PTS' } });
  expect(pressedSources()).toEqual(['Dabble 26.5, Over −122, Under −122']);
});

test('a typed line overrides the chosen source until the player changes', () => {
  const gameLogs = [{ GAME_DATE: '2026-04-10', PTS: 27 }];
  const { rerender } = render(
    <Harness
      averages={[filtered, season]}
      posted={sourcedLine}
      player="Stephen Curry"
      gameLogs={gameLogs}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: /^BetRivers/ }));
  fireEvent.change(screen.getByLabelText('Line Value:'), { target: { value: '26.5' } });
  expect(screen.queryAllByRole('button', { pressed: true })).toEqual([]);
  expect(screen.getByTestId('line-source')).toHaveTextContent('not posted');
  expect(chartLine.label.content).toEqual(['Line: 26.5']);

  rerender(
    <Harness averages={[filtered, season]} posted={{ ...sourcedLine }} player="Stephen Curry" />,
  );
  expect(screen.getByLabelText('Line Value:')).toHaveValue('26.5');
  expect(screen.queryAllByRole('button', { pressed: true })).toEqual([]);

  rerender(
    <Harness averages={[filtered, season]} posted={{ ...sourcedLine }} player="LeBron James" />,
  );
  expect(pressedSources()).toEqual(['Dabble 26.5, Over −122, Under −122']);
});
