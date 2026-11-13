import { act, fireEvent, render, screen } from '@testing-library/react';
import ChartComponent from './ChartComponent';
import { decodeGameLogsResponse } from './gameLogsApi';

let barProps;
jest.mock('react-chartjs-2', () => ({
  Bar: (props) => {
    barProps = props;
    return null;
  },
}));
jest.mock('./chartSetup', () => ({}));
jest.mock('./MetricsDashboardRow', () => ({ __esModule: true, default: () => null }));
jest.mock('./AppliedFilters', () => ({ __esModule: true, default: () => null }));

const averages = [
  { PTS: 31.3, MIN: 34 },
  { PTS: 24.7, MIN: 30 },
];

test('without an explicit line the chart draws the season average', () => {
  render(
    <ChartComponent
      gameLogs={[{ GAME_DATE: '2026-01-01', PTS: 20 }]}
      lineType="PTS"
      lineValue=""
      averages={averages}
    />,
  );
  const line = barProps.options.plugins.annotation.annotations.line1;
  expect(line.yMin).toBe(24.7);
  expect(line.label.content).toEqual(['Season avg: 24.7']);
});

const { postedLine } = decodeGameLogsResponse({
  game_logs: [],
  posted_line: {
    game_date: '2026-10-21',
    matchup: 'GSW vs LAL',
    lines: { PTS: { value: 26.5, provider: 'prizepicks' } },
  },
});

const lineLabel = (lineValue, lineSource) => {
  render(
    <ChartComponent
      gameLogs={[{ GAME_DATE: '2026-01-01', PTS: 20 }]}
      lineType="PTS"
      lineValue={lineValue}
      averages={averages}
      postedLine={postedLine}
      lineSource={lineSource}
    />,
  );
  const { label } = barProps.options.plugins.annotation.annotations.line1;
  expect(label.display).toBe(true);
  return label.content;
};

test('the posted line is labelled with its provider and game', () => {
  expect(lineLabel('26.5', 'provider:prizepicks')).toEqual([
    'PrizePicks 26.5',
    'GSW vs LAL · Wed, Oct 21',
  ]);
});

test('a typed line keeps the plain label, even at the posted value', () => {
  expect(lineLabel('30', null)).toEqual(['Line: 30']);
  expect(lineLabel('26.5', null)).toEqual(['Line: 26.5']);
});

// The backend sends the newest game first; the decoder puts it last, as the
// chart draws it.
const stripLogs = decodeGameLogsResponse({
  game_logs: [
    {
      GAME_DATE: '2026-11-04',
      MATCHUP: 'NYK vs. CHI',
      MIN: 28,
      PTS: 33,
      REB: 2,
      AST: 4,
      FG3M: 5,
      STL: 0,
      BLK: 0,
      TOV: 0,
      USG_PCT: 29.4,
      FGM: 10,
      FGA: 17,
      FG3A: 10,
      FTM: 8,
      FTA: 9,
      closing_lines: { PTS: { book: 'draftkings', value: 26.5 } },
    },
    {
      GAME_DATE: '2026-11-02',
      MATCHUP: 'NYK @ BOS',
      MIN: 35,
      PTS: 22,
      REB: 9,
      AST: 3,
      FG3M: 2,
      STL: 1,
      BLK: 1,
      TOV: 2,
      FGM: 8,
      FGA: 15,
      FG3A: 6,
      REB_CHANCES: 14,
      closing_line: { book: 'fanduel', value: 24.5 },
    },
    {
      GAME_DATE: '2026-10-31',
      MATCHUP: 'NYK @ MIA',
      MIN: 31,
      PTS: 18,
      REB: 5,
      AST: 6,
      FG3M: 1,
      STL: 2,
      BLK: 0,
      TOV: 1,
      closing_lines: { REB: { book: 'betmgm', value: 5 } },
    },
  ],
  opponent_ranks: {
    PTS: { label: 'Points Allowed', ranks: { CHI: 30, BOS: 4, MIA: 15 } },
    TOV: { label: 'Turnovers Forced', ranks: { CHI: 22 } },
  },
});

const renderStrip = (props = {}) =>
  render(
    <ChartComponent
      gameLogs={stripLogs.gameLogs}
      lineType="PTS"
      lineValue=""
      averages={averages}
      opponentRanks={stripLogs.opponentRanks}
      {...props}
    />,
  );
const strip = () => screen.getByRole('region', { name: 'Picked game' });
const stripValue = () => strip().querySelector('.game-strip-value');
const boxColumns = () =>
  [...strip().querySelectorAll('dl > div')].map(
    (column) =>
      `${column.querySelector('dt').textContent} ${column.querySelector('dd').textContent}`,
  );
// Each call is a new pointer event, as Chart.js hands over a new native event.
const pointAt = (index, native = {}) =>
  act(() => barProps.options.onHover({ native }, index === null ? [] : [{ index }]));
const pickBar = (index) => pointAt(index);

describe('the game strip under the chart', () => {
  test('it opens on the most recent game, judged against its sportsbook close', () => {
    renderStrip();
    expect(strip()).toHaveTextContent('Wed, Nov 4');
    expect(strip()).toHaveTextContent('vs CHI · game 3 of 3');
    expect(stripValue().textContent).toBe('33');
    expect(stripValue()).toHaveClass('is-over');
    expect(strip().querySelector('.game-strip-close').textContent).toBe(
      'Closed 26.5 DraftKings +6.5',
    );
    expect(screen.getByText('+6.5')).toHaveClass('is-over');
    expect(screen.getByText('30th')).toHaveClass('is-soft');
    expect(strip().querySelector('.game-strip-rank').textContent).toBe('CHI 30th PTS allowed');
  });

  test('the box line golds the charted stat and adds its supporting columns', () => {
    renderStrip();
    expect(boxColumns()).toEqual([
      'MIN 28',
      'PTS 33',
      'REB 2',
      'AST 4',
      '3PM 5',
      'STL 0',
      'BLK 0',
      'TOV 0',
      'USG 29%',
      'FG 10/17',
      '3P 5/10',
      'FT 8/9',
    ]);
    expect(strip().querySelector('.is-charted').textContent).toBe('PTS33');
  });

  test('without a close for the market there is no Closed row and the value is uncoloured; a posted line never shows', () => {
    const { postedLine } = decodeGameLogsResponse({
      game_logs: [],
      posted_line: {
        game_date: '2026-11-06',
        matchup: 'NYK vs. ORL',
        lines: { REB: { value: 7.5, provider: 'prizepicks' } },
      },
    });
    renderStrip({
      lineType: 'REB',
      lineValue: '7.5',
      postedLine,
      lineSource: 'provider:prizepicks',
    });
    expect(stripValue().textContent).toBe('2');
    expect(stripValue()).not.toHaveClass('is-over');
    expect(stripValue()).not.toHaveClass('is-under');
    expect(strip()).not.toHaveTextContent('Closed');
    expect(strip()).not.toHaveTextContent('PrizePicks');
    expect(strip()).not.toHaveTextContent('7.5');
    // REB has no ranking here, so there is no opponent row either.
    expect(strip().querySelector('.game-strip-rank')).toBeNull();
  });

  test('‹ steps to the previous game and stops on the first; › stops on the last', () => {
    renderStrip();
    const previous = screen.getByRole('button', { name: 'Previous game' });
    const next = screen.getByRole('button', { name: 'Next game' });
    expect(next).toBeDisabled();
    fireEvent.click(previous);
    expect(strip()).toHaveTextContent('Mon, Nov 2');
    expect(strip()).toHaveTextContent('@ BOS · game 2 of 3');
    // Points fall back to the single closing line: 22 under a 24.5 close.
    expect(strip().querySelector('.game-strip-close').textContent).toBe('Closed 24.5 FanDuel −2.5');
    expect(screen.getByText('−2.5')).toHaveClass('is-under');
    expect(stripValue()).toHaveClass('is-under');
    expect(screen.getByText('4th')).toHaveClass('is-tough');
    fireEvent.click(previous);
    expect(strip()).toHaveTextContent('@ MIA · game 1 of 3');
    expect(previous).toBeDisabled();
    // A column the row lacks is left out: this game has no shooting splits.
    expect(boxColumns()).toEqual([
      'MIN 31',
      'PTS 18',
      'REB 5',
      'AST 6',
      '3PM 1',
      'STL 2',
      'BLK 0',
      'TOV 1',
    ]);
    expect(screen.getByText('15th')).not.toHaveClass('is-soft');
    expect(screen.getByText('15th')).not.toHaveClass('is-tough');
    fireEvent.click(next);
    expect(strip()).toHaveTextContent('game 2 of 3');
  });

  test('hovering a bar picks its game and outlines its bar', () => {
    renderStrip();
    expect(barProps.data.datasets[0].borderWidth).toEqual([0, 0, 2]);
    pickBar(0);
    expect(strip()).toHaveTextContent('Sat, Oct 31');
    expect(strip()).toHaveTextContent('@ MIA · game 1 of 3');
    expect(stripValue().textContent).toBe('18');
    expect(barProps.data.datasets[0].borderWidth).toEqual([2, 0, 0]);
    // The pointer leaving the chart keeps the pick.
    pointAt(null);
    expect(strip()).toHaveTextContent('game 1 of 3');
  });

  test('the faint chances bar is never outlined; REB shows its chances', () => {
    renderStrip({ lineType: 'REB' });
    pickBar(1);
    expect(barProps.data.datasets[0].borderWidth).toEqual([0, 2, 0]);
    expect(barProps.data.datasets[1].borderWidth).toBe(0);
    expect(boxColumns()).toContain('Chances 14');
  });

  test('a game that lands on its close reads as under', () => {
    renderStrip({ lineType: 'REB' });
    pickBar(0);
    expect(strip().querySelector('.game-strip-close').textContent).toBe('Closed 5.0 BetMGM ±0');
    expect(screen.getByText('±0')).toHaveClass('is-under');
    expect(strip().querySelector('.is-charted').textContent).toBe('REB5');
    expect(stripValue()).toHaveClass('is-under');
  });

  test('a Line Type change keeps the pick; a new game set goes back to the most recent game', () => {
    const { rerender } = renderStrip();
    pickBar(0);
    const props = { lineValue: '', averages, opponentRanks: stripLogs.opponentRanks };
    rerender(<ChartComponent gameLogs={stripLogs.gameLogs} lineType="TOV" {...props} />);
    expect(strip()).toHaveTextContent('@ MIA · game 1 of 3');
    expect(stripValue().textContent).toBe('1');
    rerender(
      <ChartComponent gameLogs={[...stripLogs.gameLogs.slice(1)]} lineType="TOV" {...props} />,
    );
    expect(strip()).toHaveTextContent('vs CHI · game 2 of 2');
    expect(strip().querySelector('.game-strip-rank').textContent).toBe('CHI 22nd TOV forced');
  });

  test('a step with ‹ › survives Chart.js replaying the last pointer event', () => {
    renderStrip();
    const tap = {};
    pointAt(0, tap);
    expect(strip()).toHaveTextContent('game 1 of 3');
    fireEvent.click(screen.getByRole('button', { name: 'Next game' }));
    // The chart updates and replays the tap that picked game 1.
    pointAt(0, tap);
    expect(strip()).toHaveTextContent('@ BOS · game 2 of 3');
    // A new pointer event still picks.
    pickBar(0);
    expect(strip()).toHaveTextContent('game 1 of 3');
  });

  test('a step survives the replay of a hover that came before a click on the same bar', () => {
    renderStrip();
    const hover = {};
    pointAt(0, hover);
    pointAt(0, {});
    expect(strip()).toHaveTextContent('game 1 of 3');
    fireEvent.click(screen.getByRole('button', { name: 'Next game' }));
    // Chart.js kept the hover, not the click, as the event it replays.
    pointAt(0, hover);
    expect(strip()).toHaveTextContent('@ BOS · game 2 of 3');
  });

  test('returning to a game set seen before opens on its most recent game', () => {
    const { rerender } = renderStrip();
    pickBar(0);
    const props = { lineType: 'PTS', lineValue: '', averages };
    rerender(<ChartComponent gameLogs={stripLogs.gameLogs.slice(1)} {...props} />);
    expect(strip()).toHaveTextContent('game 2 of 2');
    rerender(<ChartComponent gameLogs={stripLogs.gameLogs} {...props} />);
    expect(strip()).toHaveTextContent('vs CHI · game 3 of 3');
  });

  // One row carrying every supporting stat, so each market shows exactly its own.
  const everyStat = {
    GAME_DATE: '2026-11-04',
    MATCHUP: 'NYK vs. CHI',
    MIN: 30,
    PTS: 24,
    REB: 7,
    AST: 5,
    FG3M: 3,
    STL: 1,
    BLK: 2,
    TOV: 4,
    USG_PCT: 25.6,
    FGM: 9,
    FGA: 18,
    FG2M: 6,
    FG2A: 10,
    FG3A: 8,
    FTM: 3,
    FTA: 4,
    REB_CHANCES: 12,
    POTENTIAL_AST: 11,
    PRA: 36,
    PR: 31,
    PA: 29,
    RA: 12,
    STKS: 3,
  };
  test.each([
    ['AST', 'AST', ['Potential 11', 'USG 26%']],
    ['FG3M', '3PM', ['3P 3/8', 'USG 26%']],
    ['FG3A', null, ['3P 3/8', 'USG 26%']],
    ['FGM', null, ['FG 9/18', '2P 6/10', '3P 3/8', 'USG 26%']],
    ['FGA', null, ['FG 9/18', '2P 6/10', '3P 3/8', 'USG 26%']],
    ['FG2M', null, ['2P 6/10', '3P 3/8', 'USG 26%']],
    ['FG2A', null, ['2P 6/10', '3P 3/8', 'USG 26%']],
    ['FTM', null, ['FT 3/4', 'FG 9/18', 'USG 26%']],
    ['FTA', null, ['FT 3/4', 'FG 9/18', 'USG 26%']],
    ['PRA', null, ['USG 26%']],
    ['PR', null, ['USG 26%']],
    ['PA', null, ['USG 26%']],
    ['TOV', 'TOV', ['USG 26%']],
    ['RA', null, ['Chances 12']],
    ['STKS', null, []],
  ])('%s: charted box column %s, supporting columns %j', (lineType, gold, supporting) => {
    renderStrip({ gameLogs: [everyStat], lineType });
    expect(boxColumns().slice(0, 8)).toEqual([
      'MIN 30',
      'PTS 24',
      'REB 7',
      'AST 5',
      '3PM 3',
      'STL 1',
      'BLK 2',
      'TOV 4',
    ]);
    expect(boxColumns().slice(8)).toEqual(supporting);
    expect(strip().querySelector('.is-charted dt')?.textContent ?? null).toBe(gold);
  });

  test('the canvas tooltip no longer opens on hover', () => {
    renderStrip();
    expect(barProps.options.plugins.tooltip.enabled).toBe(false);
  });
});

describe('tracking ghost bars', () => {
  const logs = [
    {
      GAME_DATE: '2026-01-01',
      MATCHUP: 'LAL @ BOS',
      MIN: 30,
      REB: 8,
      REB_CHANCES: 15,
      AST: 7,
      POTENTIAL_AST: 13,
      PTS: 20,
    },
    {
      GAME_DATE: '2026-01-03',
      MATCHUP: 'LAL vs. DEN',
      MIN: 28,
      REB: 8,
      REB_CHANCES: null,
      AST: 7,
      POTENTIAL_AST: null,
      PTS: 20,
    },
  ];
  const draw = (lineType, extra = {}) => {
    render(
      <ChartComponent
        gameLogs={logs}
        lineType={lineType}
        lineValue=""
        averages={averages}
        {...extra}
      />,
    );
    return barProps;
  };
  test('REB and AST add a ghost dataset of the tracked values, null for an untracked game', () => {
    const reb = draw('REB');
    expect(reb.data.datasets.map((d) => d.label)).toEqual(['REB', 'Rebound chances']);
    expect(reb.data.datasets[1].data).toEqual([15, null]);
    expect(reb.options.plugins.legend.display).toBe(true);
    const ast = draw('AST');
    expect(ast.data.datasets.map((d) => d.label)).toEqual(['AST', 'Potential assists']);
    expect(ast.data.datasets[1].data).toEqual([13, null]);
  });

  test('other line types have no ghost bar and no legend', () => {
    const pts = draw('PTS');
    expect(pts.data.datasets).toHaveLength(1);
    expect(pts.options.plugins.legend.display).toBe(false);
  });

  test('the averages row shows the average and the season value, and hides when null', () => {
    const avg = [
      {
        REB: 8,
        AST: 7,
        MIN: 30,
        REB_CHANCES: 15.8,
        REB_CONV_PCT: 0.59,
        POTENTIAL_AST: 12.1,
        AST_CONV_PCT: 0.58,
      },
      {
        REB: 7,
        AST: 6,
        MIN: 30,
        REB_CHANCES: 14.2,
        REB_CONV_PCT: 0.57,
        POTENTIAL_AST: null,
        AST_CONV_PCT: null,
      },
    ];
    const { unmount } = render(
      <ChartComponent gameLogs={logs} lineType="REB" lineValue="" averages={avg} />,
    );
    expect(document.querySelector('.tracking-averages').textContent).toBe(
      'Chances 15.8 · season 14.2',
    );
    unmount();
    const ast = render(
      <ChartComponent gameLogs={logs} lineType="AST" lineValue="" averages={avg} />,
    );
    // season value null: the season part is dropped
    expect(document.querySelector('.tracking-averages').textContent).toBe('Potential 12.1');
    ast.unmount();
    render(
      <ChartComponent
        gameLogs={logs}
        lineType="AST"
        lineValue=""
        averages={[avg[0], { ...avg[1], POTENTIAL_AST: 11.4 }]}
      />,
    );
    expect(document.querySelector('.tracking-averages').textContent).toBe(
      'Potential 12.1 · season 11.4',
    );
  });

  test('no averages row without tracking averages, or for PTS', () => {
    draw('REB');
    expect(document.querySelector('.tracking-averages')).toBeNull();
  });

  test('the row is hidden when the filtered average is null', () => {
    const avg = [
      { REB: 8, MIN: 30, REB_CHANCES: null },
      { REB: 7, MIN: 30, REB_CHANCES: 14.2 },
    ];
    render(<ChartComponent gameLogs={logs} lineType="REB" lineValue="" averages={avg} />);
    expect(document.querySelector('.tracking-averages')).toBeNull();
  });
});
