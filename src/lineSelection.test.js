import { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import PlayerSelector from './PlayerSelector';
import ChartComponent from './ChartComponent';
import { decodeGameLogsResponse } from './gameLogsApi';
import { useLineSelection } from './lineSelection';

let chartLine;
jest.mock('react-chartjs-2', () => ({
  Bar: ({ options }) => {
    chartLine = options.plugins.annotation.annotations.line1;
    return null;
  },
}));
jest.mock('./chartSetup', () => ({}));
jest.mock('./AppliedFilters', () => ({ __esModule: true, default: () => null }));

const decodePosted = (postedLine) =>
  decodeGameLogsResponse({ game_logs: [], posted_line: postedLine }).postedLine;

const curryGame = { game_date: '2026-10-21', matchup: 'GSW vs LAL' };
const CURRY_GAME = 'GSW vs LAL · Wed, Oct 21';
const curryPosted = (betrivers) =>
  decodePosted({
    ...curryGame,
    lines: {
      PTS: { value: 26.5, provider: 'dabble' },
      '3PM': { value: 4.5, provider: 'underdog' },
    },
    provider_lines: { dabble: { PTS: 26.5 }, underdog: { '3PM': 4.5 } },
    line_prices: { dabble: { PTS: { over: -122, under: -122 } } },
    book_lines: {
      PTS: {
        books: [{ book: 'draftkings', line: 26.5, over: -110, under: -115 }, ...betrivers],
      },
      '3PM': { books: [{ book: 'hardrockbet', line: 3.5, over: -150, under: 120 }] },
    },
  });

const curryLogs = [25, 27, 28, 29, 31].map((PTS, index) => ({
  GAME_DATE: `2026-04-0${index + 1}`,
  PTS,
  FG3M: index + 2,
  REB: index + 3,
}));
const curryAverages = [
  { PTS: 31.3, REB: 9.2, FG3M: 5 },
  { PTS: 24.7, REB: 5.1, FG3M: 3.9 },
];
const curry = (overrides) => ({
  player: 'Stephen Curry',
  posted: curryPosted([{ book: 'betrivers', line: 27.5, over: 102, under: null }]),
  averages: curryAverages,
  gameLogs: curryLogs,
  ...overrides,
});
const CURRY = curry();
const CURRY_MOVED = curry({
  posted: curryPosted([{ book: 'betrivers', line: 28.5, over: 104, under: -130 }]),
});
const CURRY_WITHDRAWN = curry({ posted: curryPosted([]) });
const CURRY_NO_REB = curry({ averages: [{ PTS: 31.3 }, { PTS: 24.7 }] });

const LEBRON = {
  player: 'LeBron James',
  posted: decodePosted({
    game_date: '2026-10-22',
    matchup: 'LAL @ PHX',
    lines: { PTS: { value: 22.5, provider: 'underdog' } },
    provider_lines: { dabble: { PTS: 21.5 }, underdog: { PTS: 22.5 } },
  }),
  averages: [{ PTS: 25 }, { PTS: 24.4 }],
  gameLogs: [20, 21, 22, 23, 24].map((PTS, index) => ({
    GAME_DATE: `2026-04-0${index + 1}`,
    PTS,
  })),
};

// A request in flight clears the posted line, averages and logs.
const loading = (player) => ({ player, posted: null, averages: [], gameLogs: [] });

const Harness = ({ player, posted, averages, gameLogs }) => {
  const [lineType, setLineType] = useState('PTS');
  const line = useLineSelection({ player, lineType, postedLine: posted, averages });
  return (
    <>
      <PlayerSelector
        selectedPlayer={player}
        setSelectedPlayer={() => {}}
        lineType={lineType}
        setLineType={setLineType}
        lineValue={line.lineValue}
        onTypeLineValue={line.typeLineValue}
        lineSource={line.lineSource}
        onChooseSource={line.chooseSource}
        playerList={[]}
        postedLine={posted}
      />
      <ChartComponent
        gameLogs={gameLogs}
        lineType={lineType}
        lineValue={line.lineValue}
        averages={averages}
        postedLine={posted}
        lineSource={line.lineSource}
      />
    </>
  );
};

const choose = (name) => ({ choose: name });
const type = (value) => ({ type: value });
const lineType = (value) => ({ lineType: value });
const load = (props) => ({ props });

const run = (start, steps) => {
  const { rerender } = render(<Harness {...start} />);
  steps.forEach((step) => {
    if (step.props) rerender(<Harness {...step.props} />);
    if (step.choose)
      fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${step.choose}`) }));
    if (step.type !== undefined) {
      fireEvent.change(screen.getByLabelText('Line Value:'), { target: { value: step.type } });
    }
    if (step.lineType) {
      fireEvent.change(screen.getByLabelText('Line Type:'), { target: { value: step.lineType } });
    }
  });
};

const DABBLE = 'Dabble 26.5, Over −122, Under −122';
const BETRIVERS = 'BetRivers 27.5, Over +102, no Under price';

// Each row ends on the player's logs, so the chart shows the line it drew.
test.each([
  ['the default source on load', CURRY, [], ['26.5', [DABBLE], ['Dabble 26.5', CURRY_GAME], '4/5']],
  [
    'choosing a source',
    CURRY,
    [choose('BetRivers')],
    ['27.5', [BETRIVERS], ['BetRivers 27.5', CURRY_GAME], '3/5'],
  ],
  [
    'a refetch that moves the chosen source moves the line',
    CURRY,
    [choose('BetRivers'), load(CURRY_MOVED)],
    ['28.5', ['BetRivers 28.5, Over +104, Under −130'], ['BetRivers 28.5', CURRY_GAME], '2/5'],
  ],
  [
    'a chosen source holds through a refetch for the same player',
    CURRY,
    [choose('BetRivers'), load(loading('Stephen Curry')), load(CURRY)],
    ['27.5', [BETRIVERS], ['BetRivers 27.5', CURRY_GAME], '3/5'],
  ],
  [
    'a chosen source that stops posting gives way to the default',
    CURRY,
    [choose('BetRivers'), load(CURRY_WITHDRAWN)],
    ['26.5', [DABBLE], ['Dabble 26.5', CURRY_GAME], '4/5'],
  ],
  [
    'a typed value overrides a chosen source',
    CURRY,
    [choose('BetRivers'), type('30')],
    ['30', [], ['Line: 30'], '1/5'],
  ],
  [
    'typing the default value still makes it typed',
    CURRY,
    [type('30'), type('26.5')],
    ['26.5', [], ['Line: 26.5'], '4/5'],
  ],
  [
    'a typed value holds through refetches for the same player',
    CURRY,
    [type('30'), load(CURRY_MOVED), load(loading('Stephen Curry')), load(CURRY)],
    ['30', [], ['Line: 30'], '1/5'],
  ],
  [
    'another player loaded through an empty response takes his default, not the chosen source',
    CURRY,
    [choose('Dabble'), load(loading('LeBron James')), load(LEBRON)],
    ['22.5', ['Underdog 22.5'], ['Underdog 22.5', 'LAL @ PHX · Thu, Oct 22'], '2/5'],
  ],
  [
    'a typed value expires when the player changes, even with no data for the other',
    CURRY,
    [type('30'), load(loading('LeBron James')), load(CURRY)],
    ['26.5', [DABBLE], ['Dabble 26.5', CURRY_GAME], '4/5'],
  ],
  [
    'a typed value expires through a Line Type with no line and no average',
    CURRY_NO_REB,
    [type('30'), lineType('REB'), lineType('PTS')],
    ['26.5', [DABBLE], ['Dabble 26.5', CURRY_GAME], '4/5'],
  ],
  [
    'a Line Type with no line and no average leaves Line Value empty',
    CURRY_NO_REB,
    [lineType('REB')],
    ['', [], ['Season avg: 0.0'], '5/5'],
  ],
  [
    'changing Line Type resets a chosen source',
    CURRY,
    [choose('BetRivers'), lineType('FG3M'), lineType('PTS')],
    ['26.5', [DABBLE], ['Dabble 26.5', CURRY_GAME], '4/5'],
  ],
  [
    'FG3M draws the 3PM default',
    CURRY,
    [lineType('FG3M')],
    ['4.5', ['Underdog 4.5'], ['Underdog 4.5', CURRY_GAME], '2/5'],
  ],
  [
    'FG3M offers the 3PM sources',
    CURRY,
    [lineType('FG3M'), choose('Hardrockbet')],
    ['3.5', ['Hardrockbet 3.5, Over −150, Under +120'], ['Hardrockbet 3.5', CURRY_GAME], '3/5'],
  ],
  [
    'a Line Type without a posted line takes the season average',
    CURRY,
    [lineType('REB')],
    ['5.1', [], ['Line: 5.1'], '2/5'],
  ],
  [
    'no posted line takes the season average, not the filtered one',
    curry({ posted: null }),
    [],
    ['24.7', [], ['Line: 24.7'], '5/5'],
  ],
  [
    'a response with only `lines` draws its default without a picker',
    curry({
      posted: decodePosted({
        ...curryGame,
        lines: { PTS: { value: 26.5, provider: 'prizepicks' } },
      }),
    }),
    [],
    ['26.5', [], ['PrizePicks 26.5', CURRY_GAME], '4/5'],
  ],
  [
    'a default named by a book key presses that book',
    curry({
      posted: decodePosted({
        lines: { PTS: { value: 26.5, provider: 'draftkings' } },
        provider_lines: { dabble: { PTS: 26.5 } },
        book_lines: {
          PTS: { books: [{ book: 'draftkings', line: 26.5, over: -110, under: -115 }] },
        },
      }),
    }),
    [],
    ['26.5', ['DraftKings 26.5, Over −110, Under −115'], ['DraftKings 26.5'], '4/5'],
  ],
])('%s', (_name, start, steps, [lineValue, pressed, label, overs]) => {
  run(start, steps);
  expect(screen.getByLabelText('Line Value:')).toHaveValue(lineValue);
  expect(
    screen
      .queryAllByRole('button', { pressed: true })
      .map((button) => button.getAttribute('aria-label')),
  ).toEqual(pressed);
  expect(chartLine.label.content).toEqual(label);
  expect(chartLine.yMin).toBe(lineValue === '' ? 0 : Number(lineValue));
  expect(screen.getByText(overs)).toBeVisible();
});
